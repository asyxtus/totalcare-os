-- ============================================================================
-- ICD-10 REFERENCE TABLE (platform-wide, per the scoping decision from the
-- earlier audit — this is standard external reference data, not clinic-
-- specific, seeded once and shared across every clinic, same treatment as
-- drug_classes).
-- ============================================================================

create table icd10_codes (
  code text primary key,
  description_fr text not null,
  description_en text not null,
  category text not null   -- broad grouping for the picker's filter/search
);

-- ----------------------------------------------------------------------------
-- Seed: ~50 codes covering Cameroon's common outpatient disease burden —
-- infectious/parasitic (malaria, typhoid, TB, intestinal), respiratory,
-- cardiovascular (matching the clinical_thresholds already seeded),
-- endocrine, genitourinary, maternal/pregnancy, and pediatric/perinatal.
-- Extensible later — this is a starting set, not exhaustive.
-- ----------------------------------------------------------------------------
insert into icd10_codes (code, description_fr, description_en, category) values
  -- Infectious & parasitic
  ('B54', 'Paludisme, sans précision', 'Malaria, unspecified', 'Infectious/Parasitic'),
  ('B50.9', 'Paludisme à P. falciparum, sans précision', 'P. falciparum malaria, unspecified', 'Infectious/Parasitic'),
  ('A01.0', 'Fièvre typhoïde', 'Typhoid fever', 'Infectious/Parasitic'),
  ('A09', 'Gastro-entérite et colite d''origine infectieuse', 'Infectious gastroenteritis and colitis', 'Infectious/Parasitic'),
  ('A15.9', 'Tuberculose respiratoire, sans précision', 'Respiratory tuberculosis, unspecified', 'Infectious/Parasitic'),
  ('B82.9', 'Parasitose intestinale, sans précision', 'Intestinal parasitism, unspecified', 'Infectious/Parasitic'),
  ('B77.9', 'Ascaridiase, sans précision', 'Ascariasis, unspecified', 'Infectious/Parasitic'),
  ('A00', 'Choléra', 'Cholera', 'Infectious/Parasitic'),
  ('B99', 'Maladie infectieuse, autre', 'Other infectious disease', 'Infectious/Parasitic'),
  ('B24', 'Maladie à VIH, sans précision', 'HIV disease, unspecified', 'Infectious/Parasitic'),

  -- Respiratory
  ('J06.9', 'Infection aiguë des voies respiratoires supérieures', 'Acute upper respiratory infection, unspecified', 'Respiratory'),
  ('J18.9', 'Pneumonie, sans précision', 'Pneumonia, unspecified organism', 'Respiratory'),
  ('J20.9', 'Bronchite aiguë, sans précision', 'Acute bronchitis, unspecified', 'Respiratory'),
  ('J45.9', 'Asthme, sans précision', 'Asthma, unspecified', 'Respiratory'),
  ('J02.9', 'Pharyngite aiguë, sans précision', 'Acute pharyngitis, unspecified', 'Respiratory'),
  ('J01.9', 'Sinusite aiguë, sans précision', 'Acute sinusitis, unspecified', 'Respiratory'),

  -- Cardiovascular (matches existing clinical_thresholds)
  ('I10', 'Hypertension essentielle (primitive)', 'Essential (primary) hypertension', 'Cardiovascular'),
  ('I50.9', 'Insuffisance cardiaque, sans précision', 'Heart failure, unspecified', 'Cardiovascular'),
  ('I21.9', 'Infarctus aigu du myocarde, sans précision', 'Acute myocardial infarction, unspecified', 'Cardiovascular'),
  ('I48', 'Fibrillation et flutter auriculaires', 'Atrial fibrillation and flutter', 'Cardiovascular'),
  ('I63.9', 'Infarctus cérébral, sans précision', 'Cerebral infarction, unspecified', 'Cardiovascular'),
  ('D64.9', 'Anémie, sans précision', 'Anemia, unspecified', 'Cardiovascular'),

  -- Endocrine
  ('E11.9', 'Diabète de type 2, sans complication', 'Type 2 diabetes mellitus, without complications', 'Endocrine'),
  ('E10.9', 'Diabète de type 1, sans complication', 'Type 1 diabetes mellitus, without complications', 'Endocrine'),
  ('E66.9', 'Obésité, sans précision', 'Obesity, unspecified', 'Endocrine'),
  ('E03.9', 'Hypothyroïdie, sans précision', 'Hypothyroidism, unspecified', 'Endocrine'),
  ('E86', 'Déplétion volémique', 'Volume depletion (dehydration)', 'Endocrine'),

  -- Genitourinary
  ('N39.0', 'Infection des voies urinaires, siège non précisé', 'Urinary tract infection, site not specified', 'Genitourinary'),
  ('N30.9', 'Cystite, sans précision', 'Cystitis, unspecified', 'Genitourinary'),
  ('N18.9', 'Maladie rénale chronique, sans précision', 'Chronic kidney disease, unspecified', 'Genitourinary'),
  ('N40', 'Hyperplasie de la prostate', 'Enlarged prostate', 'Genitourinary'),

  -- Digestive
  ('K29.7', 'Gastrite, sans précision', 'Gastritis, unspecified', 'Digestive'),
  ('K27.9', 'Ulcère gastro-duodénal, sans précision', 'Peptic ulcer, unspecified', 'Digestive'),
  ('K59.1', 'Diarrhée fonctionnelle', 'Functional diarrhea', 'Digestive'),
  ('K59.0', 'Constipation', 'Constipation', 'Digestive'),
  ('K35.9', 'Appendicite aiguë, sans précision', 'Acute appendicitis, unspecified', 'Digestive'),

  -- Skin
  ('B35.9', 'Dermatophytose, sans précision', 'Dermatophytosis, unspecified', 'Skin'),
  ('L01.0', 'Impétigo', 'Impetigo', 'Skin'),
  ('L30.9', 'Dermite, sans précision', 'Dermatitis, unspecified', 'Skin'),
  ('B86', 'Gale', 'Scabies', 'Skin'),

  -- Musculoskeletal
  ('M54.5', 'Lombalgie', 'Low back pain', 'Musculoskeletal'),
  ('M79.1', 'Myalgie', 'Myalgia', 'Musculoskeletal'),
  ('M25.5', 'Douleur articulaire', 'Joint pain', 'Musculoskeletal'),

  -- Maternal / pregnancy
  ('Z34.9', 'Surveillance d''une grossesse normale, sans précision', 'Supervision of normal pregnancy, unspecified', 'Maternal/Pregnancy'),
  ('O26.9', 'Affection liée à la grossesse, sans précision', 'Pregnancy-related condition, unspecified', 'Maternal/Pregnancy'),
  ('O14.9', 'Pré-éclampsie, sans précision', 'Pre-eclampsia, unspecified', 'Maternal/Pregnancy'),
  ('O99.0', 'Anémie compliquant la grossesse', 'Anemia complicating pregnancy', 'Maternal/Pregnancy'),
  ('Z39.0', 'Soins et examen après un accouchement', 'Postpartum care and examination', 'Maternal/Pregnancy'),

  -- Pediatric / perinatal
  ('P07.3', 'Autres prématurés', 'Other preterm infants', 'Pediatric/Perinatal'),
  ('R62.0', 'Retard staturo-pondéral', 'Delayed growth', 'Pediatric/Perinatal'),
  ('E44.0', 'Malnutrition protéino-énergétique modérée', 'Moderate protein-energy malnutrition', 'Pediatric/Perinatal'),
  ('Z00.1', 'Examen de santé de routine d''un nourrisson/enfant', 'Routine child health examination', 'Pediatric/Perinatal'),
  ('B05.9', 'Rougeole, sans complication', 'Measles without complication', 'Pediatric/Perinatal'),

  -- General/other
  ('R50.9', 'Fièvre, sans précision', 'Fever, unspecified', 'General/Other'),
  ('R51', 'Céphalée', 'Headache', 'General/Other'),
  ('Z00.0', 'Examen médical général', 'General medical examination', 'General/Other');

-- ============================================================================
-- ROW LEVEL SECURITY: readable by all authenticated staff (it's reference
-- data, needed for the diagnosis picker to work at all), not writable by
-- anyone at the app layer — this is platform-seeded content.
-- ============================================================================
alter table icd10_codes enable row level security;

create policy icd10_codes_select on icd10_codes for select using (true);
