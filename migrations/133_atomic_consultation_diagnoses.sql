-- Atomically replace a consultation's structured diagnoses and keep the
-- legacy diagnosis fields synchronized with the primary diagnosis.
-- This prevents a consultation from being left with updated notes but a
-- partially-written diagnosis set.

CREATE OR REPLACE FUNCTION public.save_consultation_diagnoses(
  p_clinic_id uuid,
  p_consultation_id uuid,
  p_staff_id uuid,
  p_subjective_notes text,
  p_examination_notes text,
  p_treatment_plan text,
  p_diagnoses jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary jsonb;
  v_primary_count integer;
  v_staff_clinic uuid;
  v_consultation_clinic uuid;
BEGIN
  SELECT current_staff_clinic_id() INTO v_staff_clinic;
  IF v_staff_clinic IS NULL OR v_staff_clinic <> p_clinic_id THEN
    RAISE EXCEPTION 'Staff clinic does not match consultation clinic';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM staff
    WHERE id = p_staff_id
      AND clinic_id = p_clinic_id
      AND role IN ('admin', 'doctor')
  ) THEN
    RAISE EXCEPTION 'Staff member is not authorized to update consultations';
  END IF;

  SELECT clinic_id INTO v_consultation_clinic
  FROM consultations
  WHERE id = p_consultation_id;

  IF v_consultation_clinic IS NULL OR v_consultation_clinic <> p_clinic_id THEN
    RAISE EXCEPTION 'Consultation does not belong to the current clinic';
  END IF;

  v_primary_count := COALESCE((
    SELECT count(*)::integer
    FROM jsonb_array_elements(COALESCE(p_diagnoses, '[]'::jsonb)) d
    WHERE COALESCE((d->>'isPrimary')::boolean, false)
      AND NULLIF(trim(d->>'diagnosis'), '') IS NOT NULL
  ), 0);

  IF v_primary_count > 1 THEN
    RAISE EXCEPTION 'A consultation may have only one primary diagnosis';
  END IF;

  v_primary := (
    SELECT d
    FROM jsonb_array_elements(COALESCE(p_diagnoses, '[]'::jsonb)) d
    WHERE COALESCE((d->>'isPrimary')::boolean, false)
      AND NULLIF(trim(d->>'diagnosis'), '') IS NOT NULL
    ORDER BY COALESCE((d->>'sequence')::integer, 999999)
    LIMIT 1
  );

  IF v_primary IS NULL THEN
    v_primary := (
      SELECT d
      FROM jsonb_array_elements(COALESCE(p_diagnoses, '[]'::jsonb)) d
      WHERE NULLIF(trim(d->>'diagnosis'), '') IS NOT NULL
      ORDER BY COALESCE((d->>'sequence')::integer, 999999)
      LIMIT 1
    );
  END IF;

  UPDATE consultations
  SET subjective_notes = NULLIF(trim(p_subjective_notes), ''),
      examination_notes = NULLIF(trim(p_examination_notes), ''),
      diagnosis = NULLIF(trim(v_primary->>'diagnosis'), ''),
      diagnosis_code = NULLIF(trim(v_primary->>'icd10Code'), ''),
      treatment_plan = NULLIF(trim(p_treatment_plan), '')
  WHERE id = p_consultation_id
    AND clinic_id = p_clinic_id;

  DELETE FROM consultation_diagnoses
  WHERE consultation_id = p_consultation_id
    AND clinic_id = p_clinic_id;

  INSERT INTO consultation_diagnoses (
    clinic_id,
    consultation_id,
    diagnosis,
    icd10_code,
    is_primary,
    sequence,
    created_by
  )
  SELECT
    p_clinic_id,
    p_consultation_id,
    trim(d->>'diagnosis'),
    NULLIF(trim(d->>'icd10Code'), ''),
    COALESCE((d->>'isPrimary')::boolean, false),
    COALESCE((d->>'sequence')::integer, row_number() OVER ())::integer,
    p_staff_id
  FROM jsonb_array_elements(COALESCE(p_diagnoses, '[]'::jsonb)) d
  WHERE NULLIF(trim(d->>'diagnosis'), '') IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.save_consultation_diagnoses(uuid, uuid, uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_consultation_diagnoses(uuid, uuid, uuid, text, text, text, jsonb) TO authenticated;
