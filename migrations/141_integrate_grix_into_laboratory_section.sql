-- ============================================================================
-- MIGRATION 141: MAKE THE GRIX CATALOGUE AVAILABLE IN THE ADMIN LABORATORY TAB
--
-- Migration 140 imported the GRIX catalogue into the clinic that happened to
-- own the largest existing laboratory catalogue. The Admin > Laboratoire tab,
-- however, is clinic-scoped, so another existing clinic can still see only its
-- old two/few activated tests.
--
-- This migration fixes that mismatch without breaking tenant isolation:
--   1. Take the existing GRIX rows (lab_code is not null) as the starter set.
--   2. Clone those rows into every existing clinic that does not already have
--      the corresponding code. Each clone has its OWN clinic_id.
--   3. Activate and price missing clinic_lab_tests from the GRIX source price.
--      Existing clinic prices are never overwritten.
--   4. Add standard adult reference ranges for the common numeric GRIX tests
--      where the original catalogue already established a range in the lab
--      module (migration 36). Existing non-null ranges are preserved.
--
-- IMPORTANT: reference ranges are starter/default ranges, not analyzer-specific
-- ranges. The laboratory should validate them against its method/analyzer before
-- they are used for automated abnormal/critical flags. Different labs can have
-- different reference intervals.
-- ============================================================================

DO $$
DECLARE
  v_source_count integer;
BEGIN
  SELECT count(*) INTO v_source_count
  FROM lab_test_catalog
  WHERE lab_code IS NOT NULL;

  IF v_source_count = 0 THEN
    RAISE EXCEPTION
      'Migration 141: no GRIX catalogue rows found. Run migration 140 first.';
  END IF;
END $$;

-- One source row per GRIX code. This also makes the migration safe if a prior
-- repair accidentally created the same code in more than one clinic.
CREATE TEMP TABLE _grix_source ON COMMIT DROP AS
SELECT DISTINCT ON (lab_code)
  lab_code,
  name_fr,
  name_en,
  category,
  specimen_type,
  unit,
  result_type,
  reference_range_low,
  reference_range_high,
  critical_low,
  critical_high,
  qualitative_options,
  abnormal_qualitative_values,
  critical_qualitative_values,
  collection_container,
  turnaround_time,
  price_xaf
FROM (
  SELECT
    c.lab_code,
    c.name_fr,
    c.name_en,
    c.category,
    c.specimen_type,
    c.unit,
    c.result_type,
    c.reference_range_low,
    c.reference_range_high,
    c.critical_low,
    c.critical_high,
    c.qualitative_options,
    c.abnormal_qualitative_values,
    c.critical_qualitative_values,
    c.collection_container,
    c.turnaround_time,
    clt.price_xaf
  FROM lab_test_catalog c
  JOIN clinic_lab_tests clt
    ON clt.lab_test_catalog_id = c.id
   AND clt.clinic_id = c.clinic_id
  WHERE c.lab_code IS NOT NULL
) s
ORDER BY lab_code, name_fr;

-- Clone the GRIX catalogue into every existing clinic. This is still strict
-- tenant ownership: no clinic ever references another clinic's catalog row.
INSERT INTO lab_test_catalog (
  clinic_id,
  name_fr,
  name_en,
  category,
  specimen_type,
  unit,
  result_type,
  reference_range_low,
  reference_range_high,
  critical_low,
  critical_high,
  qualitative_options,
  abnormal_qualitative_values,
  critical_qualitative_values,
  lab_code,
  collection_container,
  turnaround_time
)
SELECT
  cl.id,
  s.name_fr,
  s.name_en,
  s.category,
  s.specimen_type,
  s.unit,
  s.result_type,
  s.reference_range_low,
  s.reference_range_high,
  s.critical_low,
  s.critical_high,
  s.qualitative_options,
  s.abnormal_qualitative_values,
  s.critical_qualitative_values,
  s.lab_code,
  s.collection_container,
  s.turnaround_time
FROM clinics cl
CROSS JOIN _grix_source s
WHERE NOT EXISTS (
  SELECT 1
  FROM lab_test_catalog existing
  WHERE existing.clinic_id = cl.id
    AND existing.lab_code = s.lab_code
);

-- Activate/prices every newly cloned GRIX test. Existing clinic pricing is
-- deliberately preserved; the owner can change it from Admin > Laboratoire.
INSERT INTO clinic_lab_tests (
  clinic_id,
  lab_test_catalog_id,
  price_xaf,
  is_active
)
SELECT
  cl.id,
  c.id,
  s.price_xaf,
  true
FROM clinics cl
JOIN lab_test_catalog c
  ON c.clinic_id = cl.id
JOIN _grix_source s
  ON s.lab_code = c.lab_code
WHERE c.lab_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM clinic_lab_tests clt
    WHERE clt.clinic_id = cl.id
      AND clt.lab_test_catalog_id = c.id
  );

