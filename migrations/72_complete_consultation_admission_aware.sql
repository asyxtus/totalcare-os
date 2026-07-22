-- ============================================================================
-- PATCH: complete_consultation AWARE OF ADMISSION
-- Admission takes priority over lab, pharmacy, and discharge — it's the
-- most severe outcome a consultation can produce. If a doctor
-- recommends admission, that's where the visit goes, regardless of
-- what else was also ordered in the same consultation.
-- ============================================================================

create or replace function complete_consultation(
  p_visit_id uuid,
  p_consultation_id uuid,
  p_staff_id uuid,
  p_has_prescription boolean,
  p_has_lab_order boolean default false,
  p_has_admission boolean default false
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

  -- Admission is handled by recommend_admission() separately (it needs
  -- its own reason text and admission-number generation) — this
  -- function just needs to NOT override that status once it's been set.
  -- If p_has_admission is true, recommend_admission() has already run
  -- and set status = 'admitted', so skip the routing logic entirely.
  if not p_has_admission then
    update visits set status = case
      when p_has_lab_order then 'waiting_lab'
      when p_has_prescription then 'waiting_pharmacy'
      else 'discharged'
    end::visit_status
    where id = p_visit_id;
  end if;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_visit.clinic_id, p_staff_id, 'visit.consultation_completed', 'visit', p_visit_id,
    jsonb_build_object('has_prescription', p_has_prescription, 'has_lab_order', p_has_lab_order, 'has_admission', p_has_admission));
end;
$$;
