-- ============================================================================
-- DISCHARGE — closes the loop. Without this, a bed assigned once could
-- never become available again, making the whole module untestable
-- beyond the first admission. Minimal but real: frees the bed, closes
-- the admission, returns the visit to discharged status.
-- ============================================================================

create or replace function discharge_patient(
  p_clinic_id uuid,
  p_admission_id uuid,
  p_discharged_by uuid,
  p_discharge_summary text
)
returns void
language plpgsql
as $$
declare
  v_admission record;
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

  if v_admission.bed_id is not null then
    update beds set status = 'available' where id = v_admission.bed_id;
  end if;

  update admissions set
    status = 'discharged',
    discharge_summary = p_discharge_summary,
    discharged_by = p_discharged_by,
    discharged_at = now()
  where id = p_admission_id;

  update visits set status = 'discharged' where id = v_admission.visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_discharged_by, 'admission.discharged', 'admission', p_admission_id,
    jsonb_build_object('discharge_summary', p_discharge_summary));
end;
$$;
