-- ============================================================================
-- PATCH: FIX service_charges RLS GAP FOR DOCTOR/PHARMACIST
--
-- The auto-charge fraud fix (create_service_charge, called internally by
-- both dispense_prescription_item and create_lab_order) requires an
-- INSERT into service_charges. But the RLS policy only ever allowed
-- admin/receptionist/billing_clerk to insert — doctor and pharmacist
-- were never added, because every test so far used the admin account,
-- which bypasses this by being in the allowed list everywhere. A real
-- doctor ordering labs, or a real pharmacist dispensing a drug, would
-- hit an RLS rejection on their very first attempt.
--
-- Fix: split into a precise INSERT policy (doctor/pharmacist added,
-- since THEY are the ones whose actions trigger new charges) separate
-- from UPDATE (kept restricted to admin/receptionist/billing_clerk,
-- since payment collection and charge editing stay their territory,
-- not something doctor/pharmacist should freely touch beyond the
-- trusted RPC path).
-- ============================================================================

drop policy if exists service_charges_write on service_charges;

create policy service_charges_insert on service_charges for insert with check (
  clinic_id = current_staff_clinic_id()
  and current_staff_role() in ('admin', 'receptionist', 'billing_clerk', 'doctor', 'pharmacist')
);

create policy service_charges_update on service_charges for update using (
  clinic_id = current_staff_clinic_id()
  and current_staff_role() in ('admin', 'receptionist', 'billing_clerk')
) with check (
  clinic_id = current_staff_clinic_id()
  and current_staff_role() in ('admin', 'receptionist', 'billing_clerk')
);

-- ----------------------------------------------------------------------------
-- Same root cause, same fix, on invoices: open_invoice_for_charges is
-- called by a DOCTOR ordering labs (inside completeConsultation), but
-- invoices RLS never allowed doctor to insert. Split the same way —
-- insert opened up to doctor, update stays restricted to the billing
-- roles.
-- ----------------------------------------------------------------------------
drop policy if exists invoices_write on invoices;

create policy invoices_insert on invoices for insert with check (
  clinic_id = current_staff_clinic_id()
  and current_staff_role() in ('admin', 'receptionist', 'billing_clerk', 'doctor')
);

create policy invoices_update on invoices for update using (
  clinic_id = current_staff_clinic_id()
  and current_staff_role() in ('admin', 'receptionist', 'billing_clerk')
) with check (
  clinic_id = current_staff_clinic_id()
  and current_staff_role() in ('admin', 'receptionist', 'billing_clerk')
);
