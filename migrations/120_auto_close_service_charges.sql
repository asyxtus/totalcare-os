-- ============================================================================
-- AUTO-CLOSE SERVICE CHARGES WHEN PATIENT PORTION IS FULLY PAID
--
-- Problem: When a patient has insurance, the cashier collects the patient
-- portion (e.g. 600 FCFA) but the insurer portion (e.g. 2,400 FCFA) is
-- collected later via an insurance claim. The charge stays 'partial' or
-- 'pending' forever because amount_paid_xaf never reaches amount_xaf.
-- This keeps the patient in the cashier queue even though they've paid
-- everything they personally owe.
--
-- Fix: A trigger that fires on every UPDATE to service_charges. If the
-- amount paid by the patient (amount_paid_xaf) has reached their portion
-- (patient_portion_xaf, or amount_xaf if uninsured), mark the charge as
-- 'paid'. The insurer portion is tracked separately via insurance claims.
--
-- This also handles the edge case where amount_paid_xaf > patient_portion_xaf
-- (overpayment at the counter) — still marks as paid.
-- ============================================================================

create or replace function auto_close_service_charge()
returns trigger
language plpgsql
as $$
declare
  v_patient_owes numeric;
begin
  -- What does the patient personally owe on this charge?
  -- If there's an insurance split, patient_portion_xaf is set.
  -- Otherwise the full amount_xaf is the patient's responsibility.
  v_patient_owes := coalesce(NEW.patient_portion_xaf, NEW.amount_xaf);

  -- If patient has paid their full portion and status isn't already paid/cancelled
  if NEW.amount_paid_xaf >= v_patient_owes
     and NEW.status not in ('paid', 'void')
  then
    NEW.status := 'paid';
  end if;

  -- If nothing has been paid yet and status is somehow 'partial', fix it
  if NEW.amount_paid_xaf = 0 and NEW.status = 'partial' then
    NEW.status := 'pending';
  end if;

  return NEW;
end;
$$;

-- Drop existing trigger if any (safe to re-run)
drop trigger if exists trg_auto_close_service_charge on service_charges;

create trigger trg_auto_close_service_charge
  before update on service_charges
  for each row
  execute function auto_close_service_charge();

-- ── Backfill: fix all existing charges where patient has paid their portion ──
-- This clears the queue for all current patients in the same situation.

update service_charges
set status = 'paid'
where status in ('pending', 'partial')
  and amount_paid_xaf >= coalesce(patient_portion_xaf, amount_xaf)
  and amount_paid_xaf > 0;

-- Report how many were fixed
do $$
declare
  v_count int;
begin
  get diagnostics v_count = row_count;
  raise notice 'Backfill: % service_charges marked as paid', v_count;
end;
$$;
