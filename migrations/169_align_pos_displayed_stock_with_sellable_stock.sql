-- ============================================================================
-- MIGRATION 169: ALIGN POS DISPLAYED STOCK WITH SELLABLE STOCK
--
-- The POS checkout validates against active, non-expired batches. The previous
-- get_products_with_stock() value counted all active batches, including units
-- whose expiry date had already passed. That allowed the POS card to show
-- stock that record_pos_sale() correctly refused to sell.
--
-- Keep the existing function signature and make on_hand mean SELLABLE stock:
-- active batches + expiry date today or later.
-- ============================================================================

create or replace function public.get_products_with_stock(p_clinic_id uuid)
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
set search_path = public
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
      select sum(greatest(batch_quantity_on_hand(b.id), 0))
      from batches b
      where b.product_id = p.id
        and b.clinic_id = p_clinic_id
        and b.status = 'active'
        and b.expiry_date >= current_date
    ), 0)::int
  from products p
  left join drug_classes dc on dc.id = p.drug_class_id
  where p.clinic_id = p_clinic_id
  order by p.name
$$;
