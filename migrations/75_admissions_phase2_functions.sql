-- ============================================================================
-- ADMISSIONS PHASE 2, PART 2: FUNCTIONS
-- One deliberate simplification, flagged honestly: inpatient charges use
-- the existing 'consultation' service_charges category rather than a
-- new 'inpatient' enum value. Adding a new enum value safely requires a
-- separate migration step (Postgres won't let you use a new enum value
-- in the same transaction it's created in) and risks guessing at the
-- exact enum type name, which wasn't worth the risk for what's mostly a
-- reporting distinction — the charge DESCRIPTION already says exactly
-- what it's for ("Frais d'hospitalisation — X nuit(s)").
-- ============================================================================

alter table admissions add column if not exists discharge_type text;
alter table admissions add column if not exists discharge_outcome text;

-- ----------------------------------------------------------------------------
-- Direct admission creation — the "+ New Admission" button, usable
-- without going through a consultation (e.g. a transferred-in patient,
-- a direct reception-initiated admission). Reuses an active visit if
-- one exists; otherwise creates a minimal one, since every admission
-- must be tied to a visit.
-- ----------------------------------------------------------------------------
create or replace function create_direct_admission(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_admission_reason text,
  p_created_by uuid,
  p_source text default 'reception'
)
returns uuid
language plpgsql
as $$
declare
  v_visit_id uuid;
  v_admission_id uuid;
  v_admission_number text;
begin
  if not exists (select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id) then
    raise exception 'Patient does not belong to this clinic';
  end if;

  select id into v_visit_id from visits
    where patient_id = p_patient_id and clinic_id = p_clinic_id
      and status not in ('discharged', 'cancelled', 'admitted')
    order by created_at desc limit 1;

  if v_visit_id is null then
    insert into visits (clinic_id, patient_id, visit_reason, status, registered_by)
    values (p_clinic_id, p_patient_id, p_admission_reason, 'admitted', p_created_by)
    returning id into v_visit_id;
  else
    update visits set status = 'admitted' where id = v_visit_id;
  end if;

  v_admission_number := generate_next_admission_number(p_clinic_id);

  insert into admissions (
    clinic_id, admission_number, patient_id, visit_id, source, recommended_by, admission_reason
  ) values (
    p_clinic_id, v_admission_number, p_patient_id, v_visit_id, p_source, p_created_by, p_admission_reason
  )
  returning id into v_admission_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_created_by, 'admission.recommended', 'admission', v_admission_id,
    jsonb_build_object('admission_number', v_admission_number, 'reason', p_admission_reason, 'source', p_source));

  return v_admission_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Transfer — moves an admitted patient to a different ward/bed. Frees
-- the old bed, occupies the new one, records the move for history.
-- ----------------------------------------------------------------------------
create or replace function transfer_patient(
  p_clinic_id uuid,
  p_admission_id uuid,
  p_to_ward_id uuid,
  p_to_bed_id uuid,
  p_transferred_by uuid,
  p_reason text
)
returns void
language plpgsql
as $$
declare
  v_admission record;
  v_new_bed_status bed_status;
begin
  select * into v_admission from admissions
    where id = p_admission_id and clinic_id = p_clinic_id
    for update;

  if v_admission.id is null then
    raise exception 'Admission does not belong to this clinic';
  end if;
  if v_admission.status <> 'admitted' then
    raise exception 'Only an admitted patient can be transferred (current status: %)', v_admission.status;
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to transfer a patient';
  end if;

  select status into v_new_bed_status from beds
    where id = p_to_bed_id and ward_id = p_to_ward_id and clinic_id = p_clinic_id
    for update;
  if v_new_bed_status is null then
    raise exception 'Destination bed not found in this ward for this clinic';
  end if;
  if v_new_bed_status <> 'available' then
    raise exception 'Destination bed is not available (current status: %)', v_new_bed_status;
  end if;

  if v_admission.bed_id is not null then
    update beds set status = 'available' where id = v_admission.bed_id;
  end if;
  update beds set status = 'occupied' where id = p_to_bed_id;

  insert into admission_transfers (
    clinic_id, admission_id, from_ward_id, from_bed_id, to_ward_id, to_bed_id, reason, transferred_by
  ) values (
    p_clinic_id, p_admission_id, v_admission.ward_id, v_admission.bed_id, p_to_ward_id, p_to_bed_id, p_reason, p_transferred_by
  );

  update admissions set ward_id = p_to_ward_id, bed_id = p_to_bed_id where id = p_admission_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_transferred_by, 'admission.transferred', 'admission', p_admission_id,
    jsonb_build_object('to_ward_id', p_to_ward_id, 'to_bed_id', p_to_bed_id, 'reason', p_reason));
