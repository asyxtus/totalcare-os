-- ============================================================================
-- UPDATE get_products_with_stock: add dosage_form + is_antibiotic
--
-- dosage_form lets the inventory screen distinguish e.g. Amoxicillin 250mg
-- caps from Amoxicillin 500mg tabs. is_antibiotic enables the antibiotic
-- badge in the UI for antimicrobial stewardship visibility.
-- ============================================================================

drop function if exists get_products_with_stock(uuid);

create or replace function get_products_with_stock(p_clinic_id uuid)
returns table (
  product_id        uuid,
  sku               text,
  name              text,
  dosage_form       text,
  drug_class_name   text,
  is_antibiotic     boolean,
  barcode           text,
  sale_price_xaf    numeric,
  cost_price_xaf    numeric,
  reorder_threshold int,
  is_active         boolean,
  on_hand           int
)
language sql
stable
as $$
  select
    p.id,
    p.sku,
    p.name,
    p.dosage_form,
    dc.name_fr,
    coalesce(dc.is_antibiotic, false),
    p.barcode,
    p.sale_price_xaf,
    p.cost_price_xaf,
    p.reorder_threshold,
    p.is_active,
    coalesce((
      select sum(batch_quantity_on_hand(b.id))
      from batches b
      where b.product_id = p.id and b.status = 'active'
    ), 0)::int
  from products p
  left join drug_classes dc on dc.id = p.drug_class_id
  where p.clinic_id = p_clinic_id
  order by p.name
$$;
