-- ============================================================================
-- LAB MODULE, STEP 1 (REVISED — replaces the earlier smaller draft,
-- don't run both).
--
-- Two changes from the first draft, both from real feedback:
--   1. Panel tests (FBC/NFS, urinalysis) are broken into their INDIVIDUAL
--      components, each with its own reference range — because that's
--      what abnormal-flagging actually needs to check against, whether a
--      lab tech types each value or attaches a photo of the printed
--      report (image-as-result is built in the next step, on lab_results
--      — this step just needs the components to exist so there's
--      something to flag).
--   2. Genuinely extensive — ~65 individual tests across hematology,
--      biochemistry, electrolytes, coagulation, serology, urine, and
--      hormonal/antenatal — organized into PANELS so a doctor orders
--      "NFS complète" as one click, not 13 separate checkboxes.
--
-- Reference ranges are standard adult values from general clinical
-- knowledge, NOT calibrated to any specific analyzer or lab — same
-- caveat as the ICD-10 seed. These need review against what your actual
-- lab equipment reports before they drive real clinical flags.
-- ============================================================================

create table lab_test_catalog (
  id uuid primary key default gen_random_uuid(),
  name_fr text not null,
  name_en text not null,
  category text not null,
  specimen_type text,
  unit text,
  result_type text not null check (result_type in ('numeric', 'qualitative')),
  reference_range_low numeric,
  reference_range_high numeric,
  critical_low numeric,
  critical_high numeric,
  qualitative_options text[],
  abnormal_qualitative_values text[],
  critical_qualitative_values text[]
);

create table lab_panels (
  id uuid primary key default gen_random_uuid(),
  name_fr text not null,
  name_en text not null,
  category text not null
);

create table lab_panel_items (
  panel_id uuid not null references lab_panels(id) on delete cascade,
  lab_test_catalog_id uuid not null references lab_test_catalog(id),
  primary key (panel_id, lab_test_catalog_id)
);

create table clinic_lab_tests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  lab_test_catalog_id uuid not null references lab_test_catalog(id),
  price_xaf numeric(10,2) not null,
  is_active boolean not null default true,
  -- Editable overrides: when set, these take precedence over the
  -- platform-wide catalog defaults for THIS clinic only — because
  -- different analyzers and lab methods genuinely report different
  -- normal ranges. Null means "use the platform default" (no override
  -- needed just to activate a test). No UI exists yet to edit these
  -- (see backlog) — for now, an admin updates them directly via SQL.
  override_reference_range_low numeric,
  override_reference_range_high numeric,
  override_critical_low numeric,
  override_critical_high numeric,
  override_abnormal_qualitative_values text[],
  override_critical_qualitative_values text[],
  unique (clinic_id, lab_test_catalog_id)
);

-- Resolves the EFFECTIVE range for a clinic's test: its own override if
-- set, otherwise the platform default. Every later step (result entry,
-- abnormal flagging) reads through this function rather than querying
-- lab_test_catalog directly — one place decides "which range actually
-- applies here," so the override logic can never drift out of sync
-- between different parts of the system.
create or replace function effective_lab_test_range(
  p_clinic_id uuid,
  p_lab_test_catalog_id uuid
)
returns table (
  reference_range_low numeric,
  reference_range_high numeric,
  critical_low numeric,
  critical_high numeric,
  abnormal_qualitative_values text[],
  critical_qualitative_values text[]
)
language sql
stable
as $$
  select
    coalesce(clt.override_reference_range_low, cat.reference_range_low),
    coalesce(clt.override_reference_range_high, cat.reference_range_high),
    coalesce(clt.override_critical_low, cat.critical_low),
    coalesce(clt.override_critical_high, cat.critical_high),
    coalesce(clt.override_abnormal_qualitative_values, cat.abnormal_qualitative_values),
    coalesce(clt.override_critical_qualitative_values, cat.critical_qualitative_values)
  from lab_test_catalog cat
  left join clinic_lab_tests clt
    on clt.lab_test_catalog_id = cat.id and clt.clinic_id = p_clinic_id
  where cat.id = p_lab_test_catalog_id
$$;

