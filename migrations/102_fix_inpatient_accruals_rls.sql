-- ============================================================================
-- FIX: inpatient_daily_accruals missing INSERT policy
--
-- Migration 96 created this table with only a SELECT policy, with a comment
-- explaining that the nightly accrue_nightly_inpatient_charges() function is
-- SECURITY DEFINER and therefore bypasses RLS for its writes.
--
-- What was missed: discharge_patient() also writes to this table (to record
-- the same-day minimum accrual when a patient is discharged on the day of
-- admission), and discharge_patient() is NOT SECURITY DEFINER — it runs as
-- the authenticated caller. So that insert is blocked by RLS.
--
-- Fix: add an INSERT policy scoped to the caller's own clinic, matching the
-- pattern every other clinical table uses.
-- ============================================================================

create policy inpatient_daily_accruals_insert on inpatient_daily_accruals
  for insert with check (clinic_id = current_staff_clinic_id());

-- While here: the UPDATE that sets room_charge_id and nursing_charge_id after
-- creating the charges also runs as the caller in discharge scenarios.
create policy inpatient_daily_accruals_update on inpatient_daily_accruals
  for update using (clinic_id = current_staff_clinic_id());
