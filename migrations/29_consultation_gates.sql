-- ============================================================================
-- CLINICAL PATCH: CONSULTATION LIFECYCLE GATES
-- Same pattern as advance_past_reception and complete_triage: one
-- sanctioned function per stage transition. start_consultation marks a
-- doctor as actively seeing the patient; complete_consultation routes
-- the visit onward based on whether a prescription was actually written —
-- to pharmacy if so, straight to discharge if not (no lab/admission path
-- yet, since those modules don't exist).
-- ============================================================================

create or replace function start_consultation(
  p_visit_id uuid,
  p_doctor_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_visit record;
  v_consultation_id uuid;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'waiting_consultation' then
    raise exception 'Visit is not waiting for consultation (currently: %)', v_visit.status;
  end if;

  update visits set status = 'in_consultation', assigned_doctor_id = p_doctor_id where id = p_visit_id;

  insert into consultations (clinic_id, visit_id, doctor_id, started_at)
  values (v_visit.clinic_id, p_visit_id, p_doctor_id, now())
  returning id into v_consultation_id;

  return v_consultation_id;
end;
$$;

create or replace function complete_consultation(
  p_visit_id uuid,
  p_consultation_id uuid,
  p_staff_id uuid,
  p_has_prescription boolean
)
returns void
language plpgsql
as $$
declare
  v_visit record;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'in_consultation' then
    raise exception 'Visit is not currently in consultation (status: %)', v_visit.status;
  end if;

  update consultations set completed_at = now() where id = p_consultation_id;

  update visits set status = case
    when p_has_prescription then 'waiting_pharmacy'
    else 'discharged'
  end::visit_status
  where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_visit.clinic_id, p_staff_id, 'visit.consultation_completed', 'visit', p_visit_id,
    jsonb_build_object('has_prescription', p_has_prescription));
end;
$$;
