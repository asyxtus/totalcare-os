-- ============================================================================
-- PRODUCT TEMPLATES — SHARED MEDICATION MASTER CATALOG
--
-- Design: a shared reference table (no clinic_id) containing the essential
-- medicines used in Cameroonian clinical practice. Any clinic can browse
-- this catalog and "import" a template, which creates a real products row
-- in their own clinic with their own price and stock. The template itself
-- is never modified by clinic operations.
--
-- Structure mirrors the products table: name, dosage_form, drug_class_id,
-- unit, requires_review (controlled substances). What's NOT here: price
-- (each clinic sets their own), barcode (clinic-specific), stock (obvious).
--
-- Seed: WHO Essential Medicines List + Cameroonian formulary staples.
-- Grouped by therapeutic area for the UI browser.
-- ============================================================================

create table if not exists product_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,           -- INN / generic name
  name_fr         text,                    -- French name if different
  dosage_form     text,                    -- "500mg", "250mg/5ml", "10mg tab"
  unit            text,                    -- "comprimé", "flacon", "ampoule"
  drug_class_id   uuid references drug_classes(id),
  requires_review boolean not null default false,  -- controlled substance
  created_at      timestamptz not null default now()
);

create index idx_product_templates_drug_class on product_templates(drug_class_id);

-- No RLS needed — this is read-only reference data accessible to all authenticated users.
-- Inserts/updates only via platform admin or migrations.
alter table product_templates enable row level security;
create policy product_templates_read on product_templates for select using (true);

-- ── SEED: Essential Medicines ──────────────────────────────────────────────
-- Uses a DO block so we can reference drug_class IDs by name safely.

do $$
declare
  -- Antibiotic classes
  dc_penicillin     uuid := (select id from drug_classes where name = 'Penicillins' limit 1);
  dc_cephalosporin  uuid := (select id from drug_classes where name = 'Cephalosporins' limit 1);
  dc_macrolide      uuid := (select id from drug_classes where name = 'Macrolides' limit 1);
  dc_fluoroquinol   uuid := (select id from drug_classes where name = 'Fluoroquinolones' limit 1);
  dc_aminoglyc      uuid := (select id from drug_classes where name = 'Aminoglycosides' limit 1);
  dc_tetracycline   uuid := (select id from drug_classes where name = 'Tetracyclines' limit 1);
  dc_nitroimid      uuid := (select id from drug_classes where name = 'Nitroimidazoles' limit 1);
  dc_sulfonamide    uuid := (select id from drug_classes where name = 'Sulfonamides' limit 1);
  dc_rifamycin      uuid := (select id from drug_classes where name = 'Rifamycins' limit 1);
  dc_anthelm        uuid := (select id from drug_classes where name = 'Anthelmintics' limit 1);
  dc_antifungal     uuid := (select id from drug_classes where name = 'Antifungals' limit 1);
  dc_antimalarial   uuid := (select id from drug_classes where name = 'Antimalarials' limit 1);
  dc_arv            uuid := (select id from drug_classes where name = 'Antiretrovirals' limit 1);
  -- Cardiovascular
  dc_ace            uuid := (select id from drug_classes where name = 'ACE Inhibitors' limit 1);
  dc_arb            uuid := (select id from drug_classes where name = 'ARBs' limit 1);
  dc_betablock      uuid := (select id from drug_classes where name = 'Beta-blockers' limit 1);
  dc_ccb            uuid := (select id from drug_classes where name = 'Calcium channel blockers' limit 1);
  dc_diuretic       uuid := (select id from drug_classes where name = 'Diuretics' limit 1);
  dc_statin         uuid := (select id from drug_classes where name = 'Statins' limit 1);
  -- Endocrine
  dc_biguanide      uuid := (select id from drug_classes where name = 'Biguanides' limit 1);
  dc_sulfonyl       uuid := (select id from drug_classes where name = 'Sulfonylureas' limit 1);
  dc_insulin        uuid := (select id from drug_classes where name = 'Insulin' limit 1);
  dc_cortico        uuid := (select id from drug_classes where name = 'Corticosteroids' limit 1);
  dc_thyroid        uuid := (select id from drug_classes where name = 'Thyroid hormones' limit 1);
  -- CNS / Analgesics
  dc_opioid         uuid := (select id from drug_classes where name = 'Opioids' limit 1);
  dc_nsaid          uuid := (select id from drug_classes where name = 'NSAIDs' limit 1);
  dc_paracetamol    uuid := (select id from drug_classes where name = 'Paracetamol' limit 1);
  dc_benzo          uuid := (select id from drug_classes where name = 'Benzodiazepines' limit 1);
  dc_antiepileptic  uuid := (select id from drug_classes where name = 'Antiepileptics' limit 1);
  dc_antidepressant uuid := (select id from drug_classes where name = 'Antidepressants' limit 1);
  dc_antipsychotic  uuid := (select id from drug_classes where name = 'Antipsychotics' limit 1);
  -- GI
  dc_ppi            uuid := (select id from drug_classes where name = 'Proton pump inhibitors' limit 1);
  dc_antacid        uuid := (select id from drug_classes where name = 'Antacids' limit 1);
  dc_antiemetic     uuid := (select id from drug_classes where name = 'Antiemetics' limit 1);
  -- Other
  dc_vitamin        uuid := (select id from drug_classes where name = 'Vitamins/Supplements' limit 1);
  dc_oxytocic       uuid := (select id from drug_classes where name = 'Oxytocics' limit 1);
  dc_antihistamine  uuid := (select id from drug_classes where name = 'Antihistamines' limit 1);
  dc_lincosamide    uuid := (select id from drug_classes where name = 'Lincosamides' limit 1);

