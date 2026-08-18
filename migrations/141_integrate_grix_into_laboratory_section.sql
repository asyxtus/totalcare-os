-- ============================================================================
-- MIGRATION 141: INTEGRATE GRIX INTO ADMIN > LABORATOIRE
--
-- Migration 140 seeded the GRIX catalogue into one clinic. Because the lab
-- catalogue is intentionally clinic-owned, other clinics could still see only
-- their old tests. This migration clones the GRIX starter catalogue into each
-- existing clinic and activates/prices the missing tests there.
--
-- Existing clinic prices and existing non-null reference ranges are preserved.
-- The reference ranges below are standard adult starter values from the
-- existing laboratory catalogue (migration 36), not analyzer-specific values.
-- The lab should validate them against its actual method/analyzer before using
-- them for automated abnormal/critical flags.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lab_test_catalog WHERE lab_code IS NOT NULL) THEN
    RAISE EXCEPTION 'Migration 141: no GRIX catalogue rows found. Run migration 140 first.';
  END IF;
END $$;

CREATE TEMP TABLE _grix_source ON COMMIT DROP AS
SELECT DISTINCT ON (c.lab_code)
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
ORDER BY c.lab_code, c.name_fr;

-- Give every existing clinic its own copy of every GRIX test.
INSERT INTO lab_test_catalog (
  clinic_id, name_fr, name_en, category, specimen_type, unit, result_type,
  reference_range_low, reference_range_high, critical_low, critical_high,
  qualitative_options, abnormal_qualitative_values, critical_qualitative_values,
  lab_code, collection_container, turnaround_time
)
SELECT
  cl.id, s.name_fr, s.name_en, s.category, s.specimen_type, s.unit, s.result_type,
  s.reference_range_low, s.reference_range_high, s.critical_low, s.critical_high,
  s.qualitative_options, s.abnormal_qualitative_values, s.critical_qualitative_values,
  s.lab_code, s.collection_container, s.turnaround_time
FROM clinics cl
CROSS JOIN _grix_source s
WHERE NOT EXISTS (
  SELECT 1 FROM lab_test_catalog existing
  WHERE existing.clinic_id = cl.id AND existing.lab_code = s.lab_code
);

-- Activate/prices only missing clinic rows. Existing clinic pricing is left
-- untouched so an owner can maintain a different local price.
INSERT INTO clinic_lab_tests (clinic_id, lab_test_catalog_id, price_xaf, is_active)
SELECT cl.id, c.id, s.price_xaf, true
FROM clinics cl
JOIN lab_test_catalog c ON c.clinic_id = cl.id
JOIN _grix_source s ON s.lab_code = c.lab_code
WHERE NOT EXISTS (
  SELECT 1 FROM clinic_lab_tests clt
  WHERE clt.clinic_id = cl.id AND clt.lab_test_catalog_id = c.id
);

-- ============================================================================
-- STANDARD ADULT STARTER REFERENCE RANGES
-- ============================================================================
CREATE TEMP TABLE _grix_ranges (
  lab_code text primary key,
  unit text,
  low numeric,
  high numeric,
  critical_low numeric,
  critical_high numeric
) ON COMMIT DROP;

INSERT INTO _grix_ranges VALUES
  ('AU',    'mg/L', 25,   70,   null, null),
  ('ALAT',  'UI/L', 0,    40,   null, 200),
  ('ASAT',  'UI/L', 0,    40,   null, 200),
  ('ALB',   'g/L',  35,   50,   null, null),
  ('GLY',   'g/L',  0.70, 1.10, 0.40, 4.00),
  ('GPP',   'g/L',  0,    1.40, null, null),
  ('HB1AC', '%',    4,    5.6,  null, 10),
  ('CREA',  'mg/L', 6,    12,   null, 80),
  ('CT',    'g/L',  1.5,  2.0,  null, null),
  ('HDL',   'g/L',  0.40, 0.60, null, null),
  ('LDL',   'g/L',  0,    1.60, null, null),
  ('TG',    'g/L',  0.40, 1.50, null, null),
  ('BILT',  'mg/L', 3,    10,   null, null),
  ('CL',    'mEq/L',98,   107,  null, null),
  ('CA',    'mg/L', 85,   105,  null, null),
  ('MG',    'mg/L', 18,   25,   null, null),
  ('PAL',   'UI/L', 40,   130,  null, null),
  ('U',     'g/L',  0.15, 0.45, null, null),
  ('CRP',   'mg/L', 0,    6,    null, 100),
  ('TP',    '%',    70,   100,  null, null),
  ('VS',    'mm/h',0,    20,   null, null);

UPDATE lab_test_catalog c
SET
  unit = COALESCE(c.unit, r.unit),
  reference_range_low = COALESCE(c.reference_range_low, r.low),
  reference_range_high = COALESCE(c.reference_range_high, r.high),
  critical_low = COALESCE(c.critical_low, r.critical_low),
  critical_high = COALESCE(c.critical_high, r.critical_high)
FROM _grix_ranges r
WHERE c.lab_code = r.lab_code
  AND c.result_type = 'numeric';

-- No audit row is created here because a SQL migration has no authenticated
-- staff actor. The catalogue changes themselves remain visible in the normal
-- catalogue/clinic records and can be audited by the application after login.