-- Convenience function for actually setting an override — validates the
-- test is active for this clinic first, so you can't override a range
-- for a test the clinic doesn't even offer.
create or replace function set_lab_test_range_override(
  p_clinic_id uuid,
  p_lab_test_catalog_id uuid,
  p_reference_range_low numeric default null,
  p_reference_range_high numeric default null,
  p_critical_low numeric default null,
  p_critical_high numeric default null
)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1 from clinic_lab_tests
    where clinic_id = p_clinic_id and lab_test_catalog_id = p_lab_test_catalog_id
  ) then
    raise exception 'This test is not configured as available for this clinic yet — activate it first';
  end if;

  update clinic_lab_tests set
    override_reference_range_low = p_reference_range_low,
    override_reference_range_high = p_reference_range_high,
    override_critical_low = p_critical_low,
    override_critical_high = p_critical_high
  where clinic_id = p_clinic_id and lab_test_catalog_id = p_lab_test_catalog_id;
end;
$$;

create table clinic_lab_panels (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  lab_panel_id uuid not null references lab_panels(id),
  price_xaf numeric(10,2) not null,
  is_active boolean not null default true,
  unique (clinic_id, lab_panel_id)
);

-- ----------------------------------------------------------------------------
-- SEED: numeric tests
-- ----------------------------------------------------------------------------
insert into lab_test_catalog (name_fr, name_en, category, specimen_type, unit, result_type, reference_range_low, reference_range_high, critical_low, critical_high) values
  ('Globules blancs (GB)', 'White blood cells', 'Hématologie', 'Sang', '/mm³', 'numeric', 4000, 10000, 1000, 30000),
  ('Globules rouges (GR)', 'Red blood cells', 'Hématologie', 'Sang', 'M/mm³', 'numeric', 4.2, 5.4, null, null),
  ('Hémoglobine', 'Hemoglobin', 'Hématologie', 'Sang', 'g/dL', 'numeric', 12, 16, 7, 20),
  ('Hématocrite', 'Hematocrit', 'Hématologie', 'Sang', '%', 'numeric', 36, 48, null, null),
  ('VGM (volume globulaire moyen)', 'MCV', 'Hématologie', 'Sang', 'fL', 'numeric', 80, 100, null, null),
  ('TCMH', 'MCH', 'Hématologie', 'Sang', 'pg', 'numeric', 27, 33, null, null),
  ('CCMH', 'MCHC', 'Hématologie', 'Sang', 'g/dL', 'numeric', 32, 36, null, null),
  ('Plaquettes', 'Platelets', 'Hématologie', 'Sang', '/mm³', 'numeric', 150000, 400000, 20000, 1000000),
  ('Neutrophiles (%)', 'Neutrophils (%)', 'Hématologie', 'Sang', '%', 'numeric', 40, 70, null, null),
  ('Lymphocytes (%)', 'Lymphocytes (%)', 'Hématologie', 'Sang', '%', 'numeric', 20, 40, null, null),
  ('Monocytes (%)', 'Monocytes (%)', 'Hématologie', 'Sang', '%', 'numeric', 2, 10, null, null),
  ('Éosinophiles (%)', 'Eosinophils (%)', 'Hématologie', 'Sang', '%', 'numeric', 0, 6, null, null),
  ('Basophiles (%)', 'Basophils (%)', 'Hématologie', 'Sang', '%', 'numeric', 0, 2, null, null),
  ('Vitesse de sédimentation (VS)', 'ESR', 'Hématologie', 'Sang', 'mm/h', 'numeric', 0, 20, null, null),

  ('Glycémie à jeun', 'Fasting blood glucose', 'Biochimie', 'Sang', 'g/L', 'numeric', 0.70, 1.10, 0.40, 4.00),
  ('Glycémie post-prandiale', 'Post-prandial glucose', 'Biochimie', 'Sang', 'g/L', 'numeric', 0, 1.40, null, null),
  ('HbA1c', 'HbA1c', 'Biochimie', 'Sang', '%', 'numeric', 4, 5.6, null, 10),
  ('Urée', 'Urea', 'Biochimie', 'Sang', 'g/L', 'numeric', 0.15, 0.45, null, null),
  ('Créatinine', 'Creatinine', 'Biochimie', 'Sang', 'mg/L', 'numeric', 6, 12, null, 80),
  ('Acide urique', 'Uric acid', 'Biochimie', 'Sang', 'mg/L', 'numeric', 25, 70, null, null),
  ('Cholestérol total', 'Total cholesterol', 'Biochimie', 'Sang', 'g/L', 'numeric', 1.5, 2.0, null, null),
  ('HDL Cholestérol', 'HDL cholesterol', 'Biochimie', 'Sang', 'g/L', 'numeric', 0.40, 0.60, null, null),
  ('LDL Cholestérol', 'LDL cholesterol', 'Biochimie', 'Sang', 'g/L', 'numeric', 0, 1.60, null, null),
  ('Triglycérides', 'Triglycerides', 'Biochimie', 'Sang', 'g/L', 'numeric', 0.40, 1.50, null, null),
  ('Bilirubine totale', 'Total bilirubin', 'Biochimie', 'Sang', 'mg/L', 'numeric', 3, 10, null, null),
  ('Bilirubine directe', 'Direct bilirubin', 'Biochimie', 'Sang', 'mg/L', 'numeric', 0, 3, null, null),
  ('ASAT (SGOT)', 'AST', 'Biochimie', 'Sang', 'UI/L', 'numeric', 0, 40, null, 200),
  ('ALAT (SGPT)', 'ALT', 'Biochimie', 'Sang', 'UI/L', 'numeric', 0, 40, null, 200),
  ('Phosphatases alcalines', 'Alkaline phosphatase', 'Biochimie', 'Sang', 'UI/L', 'numeric', 40, 130, null, null),
  ('Protéines totales', 'Total protein', 'Biochimie', 'Sang', 'g/L', 'numeric', 60, 80, null, null),
  ('Albumine', 'Albumin', 'Biochimie', 'Sang', 'g/L', 'numeric', 35, 50, null, null),
  ('CRP (protéine C réactive)', 'CRP', 'Biochimie', 'Sang', 'mg/L', 'numeric', 0, 6, null, 100),

  ('Sodium (Na+)', 'Sodium', 'Ionogramme', 'Sang', 'mEq/L', 'numeric', 135, 145, 120, 160),
  ('Potassium (K+)', 'Potassium', 'Ionogramme', 'Sang', 'mEq/L', 'numeric', 3.5, 5.1, 2.5, 6.5),
  ('Chlore (Cl-)', 'Chloride', 'Ionogramme', 'Sang', 'mEq/L', 'numeric', 98, 107, null, null),
  ('Calcium', 'Calcium', 'Ionogramme', 'Sang', 'mg/L', 'numeric', 85, 105, null, null),
  ('Magnésium', 'Magnesium', 'Ionogramme', 'Sang', 'mg/L', 'numeric', 18, 25, null, null),

  ('Taux de prothrombine (TP)', 'Prothrombin time (%)', 'Coagulation', 'Sang', '%', 'numeric', 70, 100, null, null),
  ('INR', 'INR', 'Coagulation', 'Sang', 'ratio', 'numeric', 0.8, 1.2, null, 5),
  ('Temps de céphaline activée (TCA)', 'aPTT', 'Coagulation', 'Sang', 'sec', 'numeric', 25, 35, null, null),

  ('TSH', 'TSH', 'Hormonologie', 'Sang', 'mUI/L', 'numeric', 0.4, 4.0, null, null),

  ('Protéinurie des 24h', '24h urine protein', 'Urine', 'Urine', 'g/24h', 'numeric', 0, 0.15, null, null);

