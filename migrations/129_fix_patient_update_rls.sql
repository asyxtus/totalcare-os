-- Fix: patient editing was implemented in the application, but the
-- patients table did not have an explicit UPDATE policy for the staff
-- roles that are allowed to maintain patient demographics.
--
-- This is intentionally clinic-scoped. The application also verifies the
-- clinic, but RLS remains the final tenant-isolation boundary.

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_update_staff ON patients;

CREATE POLICY patients_update_staff
ON patients
FOR UPDATE
USING (
  clinic_id = public.current_staff_clinic_id()
  AND public.current_staff_role() IN ('admin', 'receptionist')
)
WITH CHECK (
  clinic_id = public.current_staff_clinic_id()
  AND public.current_staff_role() IN ('admin', 'receptionist')
);
