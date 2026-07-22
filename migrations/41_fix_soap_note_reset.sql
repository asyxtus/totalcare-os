-- ============================================================================
-- PATCH: FIX SOAP NOTE RESET ON RETURN-FROM-LAB
-- Previously, start_consultation always created a brand new consultation
-- row, which meant a doctor's SOAP note from before the lab order was
-- effectively invisible when the patient returned — still in the
-- database, but the form started blank with no way to see it.
--
-- Fix: if this visit already has a completed consultation (meaning this
-- IS a return trip, not a first encounter), reopen THAT row instead of
-- creating a new one. The doctor's original S/O/A/P is still right
-- there to build on, not lost.
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
  v_existing_consultation_id uuid;
  v_doctor_role staff_role;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'waiting_consultation' then
    raise exception 'Visit is not waiting for consultation (currently: %)', v_visit.status;
  end if;

  if v_visit.assigned_doctor_id is not null and v_visit.assigned_doctor_id <> p_doctor_id then
    select role into v_doctor_role from staff where id = p_doctor_id and clinic_id = v_visit.clinic_id;
    if v_doctor_role <> 'admin' then
      raise exception 'This patient is assigned to a different doctor';
    end if;
  end if;

  -- Look for a previously completed consultation on THIS visit — this is
  -- what a return-from-lab trip looks like. Reopen it rather than
  -- starting fresh.
  select id into v_existing_consultation_id
  from consultations
  where visit_id = p_visit_id and completed_at is not null
  order by started_at desc
  limit 1;

  if v_existing_consultation_id is not null then
    update consultations set completed_at = null where id = v_existing_consultation_id;
    v_consultation_id := v_existing_consultation_id;
  else
    insert into consultations (clinic_id, visit_id, doctor_id, started_at)
    values (v_visit.clinic_id, p_visit_id, p_doctor_id, now())
    returning id into v_consultation_id;
  end if;

  update visits set status = 'in_consultation', assigned_doctor_id = p_doctor_id where id = p_visit_id;

  return v_consultation_id;
end;
$$;
