-- ============================================================================
-- 160 — SINGLE ENCOUNTER JOURNEY / STATUS RESOLVER
--
-- The visit status remains the canonical encounter location. This resolver
-- adds a single, consistent interpretation of that status for every module.
-- It deliberately derives detail from existing clinical/financial records;
-- it does not create a second competing patient-status state machine.
-- ============================================================================

create or replace function public.get_encounter_journey(p_visit_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_visit record;
  v_stage text;
  v_stage_label_fr text;
  v_stage_label_en text;
  v_action_fr text;
  v_action_en text;
  v_is_terminal boolean := false;
  v_prescription_count integer := 0;
  v_prescription_remaining integer := 0;
  v_lab_count integer := 0;
  v_lab_pending integer := 0;
  v_lab_ready integer := 0;
  v_outstanding numeric := 0;
begin
  select id, clinic_id, patient_id, status, is_emergency
    into v_visit
  from public.visits
  where id = p_visit_id;

  if not found then
    raise exception 'Encounter % not found', p_visit_id;
  end if;

  -- The visit status is the canonical physical/workflow location.
  v_stage := v_visit.status::text;

  case v_stage
    when 'registered' then
      v_stage_label_fr := 'Réception';
      v_stage_label_en := 'Reception';
      v_action_fr := 'Enregistrement / paiement de la consultation';
      v_action_en := 'Registration / consultation payment';
    when 'triage' then
      v_stage_label_fr := 'Triage';
      v_stage_label_en := 'Triage';
      v_action_fr := 'Triage en cours';
      v_action_en := 'Triage in progress';
    when 'waiting_consultation' then
      v_stage_label_fr := 'Consultation';
      v_stage_label_en := 'Consultation';
      v_action_fr := 'En attente du médecin';
      v_action_en := 'Waiting for doctor';
    when 'in_consultation' then
      v_stage_label_fr := 'Consultation';
      v_stage_label_en := 'Consultation';
      v_action_fr := 'Consultation en cours';
      v_action_en := 'Consultation in progress';
    when 'waiting_lab' then
      v_stage_label_fr := 'Laboratoire';
      v_stage_label_en := 'Laboratory';
      v_action_fr := 'Examens de laboratoire en attente';
      v_action_en := 'Laboratory investigations pending';
    when 'waiting_pharmacy' then
      v_stage_label_fr := 'Pharmacie';
      v_stage_label_en := 'Pharmacy';
      v_action_fr := 'Prise en charge par la pharmacie';
      v_action_en := 'Pharmacy action pending';
    when 'billing' then
      v_stage_label_fr := 'Facturation';
      v_stage_label_en := 'Billing';
      v_action_fr := 'Solde / facturation à régulariser';
      v_action_en := 'Outstanding billing';
    when 'admitted' then
      v_stage_label_fr := 'Hospitalisation';
      v_stage_label_en := 'Admission';
      v_action_fr := 'Patient hospitalisé';
      v_action_en := 'Patient admitted';
    when 'discharged' then
      v_stage_label_fr := 'Terminé';
      v_stage_label_en := 'Completed';
      v_action_fr := 'Parcours terminé';
      v_action_en := 'Journey completed';
      v_is_terminal := true;
    when 'cancelled' then
      v_stage_label_fr := 'Annulé';
      v_stage_label_en := 'Cancelled';
      v_action_fr := 'Parcours annulé';
      v_action_en := 'Journey cancelled';
      v_is_terminal := true;
    else
      v_stage_label_fr := v_stage;
      v_stage_label_en := v_stage;
      v_action_fr := v_stage;
      v_action_en := v_stage;
  end case;

  -- Pharmacy detail. The prescription belongs to the visit, so this is safe
  -- and remains independent of the current visit status.
  select count(*),
         coalesce(sum(greatest(pi.quantity_prescribed - coalesce(pi.quantity_dispensed, 0), 0)), 0)
    into v_prescription_count, v_prescription_remaining
  from public.prescriptions p
  join public.prescription_items pi on pi.prescription_id = p.id
  where p.visit_id = p_visit_id
    and p.status <> 'cancelled';

  -- Laboratory detail. Count the existing order items; do not create or
  -- duplicate orders merely to calculate the journey.
  select count(*),
         count(*) filter (where loi.status = 'pending'),
         count(*) filter (where loi.status in ('sample_collected', 'completed'))
    into v_lab_count, v_lab_pending, v_lab_ready
  from public.lab_orders lo
  join public.lab_order_items loi on loi.lab_order_id = lo.id
  where lo.visit_id = p_visit_id;

  -- Financial context is informational only; the resolver never creates or
  -- changes a charge.
  select coalesce(sum(greatest(sc.amount_xaf - coalesce(sc.amount_paid_xaf, 0), 0)), 0)
    into v_outstanding
  from public.service_charges sc
  where sc.visit_id = p_visit_id
    and sc.status <> 'void';

  return jsonb_build_object(
    'visit_id', v_visit.id,
    'patient_id', v_visit.patient_id,
    'clinic_id', v_visit.clinic_id,
    'is_emergency', v_visit.is_emergency,
    'status', v_stage,
    'stage', v_stage,
    'stage_label_fr', v_stage_label_fr,
    'stage_label_en', v_stage_label_en,
    'current_action_fr', v_action_fr,
    'current_action_en', v_action_en,
    'is_terminal', v_is_terminal,
    'pharmacy', jsonb_build_object(
      'prescription_item_count', v_prescription_count,
      'remaining_item_quantity', v_prescription_remaining
    ),
    'laboratory', jsonb_build_object(
      'item_count', v_lab_count,
      'pending_count', v_lab_pending,
      'ready_or_completed_count', v_lab_ready
    ),
    'billing', jsonb_build_object(
      'outstanding_xaf', v_outstanding
    )
  );
end;
$$;

comment on function public.get_encounter_journey(uuid) is
  'Canonical encounter journey resolver. Uses visits.status as the source-of-truth location and derives pharmacy, laboratory and billing context without mutating data.';

grant execute on function public.get_encounter_journey(uuid) to authenticated;
revoke execute on function public.get_encounter_journey(uuid) from anon;
