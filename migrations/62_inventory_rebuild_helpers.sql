-- ============================================================================
-- INVENTORY REBUILD: PER-PRODUCT BATCH LOOKUP + SUMMARY STATS
-- The old adjustment flow made the pharmacist search blind across every
-- batch in the pharmacy. In practice, the product is usually already
-- known (you're looking at it in the inventory table) — what's needed
-- is that PRODUCT's batches, not a search across everything. This
-- powers the inline adjustment panel on each inventory row.
-- ============================================================================

create or replace function get_product_batches(p_product_id uuid)
returns table (
  batch_id uuid,
  batch_number text,
  expiry_date date,
  on_hand int
)
language sql
stable
as $$
  select id, batch_number, expiry_date, batch_quantity_on_hand(id)
  from batches
  where product_id = p_product_id and status = 'active'
  order by expiry_date asc
$$;

-- ----------------------------------------------------------------------------
-- Full inventory summary — total stock, stock value at cost, low-stock
-- count, and distinct category count. Matches the genuinely good stat
-- card set from the reference, computed for real from actual data.
-- ----------------------------------------------------------------------------
create or replace function inventory_summary(p_clinic_id uuid)
returns table (
  total_products bigint,
  stock_value_xaf numeric,
  low_stock_count bigint,
  category_count bigint
)
language plpgsql
stable
as $$
declare
  v_total_products bigint;
  v_stock_value numeric;
  v_low_stock bigint;
  v_category_count bigint;
begin
  select count(*) into v_total_products from products where clinic_id = p_clinic_id and is_active = true;

  select coalesce(sum(batch_quantity_on_hand(b.id) * coalesce(p.cost_price_xaf, 0)), 0) into v_stock_value
  from batches b
  join products p on p.id = b.product_id
  where b.clinic_id = p_clinic_id and b.status = 'active';

  select count(*) into v_low_stock
  from products p
  where p.clinic_id = p_clinic_id and p.is_active = true
    and (
      select coalesce(sum(batch_quantity_on_hand(b.id)), 0)
      from batches b where b.product_id = p.id and b.status = 'active'
    ) < p.reorder_threshold;

  select count(distinct drug_class_id) into v_category_count
  from products where clinic_id = p_clinic_id and is_active = true and drug_class_id is not null;

  total_products := v_total_products;
  stock_value_xaf := v_stock_value;
  low_stock_count := v_low_stock;
  category_count := v_category_count;
  return next;
end;
$$;

-- ----------------------------------------------------------------------------
-- Products WITH their current stock — one query for the whole table,
-- not N+1 lookups per row.
-- ----------------------------------------------------------------------------
create or replace function get_products_with_stock(p_clinic_id uuid)
returns table (
  product_id uuid,
  name text,
  drug_class_name text,
  barcode text,
  sale_price_xaf numeric,
  cost_price_xaf numeric,
  reorder_threshold int,
  is_active boolean,
  on_hand int
)
language sql
stable
as $$
  select
    p.id, p.name, dc.name_fr, p.barcode, p.sale_price_xaf, p.cost_price_xaf, p.reorder_threshold, p.is_active,
    coalesce((select sum(batch_quantity_on_hand(b.id)) from batches b where b.product_id = p.id and b.status = 'active'), 0)
  from products p
  left join drug_classes dc on dc.id = p.drug_class_id
  where p.clinic_id = p_clinic_id
  order by p.name
$$;
