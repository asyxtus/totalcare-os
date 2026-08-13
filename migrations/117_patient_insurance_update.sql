-- Patient insurance maintenance for the patient edit workflow.
-- The insurance schema already uses is_active (not status) and already
-- provides clinic-scoped staff write RLS in migration 89.

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
