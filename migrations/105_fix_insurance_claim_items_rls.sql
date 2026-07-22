-- ============================================================================
-- FIX: insurance_claim_items missing INSERT policy
--
-- Migration 91 created insurance_claim_items with only a SELECT policy.
-- The create_insurance_claim() function inserts into this table as the
-- authenticated caller (not SECURITY DEFINER), so RLS blocks the insert
-- with "new row violates row-level security policy for table
-- insurance_claim_items".
--
-- Same root cause as 102_fix_inpatient_accruals_rls.sql.
-- ============================================================================

create policy insurance_claim_items_insert on insurance_claim_items
  for insert with check (
    claim_id in (
      select id from insurance_claims
      where clinic_id = current_staff_clinic_id()
    )
  );