-- ----------------------------------------------------------------------------
-- SEED: qualitative tests
-- ----------------------------------------------------------------------------
insert into lab_test_catalog (name_fr, name_en, category, specimen_type, result_type, qualitative_options, abnormal_qualitative_values) values
  ('Goutte épaisse (paludisme)', 'Thick blood smear (malaria)', 'Parasitologie', 'Sang', 'qualitative', ARRAY['Positif','Négatif'], ARRAY['Positif']),
  ('Test de diagnostic rapide paludisme (TDR)', 'Malaria RDT', 'Parasitologie', 'Sang', 'qualitative', ARRAY['Positif','Négatif'], ARRAY['Positif']),
  ('Widal (fièvre typhoïde)', 'Widal test', 'Sérologie', 'Sang', 'qualitative', ARRAY['Positif','Négatif'], ARRAY['Positif']),
  ('Sérologie VIH', 'HIV serology', 'Sérologie', 'Sang', 'qualitative', ARRAY['Positif','Négatif','Indéterminé'], ARRAY['Positif','Indéterminé']),
  ('Sérologie hépatite B (AgHBs)', 'Hepatitis B serology', 'Sérologie', 'Sang', 'qualitative', ARRAY['Positif','Négatif'], ARRAY['Positif']),
  ('Sérologie hépatite C', 'Hepatitis C serology', 'Sérologie', 'Sang', 'qualitative', ARRAY['Positif','Négatif'], ARRAY['Positif']),
  ('VDRL/TPHA (syphilis)', 'VDRL/TPHA', 'Sérologie', 'Sang', 'qualitative', ARRAY['Positif','Négatif'], ARRAY['Positif']),
  ('Examen parasitologique des selles', 'Stool O&P', 'Parasitologie', 'Selles', 'qualitative', ARRAY['Négatif','Positif — parasite à préciser'], ARRAY['Positif — parasite à préciser']),
  ('Test de grossesse (BHCG)', 'Pregnancy test', 'Hormonologie', 'Urine/Sang', 'qualitative', ARRAY['Positif','Négatif'], null),
  ('Groupage sanguin ABO/Rhésus', 'Blood type', 'Hématologie', 'Sang', 'qualitative', ARRAY['A+','A-','B+','B-','AB+','AB-','O+','O-'], null),
  ('Bandelette urinaire — protéines', 'Urine dipstick — protein', 'Urine', 'Urine', 'qualitative', ARRAY['Négatif','Trace','+','++','+++'], ARRAY['+','++','+++']),
  ('Bandelette urinaire — glucose', 'Urine dipstick — glucose', 'Urine', 'Urine', 'qualitative', ARRAY['Négatif','Trace','+','++','+++'], ARRAY['+','++','+++']),
  ('Bandelette urinaire — corps cétoniques', 'Urine dipstick — ketones', 'Urine', 'Urine', 'qualitative', ARRAY['Négatif','Trace','+','++','+++'], ARRAY['+','++','+++']),
  ('Bandelette urinaire — sang', 'Urine dipstick — blood', 'Urine', 'Urine', 'qualitative', ARRAY['Négatif','Trace','+','++','+++'], ARRAY['+','++','+++']),
  ('Bandelette urinaire — leucocytes', 'Urine dipstick — leukocytes', 'Urine', 'Urine', 'qualitative', ARRAY['Négatif','Trace','+','++','+++'], ARRAY['+','++','+++']),
  ('Bandelette urinaire — nitrites', 'Urine dipstick — nitrites', 'Urine', 'Urine', 'qualitative', ARRAY['Positif','Négatif'], ARRAY['Positif']),
  ('ECBU (culture)', 'Urine culture', 'Bactériologie', 'Urine', 'qualitative', ARRAY['Négatif','Positif — germe à préciser'], ARRAY['Positif — germe à préciser']),
  ('Radiographie thoracique', 'Chest X-ray', 'Imagerie', null, 'qualitative', ARRAY['Normal','Anormal — voir détail'], ARRAY['Anormal — voir détail']),
  ('Échographie abdominale', 'Abdominal ultrasound', 'Imagerie', null, 'qualitative', ARRAY['Normal','Anormal — voir détail'], ARRAY['Anormal — voir détail']),
  ('Échographie obstétricale', 'Obstetric ultrasound', 'Imagerie', null, 'qualitative', ARRAY['Normal','Anormal — voir détail'], ARRAY['Anormal — voir détail']),
  ('Frottis cervico-vaginal', 'Pap smear', 'Cytologie', 'Prélèvement cervical', 'qualitative', ARRAY['Normal','Anormal — voir détail'], ARRAY['Anormal — voir détail']);

