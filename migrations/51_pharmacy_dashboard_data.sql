-- ============================================================================
-- PHARMACY DASHBOARD: REAL SALES + STOCK DATA
-- Today's sales now genuinely means something, since dispensing charges
-- can actually be paid (file 49). Extends inventory_alert_summary with
-- an expired-batch count (distinct from "expiring soon") rather than
-- duplicating its logic in a new function.
-- ============================================================================

drop function if exists inventory_alert_summary(uuid);

create or replace function inventory_alert_summary(p_clinic_id uuid)
returns table (
  expiring_soon_count bigint,
  low_stock_product_count bigint,
  expired_count bigint
)
language plpgsql
stable
as $$
declare
  v_expiring_soon bigint;
  v_low_stock bigint;
  v_expired bigint;
begin
  select count(*) into v_expiring_soon
  from batches
  where clinic_id = p_clinic_id
    and status = 'active'
    and expiry_date between current_date and current_date + interval '30 days';

  select count(*) into v_low_stock
  from products p
  where p.clinic_id = p_clinic_id
    and p.is_active = true
    and (
      select coalesce(sum(batch_quantity_on_hand(b.id)), 0)
      from batches b where b.product_id = p.id and b.status = 'active'
    ) < p.reorder_threshold;

  select count(*) into v_expired
  from batches
  where clinic_id = p_clinic_id
    and status = 'active'
    and expiry_date < current_date;

  expiring_soon_count := v_expiring_soon;
  low_stock_product_count := v_low_stock;
  expired_count := v_expired;
  return next;
end;
$$;

-- ----------------------------------------------------------------------------
-- Today's sales: POS (paid instantly at sale) + pharmacy dispensing
-- payments actually collected today. Both now genuinely collectible,
-- so this number means what it says.
-- ----------------------------------------------------------------------------
create or replace function pharmacy_today_sales(p_clinic_id uuid)
returns table (
  pos_sales_xaf numeric,
  dispensing_payments_xaf numeric,
  total_xaf numeric
)
language sql
stable
as $$
  select
    coalesce((
      select sum(total_amount_xaf) from pos_sales
      where clinic_id = p_clinic_id and status = 'completed'
        and date(timezone('Africa/Douala', created_at)) = date(timezone('Africa/Douala', now()))
    ), 0),
    coalesce((
      select sum(psp.amount_xaf)
      from payment_splits psp
      join payments pay on pay.id = psp.payment_id
      join invoice_items ii on ii.invoice_id = pay.invoice_id
      join service_charges sc on sc.id = ii.service_charge_id
      where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and pay.status = 'completed'
        and date(timezone('Africa/Douala', pay.created_at)) = date(timezone('Africa/Douala', now()))
    ), 0),
    coalesce((
      select sum(total_amount_xaf) from pos_sales
      where clinic_id = p_clinic_id and status = 'completed'
        and date(timezone('Africa/Douala', created_at)) = date(timezone('Africa/Douala', now()))
    ), 0)
    +
    coalesce((
      select sum(psp.amount_xaf)
      from payment_splits psp
      join payments pay on pay.id = psp.payment_id
      join invoice_items ii on ii.invoice_id = pay.invoice_id
      join service_charges sc on sc.id = ii.service_charge_id
      where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and pay.status = 'completed'
        and date(timezone('Africa/Douala', pay.created_at)) = date(timezone('Africa/Douala', now()))
    ), 0)
$$;

-- ----------------------------------------------------------------------------
-- Top selling products (30 days) — combines POS quantities and dispensed
-- quantities (from service_charges.quantity, populated since file 46).
-- ----------------------------------------------------------------------------
create or replace function top_selling_products(p_clinic_id uuid, p_days int default 30)
returns table (
  product_id uuid,
  product_name text,
  total_quantity bigint
)
language sql
stable
as $$
  select product_id, product_name, sum(qty) as total_quantity
  from (
    select psi.product_id, p.name as product_name, psi.quantity as qty
    from pos_sale_items psi
    join pos_sales ps on ps.id = psi.pos_sale_id
    join products p on p.id = psi.product_id
    where ps.clinic_id = p_clinic_id and ps.status = 'completed'
      and ps.created_at >= current_date - p_days

    union all

    select sc.product_id, p.name as product_name, sc.quantity as qty
    from service_charges sc
    join products p on p.id = sc.product_id
    where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and sc.product_id is not null
      and sc.status <> 'void'
      and sc.service_date >= current_date - p_days
  ) combined
  group by product_id, product_name
  order by total_quantity desc
  limit 10
$$;
