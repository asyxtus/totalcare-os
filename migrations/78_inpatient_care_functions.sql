-- ============================================================================
-- INPATIENT CARE PANEL FUNCTIONS
-- ============================================================================

create or replace function create_inpatient_prescription(
  p_clinic_id uuid,
  p_admission_id uuid,
  p_prescribed_by uuid,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_admission record;
  v_consultation_id uuid;
  v_prescription_id uuid;
  v_item jsonb;
begin
  select * into v_admission from admissions
    where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted';
  if v_admission.id is null then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;

  select id into v_consultation_id from consultations
    where visit_id = v_admission.visit_id
    order by started_at desc limit 1;

  insert into prescriptions (clinic_id, visit_id, consultation_id, doctor_id)
  values (p_clinic_id, v_admission.visit_id, v_consultation_id, p_prescribed_by)
  returning id into v_prescription_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into prescription_items (
      prescription_id, product_id, drug_name_freetext, dose, route, frequency, duration_days, instructions, quantity_prescribed
    ) values (
      v_prescription_id,
      nullif(v_item->>'product_id', '')::uuid,
      nullif(v_item->>'freetext_name', ''),
      v_item->>'dose',
      v_item->>'route',
      v_item->>'frequency',
      nullif(v_item->>'duration_days', '')::int,
      v_item->>'instructions',
      (v_item->>'quantity')::int
    );
  end loop;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_prescribed_by, 'admission.prescription_ordered', 'admission', p_admission_id,
    jsonb_build_object('prescription_id', v_prescription_id));

  return v_prescription_id;
end;
$$;

-- IMPORTANT: dropping the old 4-argument version first. The new
-- version's 5th param has a default, which would otherwise make a
-- 4-argument call match both versions ambiguously — same collision
-- pattern as discharge_patient, caught before shipping this time.
drop function if exists record_inpatient_note(uuid, uuid, uuid, text);

create or replace function record_inpatient_note(
  p_clinic_id uuid,
  p_admission_id uuid,
  p_recorded_by uuid,
  p_note text,
  p_round_type text default 'doctor_round'
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

  insert into inpatient_notes (clinic_id, admission_id, recorded_by, note, round_type)
  values (p_clinic_id, p_admission_id, p_recorded_by, p_note, p_round_type)
  returning id into v_note_id;

  return v_note_id;
end;
$$;

create or replace function record_vital_signs(
  p_clinic_id uuid,
  p_admission_id uuid,
  p_recorded_by uuid,
  p_bp_systolic int,
  p_bp_diastolic int,
  p_heart_rate int,
  p_temperature_celsius numeric,
  p_respiratory_rate int,
  p_oxygen_saturation int,
  p_notes text
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted') then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;

  insert into vital_signs (
    clinic_id, admission_id, recorded_by, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature_celsius, respiratory_rate, oxygen_saturation, notes
  ) values (
    p_clinic_id, p_admission_id, p_recorded_by, p_bp_systolic, p_bp_diastolic,
    p_heart_rate, p_temperature_celsius, p_respiratory_rate, p_oxygen_saturation, p_notes
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function record_medication_administration(
  p_clinic_id uuid,
  p_prescription_item_id uuid,
  p_admission_id uuid,
  p_administered_by uuid,
  p_status text,
  p_notes text
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted') then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;
  if p_status not in ('administered', 'refused', 'missed') then
    raise exception 'Invalid administration status: %', p_status;
  end if;

  insert into medication_administrations (
    clinic_id, prescription_item_id, admission_id, administered_by, status, notes
  ) values (
    p_clinic_id, p_prescription_item_id, p_admission_id, p_administered_by, p_status, p_notes
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function record_care_task(
  p_clinic_id uuid,
  p_admission_id uuid,
  p_completed_by uuid,
  p_task_description text
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted') then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;
  if p_task_description is null or trim(p_task_description) = '' then
    raise exception 'Task description cannot be empty';
  end if;

  insert into care_tasks (clinic_id, admission_id, completed_by, task_description)
  values (p_clinic_id, p_admission_id, p_completed_by, p_task_description)
  returning id into v_id;

  return v_id;
end;
$$;