-- ----------------------------------------------------------------------------
-- PANELS
-- ----------------------------------------------------------------------------
insert into lab_panels (name_fr, name_en, category) values
  ('NFS complète', 'Complete blood count', 'Hématologie'),
  ('Bilan rénal', 'Renal panel', 'Biochimie'),
  ('Bilan hépatique', 'Liver panel', 'Biochimie'),
  ('Bilan lipidique', 'Lipid panel', 'Biochimie'),
  ('Ionogramme sanguin complet', 'Complete electrolyte panel', 'Ionogramme'),
  ('Bilan de coagulation', 'Coagulation panel', 'Coagulation'),
  ('Bandelette urinaire complète', 'Complete urine dipstick', 'Urine'),
  ('Bilan prénatal initial', 'Initial antenatal panel', 'Hormonologie');

insert into lab_panel_items (panel_id, lab_test_catalog_id)
select p.id, c.id from lab_panels p, lab_test_catalog c
where p.name_fr = 'NFS complète' and c.name_fr in (
  'Globules blancs (GB)', 'Globules rouges (GR)', 'Hémoglobine', 'Hématocrite',
  'VGM (volume globulaire moyen)', 'TCMH', 'CCMH', 'Plaquettes',
  'Neutrophiles (%)', 'Lymphocytes (%)', 'Monocytes (%)', 'Éosinophiles (%)', 'Basophiles (%)'
);