begin

insert into product_templates (name, name_fr, dosage_form, unit, drug_class_id, requires_review) values

-- ── ANTIBIOTICS ────────────────────────────────────────────────────────────
('Amoxicillin',                    'Amoxicilline',             '250mg',          'gélule',    dc_penicillin,    false),
('Amoxicillin',                    'Amoxicilline',             '500mg',          'gélule',    dc_penicillin,    false),
('Amoxicillin',                    'Amoxicilline',             '125mg/5ml',      'flacon',    dc_penicillin,    false),
('Amoxicillin + Clavulanic acid',  'Amoxicilline + Clavulanate','625mg',         'comprimé',  dc_penicillin,    false),
('Ampicillin',                     'Ampicilline',              '500mg',          'gélule',    dc_penicillin,    false),
('Ampicillin',                     'Ampicilline',              '1g',             'flacon IV', dc_penicillin,    false),
('Benzylpenicillin',               'Benzylpénicilline',        '1MUI',           'flacon IM', dc_penicillin,    false),
('Phenoxymethylpenicillin',        'Pénicilline V',            '250mg',          'comprimé',  dc_penicillin,    false),

('Cefixime',                       'Céfixime',                 '200mg',          'comprimé',  dc_cephalosporin, false),
('Cefixime',                       'Céfixime',                 '100mg/5ml',      'flacon',    dc_cephalosporin, false),
('Ceftriaxone',                    'Ceftriaxone',              '1g',             'flacon IV', dc_cephalosporin, false),
('Ceftriaxone',                    'Ceftriaxone',              '500mg',          'flacon IM', dc_cephalosporin, false),
('Cefuroxime',                     'Céfuroxime',               '500mg',          'comprimé',  dc_cephalosporin, false),
('Cefalexin',                      'Céfalexine',               '500mg',          'gélule',    dc_cephalosporin, false),

('Azithromycin',                   'Azithromycine',            '250mg',          'comprimé',  dc_macrolide,     false),
('Azithromycin',                   'Azithromycine',            '500mg',          'comprimé',  dc_macrolide,     false),
('Erythromycin',                   'Érythromycine',            '250mg',          'comprimé',  dc_macrolide,     false),
('Clarithromycin',                 'Clarithromycine',          '500mg',          'comprimé',  dc_macrolide,     false),

('Ciprofloxacin',                  'Ciprofloxacine',           '500mg',          'comprimé',  dc_fluoroquinol,  false),
('Ciprofloxacin',                  'Ciprofloxacine',           '200mg/100ml',    'flacon IV', dc_fluoroquinol,  false),
('Ofloxacin',                      'Ofloxacine',               '200mg',          'comprimé',  dc_fluoroquinol,  false),
('Levofloxacin',                   'Lévofloxacine',            '500mg',          'comprimé',  dc_fluoroquinol,  false),

('Gentamicin',                     'Gentamicine',              '80mg/2ml',       'ampoule',   dc_aminoglyc,     false),
('Gentamicin',                     'Gentamicine',              '40mg/ml',        'flacon',    dc_aminoglyc,     false),

