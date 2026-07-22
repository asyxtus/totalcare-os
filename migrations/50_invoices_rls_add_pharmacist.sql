-- ============================================================================
-- PATCH: PHARMACIST NEEDS invoices INSERT TOO
-- File 48 added 'doctor' to invoices_insert (for lab-order invoicing).
-- Now that dispense_prescription_item also creates an invoice (file 49),
-- pharmacist needs the same permission — same root cause, caught
-- immediately this time by tracing the RLS chain before shipping,
-- rather than waiting for a real pharmacist account to hit it.
-- ============================================================================

drop policy if exists invoices_insert on invoices;

create policy invoices_insert on invoices for insert with check (
  clinic_id = current_staff_clinic_id()
  and current_staff_role() in ('admin', 'receptionist', 'billing_clerk', 'doctor', 'pharmacist')
);