-- ============================================================================
-- STANDARD ADULT STARTER RANGES
-- ============================================================================
-- Only fill NULLs. An existing clinic/analyzer-specific value is never
-- overwritten.

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'mg/L'),
  reference_range_low = COALESCE(reference_range_low, 25),
  reference_range_high = COALESCE(reference_range_high, 70)
WHERE lab_code = 'AU' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'UI/L'),
  reference_range_low = COALESCE(reference_range_low, 0),
  reference_range_high = COALESCE(reference_range_high, 40)
WHERE lab_code IN ('ALAT', 'ASAT') AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'g/L'),
  reference_range_low = COALESCE(reference_range_low, 35),
  reference_range_high = COALESCE(reference_range_high, 50)
WHERE lab_code = 'ALB' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'g/L'),
  reference_range_low = COALESCE(reference_range_low, 0.70),
  reference_range_high = COALESCE(reference_range_high, 1.10),
  critical_low = COALESCE(critical_low, 0.40),
  critical_high = COALESCE(critical_high, 4.00)
WHERE lab_code = 'GLY' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'g/L'),
  reference_range_low = COALESCE(reference_range_low, 0),
  reference_range_high = COALESCE(reference_range_high, 1.40)
WHERE lab_code = 'GPP' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, '%'),
  reference_range_low = COALESCE(reference_range_low, 4),
  reference_range_high = COALESCE(reference_range_high, 5.6),
  critical_high = COALESCE(critical_high, 10)
WHERE lab_code = 'HB1AC' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'mg/L'),
  reference_range_low = COALESCE(reference_range_low, 6),
  reference_range_high = COALESCE(reference_range_high, 12),
  critical_high = COALESCE(critical_high, 80)
WHERE lab_code = 'CREA' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'g/L'),
  reference_range_low = COALESCE(reference_range_low, 1.5),
  reference_range_high = COALESCE(reference_range_high, 2.0)
WHERE lab_code = 'CT' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'g/L'),
  reference_range_low = COALESCE(reference_range_low, 0.40),
  reference_range_high = COALESCE(reference_range_high, 0.60)
WHERE lab_code = 'HDL' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'g/L'),
  reference_range_low = COALESCE(reference_range_low, 0),
  reference_range_high = COALESCE(reference_range_high, 1.60)
WHERE lab_code = 'LDL' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'g/L'),
  reference_range_low = COALESCE(reference_range_low, 0.40),
  reference_range_high = COALESCE(reference_range_high, 1.50)
WHERE lab_code = 'TG' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'mg/L'),
  reference_range_low = COALESCE(reference_range_low, 3),
  reference_range_high = COALESCE(reference_range_high, 10)
WHERE lab_code = 'BILT' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'mEq/L'),
  reference_range_low = COALESCE(reference_range_low, 98),
  reference_range_high = COALESCE(reference_range_high, 107)
WHERE lab_code = 'CL' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'mg/L'),
  reference_range_low = COALESCE(reference_range_low, 85),
  reference_range_high = COALESCE(reference_range_high, 105)
WHERE lab_code = 'CA' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'mg/L'),
  reference_range_low = COALESCE(reference_range_low, 18),
  reference_range_high = COALESCE(reference_range_high, 25)
WHERE lab_code = 'MG' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'UI/L'),
  reference_range_low = COALESCE(reference_range_low, 40),
  reference_range_high = COALESCE(reference_range_high, 130)
WHERE lab_code = 'PAL' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'g/L'),
  reference_range_low = COALESCE(reference_range_low, 0.15),
  reference_range_high = COALESCE(reference_range_high, 0.45)
WHERE lab_code = 'U' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'mg/L'),
  reference_range_low = COALESCE(reference_range_low, 0),
  reference_range_high = COALESCE(reference_range_high, 6),
  critical_high = COALESCE(critical_high, 100)
WHERE lab_code = 'CRP' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, '%'),
  reference_range_low = COALESCE(reference_range_low, 70),
  reference_range_high = COALESCE(reference_range_high, 100)
WHERE lab_code = 'TP' AND result_type = 'numeric';

UPDATE lab_test_catalog SET
  unit = COALESCE(unit, 'mm/h'),
  reference_range_low = COALESCE(reference_range_low, 0),
  reference_range_high = COALESCE(reference_range_high, 20)
WHERE lab_code = 'VS' AND result_type = 'numeric';

-- Audit the synchronization once per clinic, without exposing cross-tenant
-- catalog data to the application.
INSERT INTO audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
SELECT
  cl.id,
  NULL,
  'lab.grix_catalog_integrated',
  'lab_catalog',
  NULL,
  jsonb_build_object(
    'source', 'GRIX LABO',
    'test_count', count(c.id),
    'message', 'GRIX catalogue integrated into Admin > Laboratoire'
  )
FROM clinics cl
LEFT JOIN lab_test_catalog c
  ON c.clinic_id = cl.id AND c.lab_code IS NOT NULL
GROUP BY cl.id;
