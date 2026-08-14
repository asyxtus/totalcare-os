-- Structured diagnoses: one consultation can have one primary diagnosis
-- and any number of secondary diagnoses. Legacy consultations.diagnosis and
-- consultations.diagnosis_code are retained for backward compatibility.

CREATE TABLE IF NOT EXISTS consultation_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  diagnosis text NOT NULL CHECK (length(trim(diagnosis)) > 0),
  icd10_code text,
  is_primary boolean NOT NULL DEFAULT false,
  sequence integer NOT NULL DEFAULT 1 CHECK (sequence > 0),
  created_by uuid REFERENCES staff(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consultation_diagnoses_consultation_idx
  ON consultation_diagnoses (consultation_id, sequence);

CREATE INDEX IF NOT EXISTS consultation_diagnoses_patient_search_idx
  ON consultation_diagnoses (clinic_id, diagnosis);

CREATE UNIQUE INDEX IF NOT EXISTS consultation_diagnoses_one_primary_idx
  ON consultation_diagnoses (consultation_id)
  WHERE is_primary = true;

CREATE UNIQUE INDEX IF NOT EXISTS consultation_diagnoses_sequence_idx
  ON consultation_diagnoses (consultation_id, sequence);

ALTER TABLE consultation_diagnoses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consultation_diagnoses_select_staff ON consultation_diagnoses;
CREATE POLICY consultation_diagnoses_select_staff
ON consultation_diagnoses FOR SELECT
USING (clinic_id = public.current_staff_clinic_id());

DROP POLICY IF EXISTS consultation_diagnoses_insert_staff ON consultation_diagnoses;
CREATE POLICY consultation_diagnoses_insert_staff
ON consultation_diagnoses FOR INSERT
WITH CHECK (
  clinic_id = public.current_staff_clinic_id()
  AND public.current_staff_role() IN ('admin', 'doctor')
);

DROP POLICY IF EXISTS consultation_diagnoses_update_staff ON consultation_diagnoses;
CREATE POLICY consultation_diagnoses_update_staff
ON consultation_diagnoses FOR UPDATE
USING (
  clinic_id = public.current_staff_clinic_id()
  AND public.current_staff_role() IN ('admin', 'doctor')
)
WITH CHECK (
  clinic_id = public.current_staff_clinic_id()
  AND public.current_staff_role() IN ('admin', 'doctor')
);

DROP POLICY IF EXISTS consultation_diagnoses_delete_staff ON consultation_diagnoses;
CREATE POLICY consultation_diagnoses_delete_staff
ON consultation_diagnoses FOR DELETE
USING (
  clinic_id = public.current_staff_clinic_id()
  AND public.current_staff_role() IN ('admin', 'doctor')
);

-- Backfill the current single-diagnosis model into the structured table.
-- Existing data remains untouched in consultations for compatibility.
INSERT INTO consultation_diagnoses (
  clinic_id, consultation_id, diagnosis, icd10_code, is_primary, sequence
)
SELECT
  c.clinic_id,
  c.id,
  trim(c.diagnosis),
  NULLIF(trim(c.diagnosis_code), ''),
  true,
  1
FROM consultations c
WHERE c.diagnosis IS NOT NULL
  AND length(trim(c.diagnosis)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM consultation_diagnoses cd
    WHERE cd.consultation_id = c.id
  );
