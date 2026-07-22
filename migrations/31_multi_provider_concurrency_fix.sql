-- ============================================================================
-- MULTI-PROVIDER CONCURRENCY FIX
-- Two separate real gaps, both surfaced by asking "what happens with
-- multiple doctors / multiple reception staff at once":
--
-- 1. Nothing stopped two people from creating two active visits for the
--    same patient at the same time (a regression — this check existed
--    before the payment-gate rebuild and was accidentally dropped).
-- 2. Nothing stopped a doctor from opening and editing another doctor's
--    in-progress consultation — the queue and the screen both showed
--    everything clinic-wide with no ownership check.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FIX 1: one active visit per patient, enforced at the database level —
-- same pattern as the billing dedup index, not an app-layer check-then-
-- insert that a race condition could slip through.
-- ----------------------------------------------------------------------------
create unique index idx_one_active_visit_per_patient
  on visits (patient_id)
  where status not in ('discharged', 'cancelled');

-- register_visit_with_charge now catches that constraint and raises a
-- clear, friendly exception instead of a raw Postgres error.
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

  begin
    insert into visits (clinic_id, patient_id, visit_reason, status, registered_by)
    values (p_clinic_id, p_patient_id, p_visit_reason, 'registered', p_registered_by)
    returning id into v_visit_id;
  exception
    when unique_violation then
      raise exception 'This patient already has an active visit in progress — check the queue rather than starting a new one';
  end;

  v_charge_id := create_service_charge(
    p_clinic_id, p_patient_id, v_visit_id, p_service_price_id,
    'consultation', v_service_name, v_amount, p_registered_by
  );

  return query select v_visit_id, v_charge_id, v_amount;
end;
$$;

-- ----------------------------------------------------------------------------
-- FIX 2: a helper the frontend can call to verify a doctor actually owns
-- the in-progress consultation they're trying to open. Not a new gate on
-- the write functions themselves (start_consultation/complete_consultation
-- already correctly check status transitions) — this is specifically for
-- the READ side: deciding whether to even render the form.
-- ----------------------------------------------------------------------------
create or replace function is_assigned_doctor_for_visit(
  p_visit_id uuid,
  p_staff_id uuid
)
returns boolean
language sql
stable
as $$
  select coalesce(
    (select assigned_doctor_id = p_staff_id from visits where id = p_visit_id),
    false
  )
$$;