('Doxycycline',                    'Doxycycline',              '100mg',          'comprimé',  dc_tetracycline,  false),
('Tetracycline',                   'Tétracycline',             '250mg',          'gélule',    dc_tetracycline,  false),

('Metronidazole',                  'Métronidazole',            '250mg',          'comprimé',  dc_nitroimid,     false),
('Metronidazole',                  'Métronidazole',            '500mg',          'comprimé',  dc_nitroimid,     false),
('Metronidazole',                  'Métronidazole',            '500mg/100ml',    'flacon IV', dc_nitroimid,     false),
('Tinidazole',                     'Tinidazole',               '500mg',          'comprimé',  dc_nitroimid,     false),

('Cotrimoxazole',                  'Cotrimoxazole',            '480mg',          'comprimé',  dc_sulfonamide,   false),
('Cotrimoxazole',                  'Cotrimoxazole',            '960mg',          'comprimé',  dc_sulfonamide,   false),
('Cotrimoxazole',                  'Cotrimoxazole',            '240mg/5ml',      'flacon',    dc_sulfonamide,   false),

('Clindamycin',                    'Clindamycine',             '300mg',          'gélule',    dc_lincosamide,   false),
('Clindamycin',                    'Clindamycine',             '600mg/4ml',      'ampoule',   dc_lincosamide,   false),

-- TB
('Rifampicin',                     'Rifampicine',              '150mg',          'gélule',    dc_rifamycin,     false),
('Rifampicin + Isoniazid + Pyrazinamide + Ethambutol', 'RHZE',  '150/75/400/275mg','comprimé', dc_rifamycin,  false),

-- Antifungals
('Fluconazole',                    'Fluconazole',              '150mg',          'gélule',    dc_antifungal,    false),
('Fluconazole',                    'Fluconazole',              '50mg',           'gélule',    dc_antifungal,    false),
('Griseofulvin',                   'Griséofulvine',            '125mg',          'comprimé',  dc_antifungal,    false),
('Nystatin',                       'Nystatine',                '100 000 UI',     'comprimé',  dc_antifungal,    false),
('Ketoconazole',                   'Kétoconazole',             '200mg',          'comprimé',  dc_antifungal,    false),

-- Anthelmintics
('Mebendazole',                    'Mébendazole',              '100mg',          'comprimé',  dc_anthelm,       false),
('Mebendazole',                    'Mébendazole',              '500mg',          'comprimé',  dc_anthelm,       false),
('Albendazole',                    'Albendazole',              '400mg',          'comprimé',  dc_anthelm,       false),
('Ivermectin',                     'Ivermectine',              '3mg',            'comprimé',  dc_anthelm,       false),
('Praziquantel',                   'Praziquantel',             '600mg',          'comprimé',  dc_anthelm,       false),

-- ── ANTIMALARIALS ──────────────────────────────────────────────────────────
('Artemether + Lumefantrine',      'Artéméther + Luméfantrine','20/120mg',       'comprimé',  dc_antimalarial,  false),
('Artemether + Lumefantrine',      'Artéméther + Luméfantrine','80/480mg',       'comprimé',  dc_antimalarial,  false),
('Artesunate',                     'Artésunate',               '50mg',           'comprimé',  dc_antimalarial,  false),
('Artesunate',                     'Artésunate',               '60mg',           'flacon IV', dc_antimalarial,  false),
('Amodiaquine',                    'Amodiaquine',              '153mg base',     'comprimé',  dc_antimalarial,  false),
('Quinine',                        'Quinine',                  '300mg',          'comprimé',  dc_antimalarial,  false),
('Quinine',                        'Quinine',                  '600mg/2ml',      'ampoule',   dc_antimalarial,  false),
('Chloroquine',                    'Chloroquine',              '150mg base',     'comprimé',  dc_antimalarial,  false),

-- ── ANTIRETROVIRALS ────────────────────────────────────────────────────────
('Tenofovir + Lamivudine + Efavirenz', 'TDF+3TC+EFV',         '300/300/600mg',  'comprimé',  dc_arv,           false),
('Tenofovir + Lamivudine + Dolutegravir', 'TDF+3TC+DTG',      '300/300/50mg',   'comprimé',  dc_arv,           false),
('Lopinavir + Ritonavir',          'LPV/r',                   '200/50mg',       'comprimé',  dc_arv,           false),
('Nevirapine',                     'Névirapine',              '200mg',           'comprimé',  dc_arv,           false),

