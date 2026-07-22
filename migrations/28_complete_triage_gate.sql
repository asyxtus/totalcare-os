-- ============================================================================
-- CLINICAL PATCH: TRIAGE COMPLETION GATE
-- Same principle as advance_past_reception: one sanctioned function moves
-- a visit forward, and it refuses to do so if the required documentation
-- doesn't exist yet. A patient can't reach the doctor's queue without a
-- nurse having actually recorded vitals and an assessment — not because
-- the UI nags about it, but because the database won't allow the
-- transition otherwise.
-- ============================================================================

create or replace function complete_triage(
  p_visit_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
as $$
declare
  v_visit record;
  v_has_vitals boolean;
  v_has_assessment boolean;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'triage' then
    raise exception 'Visit is not in triage status (currently: %)', v_visit.status;
  end if;

  select exists(select 1 from vitals where visit_id = p_visit_id) into v_has_vitals;
  select exists(select 1 from triage_assessments where visit_id = p_visit_id) into v_has_assessment;

  if not v_has_vitals then
    raise exception 'Cannot complete triage: no vitals have been recorded for this visit';
  end if;
  if not v_has_assessment then
    raise exception 'Cannot complete triage: no assessment (chief complaint/history) has been recorded';
  end if;

  update visits set status = 'waiting_consultation' where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_visit.clinic_id, p_staff_id, 'visit.triage_completed', 'visit', p_visit_id, '{}'::jsonb);
end;
$$;
