-- ============================================================================
-- PATCH: COMPLETE_CONSULTATION AWARE OF LAB ORDERS
-- If labs were ordered, the visit routes to 'waiting_lab' — this takes
-- priority over 'waiting_pharmacy' even if a prescription was ALSO
-- written (a symptomatic prescription can still be dispensed in parallel
-- while labs are pending; the visit's primary next step is the lab).
--
-- HONEST GAP, not solved here: nothing yet automatically routes a visit
-- from 'waiting_lab' back to the doctor once results are ready. That's a
-- real workflow question (does completing all lab_order_items for a
-- visit auto-flip it back to 'waiting_consultation'? does a lab tech
-- manually flag it? does the doctor just check periodically?) that
-- deserves its own decision, not a silent assumption buried in this
-- patch.
-- ============================================================================

create or replace function complete_consultation(
  p_visit_id uuid,
  p_consultation_id uuid,
  p_staff_id uuid,
  p_has_prescription boolean,
  p_has_lab_order boolean default false
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
    when p_has_lab_order then 'waiting_lab'
    when p_has_prescription then 'waiting_pharmacy'
    else 'discharged'
  end::visit_status
  where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_visit.clinic_id, p_staff_id, 'visit.consultation_completed', 'visit', p_visit_id,
    jsonb_build_object('has_prescription', p_has_prescription, 'has_lab_order', p_has_lab_order));
end;
$$;
