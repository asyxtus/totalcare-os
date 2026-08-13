-- Patient insurance maintenance for the patient edit workflow.
-- Keeps insurance coverage separate from the demographic patient record.

ALTER TABLE patient_insurance
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION set_patient_insurance_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_insurance_updated_at ON patient_insurance;
CREATE TRIGGER patient_insurance_updated_at
BEFORE UPDATE ON patient_insurance
FOR EACH ROW EXECUTE FUNCTION set_patient_insurance_updated_at();

-- At most one active coverage record per patient. Historical/inactive
-- records remain available for claims and audit purposes.
CREATE UNIQUE INDEX IF NOT EXISTS patient_insurance_one_active_idx
ON patient_insurance (clinic_id, patient_id)
WHERE status = 'active';

-- The application updates insurance through the authenticated user's
-- clinic context. RLS must therefore permit update/delete for staff who
-- can already view the patient's clinic records.
DROP POLICY IF EXISTS patient_insurance_update_staff ON patient_insurance;
CREATE POLICY patient_insurance_update_staff
ON patient_insurance
FOR UPDATE
USING (clinic_id = public.current_staff_clinic_id())
WITH CHECK (clinic_id = public.current_staff_clinic_id());

DROP POLICY IF EXISTS patient_insurance_delete_staff ON patient_insurance;
CREATE POLICY patient_insurance_delete_staff
ON patient_insurance
FOR DELETE
USING (clinic_id = public.current_staff_clinic_id());