-- ── CARDIOVASCULAR ─────────────────────────────────────────────────────────
('Enalapril',                      'Énalapril',               '5mg',             'comprimé',  dc_ace,           false),
('Enalapril',                      'Énalapril',               '10mg',            'comprimé',  dc_ace,           false),
('Lisinopril',                     'Lisinopril',              '5mg',             'comprimé',  dc_ace,           false),
('Lisinopril',                     'Lisinopril',              '10mg',            'comprimé',  dc_ace,           false),
('Perindopril',                    'Périndopril',             '5mg',             'comprimé',  dc_ace,           false),

('Losartan',                       'Losartan',                '50mg',            'comprimé',  dc_arb,           false),
('Losartan',                       'Losartan',                '100mg',           'comprimé',  dc_arb,           false),
('Valsartan',                      'Valsartan',               '80mg',            'comprimé',  dc_arb,           false),

('Atenolol',                       'Aténolol',                '50mg',            'comprimé',  dc_betablock,     false),
('Atenolol',                       'Aténolol',                '100mg',           'comprimé',  dc_betablock,     false),
('Metoprolol',                     'Métoprolol',              '50mg',            'comprimé',  dc_betablock,     false),
('Carvedilol',                     'Carvédilol',              '25mg',            'comprimé',  dc_betablock,     false),
('Bisoprolol',                     'Bisoprolol',              '5mg',             'comprimé',  dc_betablock,     false),

('Amlodipine',                     'Amlodipine',              '5mg',             'comprimé',  dc_ccb,           false),
('Amlodipine',                     'Amlodipine',              '10mg',            'comprimé',  dc_ccb,           false),
('Nifedipine',                     'Nifédipine',              '20mg LP',         'comprimé',  dc_ccb,           false),
('Diltiazem',                      'Diltiazem',               '60mg',            'comprimé',  dc_ccb,           false),

('Furosemide',                     'Furosémide',              '40mg',            'comprimé',  dc_diuretic,      false),
('Furosemide',                     'Furosémide',              '20mg/2ml',        'ampoule',   dc_diuretic,      false),
('Hydrochlorothiazide',            'Hydrochlorothiazide',     '25mg',            'comprimé',  dc_diuretic,      false),
('Spironolactone',                 'Spironolactone',          '25mg',            'comprimé',  dc_diuretic,      false),

('Simvastatin',                    'Simvastatine',            '20mg',            'comprimé',  dc_statin,        false),
('Atorvastatin',                   'Atorvastatine',           '20mg',            'comprimé',  dc_statin,        false),
('Atorvastatin',                   'Atorvastatine',           '40mg',            'comprimé',  dc_statin,        false),
('Aspirin',                        'Aspirine',                '100mg',           'comprimé',  dc_nsaid,         false),
('Digoxin',                        'Digoxine',                '250mcg',          'comprimé',  null,             false),
('Amiodarone',                     'Amiodarone',              '200mg',           'comprimé',  null,             false),

-- ── ENDOCRINE / METABOLIC ──────────────────────────────────────────────────
('Metformin',                      'Metformine',              '500mg',           'comprimé',  dc_biguanide,     false),
('Metformin',                      'Metformine',              '850mg',           'comprimé',  dc_biguanide,     false),
('Metformin',                      'Metformine',              '1000mg',          'comprimé',  dc_biguanide,     false),
('Glibenclamide',                  'Glibenclamide',           '5mg',             'comprimé',  dc_sulfonyl,      false),
('Glimepiride',                    'Glimépiride',             '2mg',             'comprimé',  dc_sulfonyl,      false),
('Insulin Regular',                'Insuline Rapide',         '100UI/ml',        'flacon',    dc_insulin,       true),
('Insulin NPH',                    'Insuline NPH',            '100UI/ml',        'flacon',    dc_insulin,       true),
('Insulin Glargine',               'Insuline Glargine',       '100UI/ml',        'stylo',     dc_insulin,       true),

('Prednisolone',                   'Prednisolone',            '5mg',             'comprimé',  dc_cortico,       false),
('Prednisolone',                   'Prednisolone',            '20mg',            'comprimé',  dc_cortico,       false),
('Dexamethasone',                  'Dexaméthasone',           '4mg/ml',          'ampoule',   dc_cortico,       false),
('Hydrocortisone',                 'Hydrocortisone',          '100mg',           'flacon IV', dc_cortico,       false),
('Betamethasone',                  'Bétaméthasone',           '12mg/2ml',        'ampoule',   dc_cortico,       false),

