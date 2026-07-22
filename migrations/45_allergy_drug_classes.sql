-- ============================================================================
-- ALLERGY-RELEVANT DRUG CLASSES
-- drug_classes so far only covered controlled substances (Tramadol,
-- Morphine). Adding the classes that actually matter for allergy
-- cross-checking — a product needs to be tagged with one of these for
-- the allergy warning to have anything to match against.
-- ============================================================================

insert into drug_classes (name, name_fr, is_controlled) values
  ('Penicillins', 'Pénicillines', false),
  ('Cephalosporins', 'Céphalosporines', false),
  ('Sulfonamides', 'Sulfamides', false),
  ('NSAIDs', 'AINS', false),
  ('Macrolides', 'Macrolides', false);

-- NOTE, worth being honest about: this check only works for a product
-- that's actually been tagged with the right drug_class_id when it was
-- added to the catalog. A product left untagged (drug_class_id null)
-- will never trigger a match, no matter how the allergy is worded. This
-- is a real limitation of free-text allergy matching, not a bug — full
-- reliability would need a structured allergy field and a maintained
-- drug-to-class mapping, which is a bigger undertaking than this check.
