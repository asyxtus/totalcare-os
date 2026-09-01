-- ============================================================================
-- 161 — ENRICH ENCOUNTER JOURNEY WITH NEXT STAGE / NEXT ACTION / TASK STATE
--
-- Keeps visits.status as the canonical current location. Adds derived
-- next-stage guidance and module-specific task state without mutating data.
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
  v_next_stage text;
  v_next_stage_label_fr text;
  v_next_stage_label_en text;
  v_next_action_fr text;
  v_next_action_en text;
  v_is_terminal boolean := false;

  v_prescription_count integer := 0;
  v_prescription_remaining integer := 0;
  v_prescription_review_pending integer := 0;
  v_prescription_ready integer := 0;
  v_prescription_fully_dispensed integer := 0;

  v_lab_count integer := 0;
  v_lab_pending integer := 0;
  v_lab_ready integer := 0;
  v_lab_unpaid integer := 0;
  v_lab_deferred integer := 0;
  v_lab_completed integer := 0;

  v_outstanding numeric := 0;
  v_pharmacy_outstanding numeric := 0;
  v_pharmacy_paid numeric := 0;
  v_pharmacy_charge_count integer := 0;
  v_pharmacy_dispensed_count integer := 0;

  v_pharmacy_state text := 'none';
  v_lab_state text := 'none';
  v_billing_state text := 'settled';
  v_next_module text := null;
  v_blocked_reason_fr text := null;
  v_blocked_reason_en text := null;