('Levothyroxine',                  'Lévothyroxine',           '50mcg',           'comprimé',  dc_thyroid,       false),
('Levothyroxine',                  'Lévothyroxine',           '100mcg',          'comprimé',  dc_thyroid,       false),

-- ── ANALGESICS / CNS ───────────────────────────────────────────────────────
('Paracetamol',                    'Paracétamol',             '500mg',           'comprimé',  dc_paracetamol,   false),
('Paracetamol',                    'Paracétamol',             '1g',              'comprimé',  dc_paracetamol,   false),
('Paracetamol',                    'Paracétamol',             '250mg/5ml',       'flacon',    dc_paracetamol,   false),
('Paracetamol',                    'Paracétamol',             '1g/100ml',        'flacon IV', dc_paracetamol,   false),
('Ibuprofen',                      'Ibuprofène',              '400mg',           'comprimé',  dc_nsaid,         false),
('Ibuprofen',                      'Ibuprofène',              '200mg/5ml',       'flacon',    dc_nsaid,         false),
('Diclofenac',                     'Diclofénac',              '50mg',            'comprimé',  dc_nsaid,         false),
('Diclofenac',                     'Diclofénac',              '75mg/3ml',        'ampoule',   dc_nsaid,         false),
('Ketoprofen',                     'Kétoprofène',             '100mg',           'gélule',    dc_nsaid,         false),
('Tramadol',                       'Tramadol',                '50mg',            'gélule',    dc_opioid,        true),
('Tramadol',                       'Tramadol',                '100mg/2ml',       'ampoule',   dc_opioid,        true),
('Morphine',                       'Morphine',                '10mg/ml',         'ampoule',   dc_opioid,        true),
('Codeine',                        'Codéine',                 '30mg',            'comprimé',  dc_opioid,        true),

('Diazepam',                       'Diazépam',                '5mg',             'comprimé',  dc_benzo,         true),
('Diazepam',                       'Diazépam',                '10mg/2ml',        'ampoule',   dc_benzo,         true),
('Phenobarbital',                  'Phénobarbital',           '100mg',           'comprimé',  dc_antiepileptic, false),
('Carbamazepine',                  'Carbamazépine',           '200mg',           'comprimé',  dc_antiepileptic, false),
('Valproate',                      'Valproate',               '200mg',           'comprimé',  dc_antiepileptic, false),
('Phenytoin',                      'Phénytoïne',              '100mg',           'comprimé',  dc_antiepileptic, false),
('Amitriptyline',                  'Amitriptyline',           '25mg',            'comprimé',  dc_antidepressant,false),
('Fluoxetine',                     'Fluoxétine',              '20mg',            'gélule',    dc_antidepressant,false),
('Haloperidol',                    'Halopéridol',             '5mg',             'comprimé',  dc_antipsychotic, false),
('Chlorpromazine',                 'Chlorpromazine',          '100mg',           'comprimé',  dc_antipsychotic, false),

-- ── GI ─────────────────────────────────────────────────────────────────────
('Omeprazole',                     'Oméprazole',              '20mg',            'gélule',    dc_ppi,           false),
('Omeprazole',                     'Oméprazole',              '40mg',            'flacon IV', dc_ppi,           false),
('Pantoprazole',                   'Pantoprazole',            '40mg',            'comprimé',  dc_ppi,           false),
('Aluminium hydroxide + Mg hydroxide', 'Algeldrate + Magnésie', 'suspension',   'flacon',    dc_antacid,       false),
('Metoclopramide',                 'Métoclopramide',          '10mg',            'comprimé',  dc_antiemetic,    false),
('Metoclopramide',                 'Métoclopramide',          '10mg/2ml',        'ampoule',   dc_antiemetic,    false),
('Ondansetron',                    'Ondansétron',             '4mg',             'comprimé',  dc_antiemetic,    false),
('Ondansetron',                    'Ondansétron',             '8mg/4ml',         'ampoule',   dc_antiemetic,    false),
('Oral Rehydration Salts',         'SRO',                     'sachet',          'sachet',    null,             false),
('Loperamide',                     'Lopéramide',              '2mg',             'gélule',    null,             false),

