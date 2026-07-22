-- ============================================================================
-- POS SCANNER SUPPORT: BARCODE FIELD
-- Keyboard-wedge scanners work by typing the barcode value as fast
-- keystrokes into whatever input has focus, then sending Enter — no
-- special driver needed. But products never had anywhere to store a
-- barcode to match against. Adding it now, nullable (not every product
-- will have one, especially compounded/repackaged items common in
-- smaller pharmacies), with a per-clinic uniqueness constraint when set.
-- ============================================================================

alter table products add column barcode text;

create unique index idx_products_barcode_per_clinic
  on products (clinic_id, barcode)
  where barcode is not null;