begin
  select id, clinic_id, patient_id, status, is_emergency
    into v_visit
  from public.visits
  where id = p_visit_id;

  if not found then
    raise exception 'Encounter % not found', p_visit_id;
  end if;

  v_stage := v_visit.status::text;

  case v_stage
    when 'registered' then
      v_stage_label_fr := 'Réception'; v_stage_label_en := 'Reception';
      v_action_fr := 'Enregistrement / paiement de la consultation'; v_action_en := 'Registration / consultation payment';
    when 'triage' then
      v_stage_label_fr := 'Triage'; v_stage_label_en := 'Triage';
      v_action_fr := 'Triage en cours'; v_action_en := 'Triage in progress';
    when 'waiting_consultation' then
      v_stage_label_fr := 'Consultation'; v_stage_label_en := 'Consultation';
      v_action_fr := 'En attente du médecin'; v_action_en := 'Waiting for doctor';
    when 'in_consultation' then
      v_stage_label_fr := 'Consultation'; v_stage_label_en := 'Consultation';
      v_action_fr := 'Consultation en cours'; v_action_en := 'Consultation in progress';
    when 'waiting_lab' then
      v_stage_label_fr := 'Laboratoire'; v_stage_label_en := 'Laboratory';
      v_action_fr := 'Examens de laboratoire en attente'; v_action_en := 'Laboratory investigations pending';
    when 'waiting_pharmacy' then
      v_stage_label_fr := 'Pharmacie'; v_stage_label_en := 'Pharmacy';
      v_action_fr := 'Prise en charge par la pharmacie'; v_action_en := 'Pharmacy action pending';
    when 'billing' then
      v_stage_label_fr := 'Facturation'; v_stage_label_en := 'Billing';
      v_action_fr := 'Solde / facturation à régulariser'; v_action_en := 'Outstanding billing';
    when 'admitted' then
      v_stage_label_fr := 'Hospitalisation'; v_stage_label_en := 'Admission';
      v_action_fr := 'Patient hospitalisé'; v_action_en := 'Patient admitted';
    when 'discharged' then
      v_stage_label_fr := 'Terminé'; v_stage_label_en := 'Completed';
      v_action_fr := 'Parcours terminé'; v_action_en := 'Journey completed';
      v_is_terminal := true;
    when 'cancelled' then
      v_stage_label_fr := 'Annulé'; v_stage_label_en := 'Cancelled';
      v_action_fr := 'Parcours annulé'; v_action_en := 'Journey cancelled';
      v_is_terminal := true;
    else
      v_stage_label_fr := v_stage; v_stage_label_en := v_stage;
      v_action_fr := v_stage; v_action_en := v_stage;
  end case;

  -- Pharmacy / prescription task state.
  select
    count(*),
    coalesce(sum(greatest(pi.quantity_prescribed - coalesce(pi.quantity_dispensed, 0), 0)), 0),
    count(*) filter (where coalesce(p.requires_review, false)),
    count(*) filter (where not coalesce(p.requires_review, false)
                     and greatest(pi.quantity_prescribed - coalesce(pi.quantity_dispensed, 0), 0) > 0),
    count(*) filter (where greatest(pi.quantity_prescribed - coalesce(pi.quantity_dispensed, 0), 0) = 0)
  into v_prescription_count, v_prescription_remaining, v_prescription_review_pending,
       v_prescription_ready, v_prescription_fully_dispensed
  from public.prescriptions p
  join public.prescription_items pi on pi.prescription_id = p.id
  where p.visit_id = p_visit_id and p.status <> 'cancelled';

  -- Pharmacy charges are informational here. The resolver never creates or
  -- changes financial records.
  select count(*),
         coalesce(sum(greatest(sc.amount_xaf - coalesce(sc.amount_paid_xaf, 0), 0)), 0),
         coalesce(sum(least(sc.amount_xaf, coalesce(sc.amount_paid_xaf, 0))), 0)
    into v_pharmacy_charge_count, v_pharmacy_outstanding, v_pharmacy_paid
  from public.service_charges sc
  where sc.visit_id = p_visit_id
    and sc.category = 'pharmacy'
    and sc.status <> 'void';

  select count(*)
    into v_pharmacy_dispensed_count
  from public.dispensing_records dr
  join public.prescription_items pi on pi.id = dr.prescription_item_id
  join public.prescriptions p on p.id = pi.prescription_id
  where p.visit_id = p_visit_id;

  if v_prescription_count = 0 then
    v_pharmacy_state := 'none';
  elsif v_prescription_remaining = 0 then
    v_pharmacy_state := 'completed';
  elsif v_prescription_review_pending > 0 then
    v_pharmacy_state := 'awaiting_review';
  elsif v_pharmacy_outstanding > 0 then
    v_pharmacy_state := 'awaiting_payment';
  else
    v_pharmacy_state := 'ready_to_dispense';
  end if;

  -- Laboratory task state. lab_order_items.billing_status is deliberately
  -- treated as text so this resolver does not guess enum values.
  select count(*),
         count(*) filter (where loi.status::text = 'pending'),
         count(*) filter (where loi.status::text in ('sample_collected', 'completed')),
         count(*) filter (where coalesce(loi.billing_status::text, '') in ('unpaid', 'pending')),
         count(*) filter (where loi.billing_status::text = 'deferred'),
         count(*) filter (where loi.status::text = 'completed')
    into v_lab_count, v_lab_pending, v_lab_ready, v_lab_unpaid, v_lab_deferred, v_lab_completed
  from public.lab_orders lo
  join public.lab_order_items loi on loi.lab_order_id = lo.id
  where lo.visit_id = p_visit_id;

  if v_lab_count = 0 then
    v_lab_state := 'none';
  elsif v_lab_completed = v_lab_count then
    v_lab_state := 'completed';
  elsif v_lab_unpaid > 0 and v_lab_ready = 0 then
    v_lab_state := 'awaiting_payment';
  elsif v_lab_deferred > 0 and v_lab_ready = 0 then
    v_lab_state := 'deferred';
  else
    v_lab_state := 'in_progress';
  end if;

  select coalesce(sum(greatest(sc.amount_xaf - coalesce(sc.amount_paid_xaf, 0), 0)), 0)
    into v_outstanding
  from public.service_charges sc
  where sc.visit_id = p_visit_id and sc.status <> 'void';

  if v_outstanding > 0 then
    v_billing_state := 'outstanding';
  else
    v_billing_state := 'settled';
  end if;

  -- Determine the next operational destination. This is intentionally
  -- derived, not persisted, so it cannot become stale independently of the
  -- encounter records.
  if v_stage = 'in_consultation' then
    if v_lab_count > 0 then
      v_next_stage := 'waiting_lab';
      v_next_stage_label_fr := 'Laboratoire'; v_next_stage_label_en := 'Laboratory';
      v_next_action_fr := 'Examens de laboratoire à effectuer'; v_next_action_en := 'Laboratory investigations to complete';
      v_next_module := 'laboratory';
    elsif v_prescription_count > 0 then
      v_next_stage := 'waiting_pharmacy';
      v_next_stage_label_fr := 'Pharmacie'; v_next_stage_label_en := 'Pharmacy';
      v_next_action_fr := 'Ordonnance à prendre en charge'; v_next_action_en := 'Prescription to process';
      v_next_module := 'pharmacy';
    elsif v_outstanding > 0 then
      v_next_stage := 'billing';
      v_next_stage_label_fr := 'Facturation'; v_next_stage_label_en := 'Billing';
      v_next_action_fr := 'Paiement du solde requis'; v_next_action_en := 'Outstanding payment required';
      v_next_module := 'billing';
    else
      v_next_stage := 'discharged';
      v_next_stage_label_fr := 'Terminé'; v_next_stage_label_en := 'Completed';
      v_next_action_fr := 'Parcours prêt à être terminé'; v_next_action_en := 'Journey ready to complete';
      v_next_module := null;
    end if;
  elsif v_stage = 'waiting_lab' then
    if v_lab_state = 'completed' then
      if v_prescription_count > 0 then
        v_next_stage := 'waiting_pharmacy'; v_next_stage_label_fr := 'Pharmacie'; v_next_stage_label_en := 'Pharmacy';
        v_next_action_fr := 'Ordonnance à prendre en charge'; v_next_action_en := 'Prescription to process'; v_next_module := 'pharmacy';
      elsif v_outstanding > 0 then
        v_next_stage := 'billing'; v_next_stage_label_fr := 'Facturation'; v_next_stage_label_en := 'Billing';
        v_next_action_fr := 'Paiement du solde requis'; v_next_action_en := 'Outstanding payment required'; v_next_module := 'billing';
      end if;
    else
      v_next_stage := 'waiting_lab'; v_next_stage_label_fr := 'Laboratoire'; v_next_stage_label_en := 'Laboratory';
      v_next_action_fr := case when v_lab_state = 'awaiting_payment' then 'Paiement / activation des examens requis' else 'Examens de laboratoire à effectuer' end;
      v_next_action_en := case when v_lab_state = 'awaiting_payment' then 'Payment / activation required' else 'Laboratory investigations to complete' end;
      v_next_module := 'laboratory';
    end if;
  elsif v_stage = 'waiting_pharmacy' then
    if v_pharmacy_state = 'completed' then
      if v_outstanding > 0 then
        v_next_stage := 'billing'; v_next_stage_label_fr := 'Facturation'; v_next_stage_label_en := 'Billing';
        v_next_action_fr := 'Paiement du solde requis'; v_next_action_en := 'Outstanding payment required'; v_next_module := 'billing';
      else
        v_next_stage := 'discharged'; v_next_stage_label_fr := 'Terminé'; v_next_stage_label_en := 'Completed';
        v_next_action_fr := 'Parcours prêt à être terminé'; v_next_action_en := 'Journey ready to complete'; v_next_module := null;
      end if;
    else
      v_next_stage := 'waiting_pharmacy'; v_next_stage_label_fr := 'Pharmacie'; v_next_stage_label_en := 'Pharmacy';
      v_next_module := 'pharmacy';
      case v_pharmacy_state
        when 'awaiting_review' then v_next_action_fr := 'Validation de l’ordonnance requise'; v_next_action_en := 'Prescription review required';
        when 'awaiting_payment' then v_next_action_fr := 'Paiement requis avant délivrance'; v_next_action_en := 'Payment required before dispensing';
        when 'ready_to_dispense' then v_next_action_fr := 'Prêt à être dispensé'; v_next_action_en := 'Ready to dispense';
        else v_next_action_fr := 'Prise en charge par la pharmacie'; v_next_action_en := 'Pharmacy action pending';
      end case;
    end if;
  elsif v_stage = 'billing' then
    if v_outstanding > 0 then
      v_next_stage := 'billing'; v_next_stage_label_fr := 'Facturation'; v_next_stage_label_en := 'Billing';
      v_next_action_fr := 'Paiement du solde requis'; v_next_action_en := 'Outstanding payment required'; v_next_module := 'billing';
    else
      v_next_stage := 'discharged'; v_next_stage_label_fr := 'Terminé'; v_next_stage_label_en := 'Completed';
      v_next_action_fr := 'Parcours prêt à être terminé'; v_next_action_en := 'Journey ready to complete'; v_next_module := null;
    end if;
  elsif v_stage = 'discharged' or v_stage = 'cancelled' then
    v_next_stage := null; v_next_stage_label_fr := null; v_next_stage_label_en := null;
    v_next_action_fr := null; v_next_action_en := null; v_next_module := null;
  else
    v_next_stage := v_stage;
    v_next_stage_label_fr := v_stage_label_fr; v_next_stage_label_en := v_stage_label_en;
    v_next_action_fr := v_action_fr; v_next_action_en := v_action_en;
    v_next_module := case when v_stage = 'triage' then 'triage' when v_stage in ('waiting_consultation','in_consultation') then 'doctor' else null end;
  end if;

  -- Appointment guard explanation: an active encounter is not itself an
  -- error; it is a workflow fact that Reception should be able to explain.
  if not v_is_terminal then
    v_blocked_reason_fr := 'Le patient a encore un parcours actif : ' || v_stage_label_fr || '.';
    v_blocked_reason_en := 'The patient still has an active encounter: ' || v_stage_label_en || '.';
  end if;

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
    'next_stage', v_next_stage,
    'next_stage_label_fr', v_next_stage_label_fr,
    'next_stage_label_en', v_next_stage_label_en,
    'next_action_fr', v_next_action_fr,
    'next_action_en', v_next_action_en,
    'next_module', v_next_module,
    'pharmacy', jsonb_build_object(
      'state', v_pharmacy_state,
      'prescription_item_count', v_prescription_count,
      'remaining_item_quantity', v_prescription_remaining,
      'review_pending_count', v_prescription_review_pending,
      'ready_count', v_prescription_ready,
      'fully_dispensed_count', v_prescription_fully_dispensed,
      'charge_count', v_pharmacy_charge_count,
      'outstanding_xaf', v_pharmacy_outstanding,
      'paid_xaf', v_pharmacy_paid,
      'dispensed_record_count', v_pharmacy_dispensed_count
    ),
    'laboratory', jsonb_build_object(
      'state', v_lab_state,
      'item_count', v_lab_count,
      'pending_count', v_lab_pending,
      'ready_or_completed_count', v_lab_ready,
      'unpaid_count', v_lab_unpaid,
      'deferred_count', v_lab_deferred,
      'completed_count', v_lab_completed
    ),
    'billing', jsonb_build_object(
      'state', v_billing_state,
      'outstanding_xaf', v_outstanding
    ),
    'appointment', jsonb_build_object(
      'active_encounter', not v_is_terminal,
      'can_explain_block', not v_is_terminal,
      'blocked_reason_fr', v_blocked_reason_fr,
      'blocked_reason_en', v_blocked_reason_en
    )
  );
end;
$$;

comment on function public.get_encounter_journey(uuid) is
  'Canonical encounter journey resolver. Uses visits.status as current location and derives next stage, next action, pharmacy/laboratory/billing task state and appointment explanation without mutating records.';

grant execute on function public.get_encounter_journey(uuid) to authenticated;
revoke execute on function public.get_encounter_journey(uuid) from anon;
