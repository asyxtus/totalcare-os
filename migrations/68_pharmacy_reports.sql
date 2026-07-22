-- ============================================================================
-- PHARMACY REPORTS: DAILY REVENUE + DEAD STOCK
-- top_selling_products already answers "what's moving." This adds its
-- necessary inverse — "what's NOT moving despite being in stock," which
-- is real money sitting on a shelf, and a genuinely useful decision-
-- making signal an owner needs that a top-sellers list alone can't give.
-- ============================================================================

create or replace function pharmacy_daily_revenue(p_clinic_id uuid, p_days int default 30)
returns table (
  report_date date,
  revenue_xaf numeric,
  transaction_count bigint
)
language sql
stable
as $$
  select
    d.report_date,
    coalesce(pos.revenue, 0) + coalesce(disp.revenue, 0) as revenue_xaf,
    coalesce(pos.txns, 0) + coalesce(disp.txns, 0) as transaction_count
  from (
    select generate_series(current_date - (p_days - 1), current_date, '1 day')::date as report_date
  ) d
  left join (
    select date(timezone('Africa/Douala', created_at)) as day, sum(total_amount_xaf) as revenue, count(*) as txns
    from pos_sales
    where clinic_id = p_clinic_id and status = 'completed'
    group by date(timezone('Africa/Douala', created_at))
  ) pos on pos.day = d.report_date
  left join (
    select date(timezone('Africa/Douala', pay.created_at)) as day,
           sum(psp.amount_xaf) as revenue, count(distinct pay.id) as txns
    from payment_splits psp
    join payments pay on pay.id = psp.payment_id
    join invoice_items ii on ii.invoice_id = pay.invoice_id
    join service_charges sc on sc.id = ii.service_charge_id
    where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and pay.status = 'completed'
    group by date(timezone('Africa/Douala', pay.created_at))
  ) disp on disp.day = d.report_date
  order by d.report_date desc
$$;

create or replace function pharmacy_items_sold(p_clinic_id uuid, p_days int default 30)
returns bigint
language sql
stable
as $$
  select
    coalesce((
      select sum(psi.quantity) from pos_sale_items psi
      join pos_sales ps on ps.id = psi.pos_sale_id
      where ps.clinic_id = p_clinic_id and ps.status = 'completed'
        and ps.created_at >= current_date - p_days
    ), 0)
    +
    coalesce((
      select sum(sc.quantity) from service_charges sc
      where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and sc.product_id is not null
        and sc.status <> 'void' and sc.service_date >= current_date - p_days
    ), 0)
$$;

-- ----------------------------------------------------------------------------
-- Dead stock: active products with real stock on hand, but zero sales
-- (POS or dispensing) in the window. This is money sitting on a shelf.
-- ----------------------------------------------------------------------------
create or replace function dead_stock_report(p_clinic_id uuid, p_days int default 60)
returns table (
  product_id uuid,
  product_name text,
  on_hand int,
  stock_value_xaf numeric
)
language sql
stable
as $$
  select
    p.id as product_id,
    p.name as product_name,
    coalesce((select sum(batch_quantity_on_hand(b.id)) from batches b where b.product_id = p.id and b.status = 'active'), 0) as on_hand,
    coalesce((select sum(batch_quantity_on_hand(b.id)) from batches b where b.product_id = p.id and b.status = 'active'), 0)
      * coalesce(p.cost_price_xaf, 0) as stock_value_xaf
  from products p
  where p.clinic_id = p_clinic_id and p.is_active = true
    and coalesce((select sum(batch_quantity_on_hand(b.id)) from batches b where b.product_id = p.id and b.status = 'active'), 0) > 0
    and p.id not in (
      select psi.product_id from pos_sale_items psi
      join pos_sales ps on ps.id = psi.pos_sale_id
      where ps.clinic_id = p_clinic_id and ps.created_at >= current_date - p_days
      union
      select sc.product_id from service_charges sc
      where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and sc.product_id is not null
        and sc.service_date >= current_date - p_days
    )
  order by stock_value_xaf desc
$$;