insert into lab_panel_items (panel_id, lab_test_catalog_id)
select p.id, c.id from lab_panels p, lab_test_catalog c
where p.name_fr = 'Bilan rénal' and c.name_fr in ('Urée', 'Créatinine', 'Acide urique');

insert into lab_panel_items (panel_id, lab_test_catalog_id)
select p.id, c.id from lab_panels p, lab_test_catalog c
where p.name_fr = 'Bilan hépatique' and c.name_fr in (
  'ASAT (SGOT)', 'ALAT (SGPT)', 'Bilirubine totale', 'Bilirubine directe',
  'Phosphatases alcalines', 'Protéines totales', 'Albumine'
);

insert into lab_panel_items (panel_id, lab_test_catalog_id)
select p.id, c.id from lab_panels p, lab_test_catalog c
where p.name_fr = 'Bilan lipidique' and c.name_fr in ('Cholestérol total', 'HDL Cholestérol', 'LDL Cholestérol', 'Triglycérides');

insert into lab_panel_items (panel_id, lab_test_catalog_id)
select p.id, c.id from lab_panels p, lab_test_catalog c
where p.name_fr = 'Ionogramme sanguin complet' and c.name_fr in ('Sodium (Na+)', 'Potassium (K+)', 'Chlore (Cl-)', 'Calcium', 'Magnésium');

insert into lab_panel_items (panel_id, lab_test_catalog_id)
select p.id, c.id from lab_panels p, lab_test_catalog c
where p.name_fr = 'Bilan de coagulation' and c.name_fr in ('Taux de prothrombine (TP)', 'INR', 'Temps de céphaline activée (TCA)');

insert into lab_panel_items (panel_id, lab_test_catalog_id)
select p.id, c.id from lab_panels p, lab_test_catalog c
where p.name_fr = 'Bandelette urinaire complète' and c.name_fr like 'Bandelette urinaire%';

insert into lab_panel_items (panel_id, lab_test_catalog_id)
select p.id, c.id from lab_panels p, lab_test_catalog c
where p.name_fr = 'Bilan prénatal initial' and c.name_fr in (
  'Groupage sanguin ABO/Rhésus', 'Sérologie VIH', 'Sérologie hépatite B (AgHBs)', 'Test de grossesse (BHCG)', 'Hémoglobine'
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table lab_test_catalog enable row level security;
alter table lab_panels enable row level security;
alter table lab_panel_items enable row level security;
alter table clinic_lab_tests enable row level security;
alter table clinic_lab_panels enable row level security;

create policy lab_test_catalog_select on lab_test_catalog for select using (true);
create policy lab_panels_select on lab_panels for select using (true);
create policy lab_panel_items_select on lab_panel_items for select using (true);

create policy clinic_lab_tests_select on clinic_lab_tests for select
  using (clinic_id = current_staff_clinic_id());
create policy clinic_lab_tests_write on clinic_lab_tests for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
);

create policy clinic_lab_panels_select on clinic_lab_panels for select
  using (clinic_id = current_staff_clinic_id());
create policy clinic_lab_panels_write on clinic_lab_panels for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
);

-- ============================================================================
-- NOT YET INCLUDED — waiting for your review before adding:
--   - lab_orders + lab_order_items (with auto-charge)
--   - lab_results, INCLUDING the image-instead-of-manual-entry option for
--     panels — this is where "upload a photo of the FBC printout instead
--     of typing 13 values" actually gets built
--   - result verification workflow
--   - lab tech's own screen + doctor's results-viewing panel
-- ============================================================================
