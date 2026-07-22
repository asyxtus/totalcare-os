-- ============================================================================
-- MAR SAFETY CHECK: CANNOT LOG "ADMINISTERED" AHEAD OF PHARMACY DISPENSING
--
-- Gap found this session: record_medication_administration() let a nurse
-- log a dose as 'administered' with zero check against dispensing_records.
-- MARTab.tsx showed the "Log Administration" button on every prescribed
-- item regardless of whether pharmacy had dispensed anything against it.
--
-- Fix, at the DB layer (the only layer that can actually be trusted):
-- before inserting a status = 'administered' row, compare how many doses
-- have already been marked administered against how many units pharmacy
-- has actually dispensed for that prescription_item_id. If the nurse is
-- trying to log the Nth dose but pharmacy has dispensed fewer than N
-- units, block it.
--
-- 'refused' and 'missed' are explicitly exempt — nothing was given, so
-- there is nothing to reconcile against dispensed stock. Blocking those
-- would actively get in the way of honest charting.
-- ============================================================================

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
  v_dispensed_total int;
  v_administered_count int;
  v_drug_name text;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted') then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;
  if p_status not in ('administered', 'refused', 'missed') then
    raise exception 'Invalid administration status: %', p_status;
  end if;

  if p_status = 'administered' then
    select coalesce(sum(dr.quantity_dispensed), 0) into v_dispensed_total
    from dispensing_records dr
    where dr.prescription_item_id = p_prescription_item_id;

    select count(*) into v_administered_count
    from medication_administrations ma
    where ma.prescription_item_id = p_prescription_item_id
      and ma.status = 'administered';

    if v_administered_count >= v_dispensed_total then
      select coalesce(pi.drug_name_freetext, pr.name, 'This medication')
        into v_drug_name
      from prescription_items pi
      left join products pr on pr.id = pi.product_id
      where pi.id = p_prescription_item_id;

      raise exception '% has not been dispensed by the pharmacy yet — % of % dispensed doses already logged as administered. Send the prescription to Dispensing before charting this dose.',
        v_drug_name, v_administered_count, v_dispensed_total;
    end if;
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
