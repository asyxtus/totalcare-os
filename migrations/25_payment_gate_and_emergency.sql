-- ============================================================================
-- BILLING/CLINICAL PATCH: PAYMENT GATE + EMERGENCY BYPASS
-- Implements the corrected flow: payment happens at reception, BEFORE a
-- patient proceeds to triage — except emergencies, which bypass payment
-- but never bypass the charge itself (the charge still exists, it's just
-- allowed to remain unpaid until later). Every emergency bypass is
-- logged, reason mandatory, no silent overrides.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend visits with emergency tracking
-- ----------------------------------------------------------------------------
alter table visits add column is_emergency boolean not null default false;
alter table visits add column emergency_reason text;
alter table visits add column emergency_flagged_by uuid references staff(id);
alter table visits add column emergency_flagged_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2. register_visit_with_charge() — replaces plain visit creation.
-- Creates the visit AND its consultation charge together, atomically.
-- The visit starts in 'registered' status, which now specifically means
-- "not yet cleared to proceed" — the payment gate function below is what
-- moves it forward.
-- ----------------------------------------------------------------------------
create or replace function register_visit_with_charge(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_visit_reason text,
  p_service_price_id uuid,
  p_registered_by uuid
)
returns table (visit_id uuid, service_charge_id uuid, amount_xaf numeric)
language plpgsql
as $$
declare
  v_visit_id uuid;
  v_charge_id uuid;
  v_amount numeric(10,2);
  v_service_name text;
begin
  select price_xaf, service_name into v_amount, v_service_name
  from service_prices where id = p_service_price_id and clinic_id = p_clinic_id;

  if v_amount is null then
    raise exception 'Service price % not found for this clinic', p_service_price_id;
  end if;

  insert into visits (clinic_id, patient_id, visit_reason, status, registered_by)
  values (p_clinic_id, p_patient_id, p_visit_reason, 'registered', p_registered_by)
  returning id into v_visit_id;

  v_charge_id := create_service_charge(
    p_clinic_id, p_patient_id, v_visit_id, p_service_price_id,
    'consultation', v_service_name, v_amount, p_registered_by
  );

  return query select v_visit_id, v_charge_id, v_amount;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. flag_visit_emergency() — any active staff member can flag this.
-- Deliberate choice: an emergency should never wait on administrative
-- approval to proceed — that's a patient-safety risk far worse than the
-- fraud risk of a false emergency flag. The counterbalance is that this
-- is NEVER silent: mandatory reason, full audit trail, and every flagged
-- visit stays queryable for later review (a report showing emergency
-- flags per staff member is a natural next step, not built yet).
-- ----------------------------------------------------------------------------
create or replace function flag_visit_emergency(
  p_visit_id uuid,
  p_flagged_by uuid,
  p_reason text
)
returns void
language plpgsql
as $$
declare
  v_clinic_id uuid;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to flag a visit as emergency';
  end if;

  select clinic_id into v_clinic_id from visits where id = p_visit_id;
  if v_clinic_id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;

  update visits set
    is_emergency = true,
    emergency_reason = p_reason,
    emergency_flagged_by = p_flagged_by,
    emergency_flagged_at = now()
  where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_clinic_id, p_flagged_by, 'visit.emergency_flagged', 'visit', p_visit_id,
    jsonb_build_object('reason', p_reason));
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. advance_past_reception() — THE PAYMENT GATE.
-- The only way a visit moves from 'registered' to 'triage'. Checks the
-- consultation charge is fully paid, OR the visit is flagged emergency.
-- Nothing else can move a visit out of 'registered' — this function is
-- the single enforcement point, not a rule scattered across the frontend.
-- ----------------------------------------------------------------------------
create or replace function advance_past_reception(
  p_visit_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
as $$
declare
  v_visit record;
  v_charge record;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'registered' then
    raise exception 'Visit is not in registered status (currently: %)', v_visit.status;
  end if;

  if not v_visit.is_emergency then
    select * into v_charge from service_charges
      where visit_id = p_visit_id and category = 'consultation' and status <> 'void'
      order by created_at desc limit 1;

    if v_charge.id is null then
      raise exception 'No consultation charge found for this visit — cannot proceed without one';
    end if;
    if v_charge.status <> 'paid' then
      raise exception 'Consultation charge is not fully paid (status: %). Collect payment, or flag this visit as emergency.', v_charge.status;
    end if;
  end if;

  update visits set status = 'triage' where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_visit.clinic_id, p_staff_id, 'visit.advanced_past_reception', 'visit', p_visit_id,
    jsonb_build_object('was_emergency', v_visit.is_emergency));
end;
$$;
