-- ============================================================================
-- PRODUCT DUPLICATE PROTECTION
--
-- Save/Add Product can be submitted more than once (for example by rapid
-- repeated clicks). Product creation must therefore be protected at the
-- database boundary, not only by the UI.
--
-- We preserve historical product rows. Existing duplicate ACTIVE rows are
-- deactivated, keeping the row with the strongest transaction history as
-- the canonical product. Nothing is deleted or reassigned by this migration.
--
-- Product identity for duplicate protection:
--   clinic + name + generic name + dosage form + unit
-- All comparisons are trimmed and case-insensitive.
-- ============================================================================

-- First deactivate duplicate ACTIVE products, preserving the product with
-- the greatest amount of existing stock/history. Ties go to the oldest row.
WITH product_history AS (
  SELECT
    p.id,
    p.clinic_id,
    p.created_at,
    lower(trim(p.name)) AS identity_name,
    lower(trim(coalesce(p.generic_name, ''))) AS identity_generic,
    lower(trim(coalesce(
      p.dosage_form,
      nullif(concat_ws(' ', nullif(trim(p.strength), ''), nullif(trim(p.form), '')), ''),
      ''
    ))) AS identity_dosage_form,
    lower(trim(coalesce(p.unit, ''))) AS identity_unit,
    (
      (SELECT count(*) FROM batches b WHERE b.product_id = p.id)
      + (SELECT count(*) FROM dispensing_records dr WHERE dr.product_id = p.id)
      + (SELECT count(*) FROM prescription_items pi WHERE pi.product_id = p.id)
      + (SELECT count(*) FROM pos_sale_items psi WHERE psi.product_id = p.id)
      + (SELECT count(*) FROM purchase_order_items poi WHERE poi.product_id = p.id)
      + (SELECT count(*) FROM goods_receipt_items gri WHERE gri.product_id = p.id)
    ) AS history_count
  FROM products p
  WHERE p.is_active = true
), ranked AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY clinic_id, identity_name, identity_generic,
                   identity_dosage_form, identity_unit
      ORDER BY history_count DESC, created_at ASC, id ASC
    ) AS rn,
    count(*) OVER (
      PARTITION BY clinic_id, identity_name, identity_generic,
                   identity_dosage_form, identity_unit
    ) AS duplicate_count
  FROM product_history
)
UPDATE products p
SET is_active = false
FROM ranked r
WHERE p.id = r.id
  AND r.duplicate_count > 1
  AND r.rn > 1;

-- Enforce the same rule for all future ACTIVE products. Historical inactive
-- duplicates are intentionally allowed so old transactions remain intact.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_active_identity_per_clinic
ON public.products (
  clinic_id,
  lower(trim(name)),
  lower(trim(coalesce(generic_name, ''))),
  lower(trim(coalesce(
    dosage_form,
    nullif(concat_ws(' ', nullif(trim(strength), ''), nullif(trim(form), '')), ''),
    ''
  ))),
  lower(trim(coalesce(unit, '')))
)
WHERE is_active = true;
