-- ============================================================================
-- ADD dosage_form TO products
--
-- The key clinical distinction between medications: Amoxicillin 250mg caps,
-- Amoxicillin 500mg tabs, and Amoxicillin 125mg/5ml suspension are three
-- different products that happen to share an active ingredient. Without
-- dosage_form, the inventory shows three "Amoxicillin" rows with no way
-- to tell them apart.
--
-- dosage_form is a free-text field: "500mg", "250mg/5ml", "10mg tab",
-- "1g IV", etc. Not an enum — the variety is too large and too regional
-- to constrain.
-- ============================================================================

alter table products
  add column if not exists dosage_form text;   -- e.g. "500mg", "250mg/5ml", "10mg tab"

-- The drug_classes table already has is_antibiotic from migration 107.
-- We expose it here by updating the inventory view to join on it.
-- Products inherit is_antibiotic from their drug class.