-- ── VITAMINS / MICRONUTRIENTS ──────────────────────────────────────────────
('Folic acid',                     'Acide folique',           '5mg',             'comprimé',  dc_vitamin,       false),
('Ferrous sulfate',                'Sulfate ferreux',         '200mg',           'comprimé',  dc_vitamin,       false),
('Ferrous sulfate + Folic acid',   'Fer + Acide folique',     '200mg + 400mcg',  'comprimé',  dc_vitamin,       false),
('Vitamin B complex',              'Vitamine B complexe',     'comprimé',        'comprimé',  dc_vitamin,       false),
('Vitamin C',                      'Vitamine C',              '500mg',           'comprimé',  dc_vitamin,       false),
('Zinc sulfate',                   'Sulfate de zinc',         '20mg',            'comprimé',  dc_vitamin,       false),
('Calcium + Vitamin D3',           'Calcium + Vit D3',        '500mg + 400UI',   'comprimé',  dc_vitamin,       false),
('Multivitamin',                   'Multivitamines',          'comprimé',        'comprimé',  dc_vitamin,       false),

-- ── OBSTETRICS / REPRODUCTIVE ──────────────────────────────────────────────
('Oxytocin',                       'Ocytocine',               '10UI/ml',         'ampoule',   dc_oxytocic,      false),
('Misoprostol',                    'Misoprostol',             '200mcg',          'comprimé',  dc_oxytocic,      false),
('Methyldopa',                     'Méthyldopa',              '250mg',           'comprimé',  null,             false),
('Magnesium sulfate',              'Sulfate de magnésium',    '500mg/ml',        'ampoule',   null,             false),
('Ferrous gluconate',              'Gluconate ferreux',       '300mg',           'comprimé',  dc_vitamin,       false),

-- ── ANTIHISTAMINES / ALLERGY ───────────────────────────────────────────────
('Cetirizine',                     'Cétirizine',              '10mg',            'comprimé',  dc_antihistamine, false),
('Loratadine',                     'Loratadine',              '10mg',            'comprimé',  dc_antihistamine, false),
('Chlorphenamine',                 'Chlorphénamine',          '4mg',             'comprimé',  dc_antihistamine, false),
('Promethazine',                   'Prométhazine',            '25mg',            'comprimé',  dc_antihistamine, false),
('Epinephrine',                    'Adrénaline',              '1mg/ml',          'ampoule',   null,             false),

-- ── IV FLUIDS / HOSPITAL ───────────────────────────────────────────────────
('Normal Saline',                  'Sérum physiologique',     '0.9% 500ml',      'flacon IV', null,             false),
('Normal Saline',                  'Sérum physiologique',     '0.9% 1000ml',     'flacon IV', null,             false),
('Glucose',                        'Sérum glucosé',           '5% 500ml',        'flacon IV', null,             false),
('Glucose',                        'Sérum glucosé',           '10% 500ml',       'flacon IV', null,             false),
('Ringer Lactate',                 'Ringer Lactate',          '500ml',           'flacon IV', null,             false),
('Heparin',                        'Héparine',                '5000UI/ml',       'flacon',    null,             true),
('Atropine',                       'Atropine',                '1mg/ml',          'ampoule',   null,             false),
('Calcium gluconate',              'Gluconate de calcium',    '10% 10ml',        'ampoule',   null,             false),
('Potassium chloride',             'Chlorure de potassium',   '7.5% 10ml',       'ampoule',   null,             false),
('Sodium bicarbonate',             'Bicarbonate de sodium',   '8.4% 10ml',       'ampoule',   null,             false),

-- ── DERMATOLOGY / TOPICAL ──────────────────────────────────────────────────
('Betamethasone cream',            'Bétaméthasone crème',     '0.1%',            'tube',      dc_cortico,       false),
('Hydrocortisone cream',           'Hydrocortisone crème',    '1%',              'tube',      dc_cortico,       false),
('Clotrimazole cream',             'Clotrimazole crème',      '1%',              'tube',      dc_antifungal,    false),
('Gentamicin eye drops',           'Gentamicine collyre',     '0.3%',            'flacon',    dc_aminoglyc,     false),
('Chloramphenicol eye drops',      'Chloramphénicol collyre', '0.5%',            'flacon',    null,             false),
('Tetracycline eye ointment',      'Tétracycline pommade',    '1%',              'tube',      dc_tetracycline,  false),
('Benzyl benzoate lotion',         'Benzoate de benzyle',     '25%',             'flacon',    null,             false),
('Permethrin',                     'Perméthrine',             '5% crème',        'tube',      null,             false);

end;
$$;