end;
$$;

-- ----------------------------------------------------------------------------
-- Inpatient care notes — the running log behind the "Care" panel.
-- ----------------------------------------------------------------------------
create or replace function record_inpatient_note(
  p_clinic_id uuid,
  p_admission_id uuid,
  p_recorded_by uuid,
  p_note text
)
returns uuid
language plpgsql
as $$
declare
  v_note_id uuid;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted') then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;
  if p_note is null or trim(p_note) = '' then
    raise exception 'Note cannot be empty';
  end if;

  insert into inpatient_notes (clinic_id, admission_id, recorded_by, note)
  values (p_clinic_id, p_admission_id, p_recorded_by, p_note)
  returning id into v_note_id;

  return v_note_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Discharge, rebuilt: discharge_type + outcome, and auto-accrued
-- inpatient charges — nights stayed × the ward's daily rate, computed
-- and billed in full at discharge (see file header for why this isn't
-- a true nightly cron accrual).
--
-- IMPORTANT: explicitly dropping the OLD 4-argument version first. The
-- new version's extra 2 params both have defaults, which means a
-- 4-argument call would otherwise match BOTH the old and new versions
-- ambiguously — the exact bug already hit once this session with
-- record_stock_movement. Not repeating it.
-- ----------------------------------------------------------------------------
drop function if exists discharge_patient(uuid, uuid, uuid, text);

create or replace function discharge_patient(
  p_clinic_id uuid,
  p_admission_id uuid,
  p_discharged_by uuid,
  p_discharge_summary text,
  p_discharge_type text default 'routine',
  p_outcome text default null
)
returns void
language plpgsql
as $$
declare
  v_admission record;
  v_ward record;
  v_nights int;
  v_amount numeric(10,2);
  v_charge_id uuid;
begin
  select * into v_admission from admissions
    where id = p_admission_id and clinic_id = p_clinic_id
    for update;

  if v_admission.id is null then
    raise exception 'Admission does not belong to this clinic';
  end if;
  if v_admission.status <> 'admitted' then
    raise exception 'Only an admitted patient can be discharged (current status: %)', v_admission.status;
  end if;
  if p_discharge_summary is null or trim(p_discharge_summary) = '' then
    raise exception 'A discharge summary is required';
  end if;
  if p_discharge_type not in ('routine', 'transfer_out', 'against_medical_advice', 'deceased') then
    raise exception 'Invalid discharge type: %', p_discharge_type;
  end if;

  if v_admission.bed_id is not null then
    update beds set status = 'available' where id = v_admission.bed_id;
  end if;

  if v_admission.ward_id is not null then
    select * into v_ward from wards where id = v_admission.ward_id;
    if v_ward.daily_rate_xaf is not null and v_ward.daily_rate_xaf > 0 then
      v_nights := greatest(1, ceil(extract(epoch from (now() - v_admission.bed_assigned_at)) / 86400)::int);
      v_amount := v_nights * v_ward.daily_rate_xaf;

      v_charge_id := create_service_charge(
        p_clinic_id, v_admission.patient_id, v_admission.visit_id, null, 'consultation',
        'Frais d''hospitalisation — ' || v_nights || ' nuit(s) en ' || v_ward.name,
        v_amount, p_discharged_by
      );
      perform open_invoice_for_charge(v_charge_id, p_discharged_by);
    end if;
  end if;

  update admissions set
    status = 'discharged',
    discharge_summary = p_discharge_summary,
    discharge_type = p_discharge_type,
    discharge_outcome = p_outcome,
    discharged_by = p_discharged_by,
    discharged_at = now()
  where id = p_admission_id;

  update visits set status = 'discharged' where id = v_admission.visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_discharged_by, 'admission.discharged', 'admission', p_admission_id,
    jsonb_build_object('discharge_summary', p_discharge_summary, 'discharge_type', p_discharge_type, 'outcome', p_outcome));
end;
$$;
