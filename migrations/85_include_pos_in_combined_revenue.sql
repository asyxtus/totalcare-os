-- ============================================================================
-- FIX: THE ROOT REVENUE VIEW EXCLUDED POS SALES ENTIRELY
-- daily_revenue_by_method only ever summed from payments/payment_splits
-- — confirmed directly from its actual definition in
-- 42_executive_dashboard_views.sql. POS sales are self-contained (paid
-- instantly at checkout, never touching invoices/payments), so this
-- view — and everything built on top of it, meaning the ENTIRE
-- executive dashboard's revenue trend, today's method breakdown, and
-- week-over-week comparison — has been under-counting real revenue
-- since POS existed. Fixing the view itself, not adding a separate
-- bolt-on number, so every existing screen using it becomes correct at
-- once.
-- ============================================================================

create or replace view daily_revenue_by_method as
select clinic_id, revenue_date, method, sum(total_xaf) as total_xaf
from (
  select
    p.clinic_id,
    date(timezone('Africa/Douala', p.created_at)) as revenue_date,
    ps.method,
    ps.amount_xaf as total_xaf
  from payments p
  join payment_splits ps on ps.payment_id = p.id
  where p.status = 'completed'

  union all

  select
    pos.clinic_id,
    date(timezone('Africa/Douala', pos.created_at)) as revenue_date,
    pos.payment_method as method,
    pos.total_amount_xaf as total_xaf
  from pos_sales pos
  where pos.status = 'completed'
) combined
group by clinic_id, revenue_date, method;

-- ----------------------------------------------------------------------------
-- Same fix for Billing's Revenue tab, which uses a separate function
-- rather than this view — same underlying gap, same fix.
-- ----------------------------------------------------------------------------
create or replace function clinic_daily_revenue(p_clinic_id uuid, p_days int default 30)
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
    coalesce(rev.revenue, 0) as revenue_xaf,
    coalesce(rev.txns, 0) as transaction_count
  from (
    select generate_series(current_date - (p_days - 1), current_date, '1 day')::date as report_date
  ) d
  left join (
    select day, sum(amount) as revenue, count(*) as txns
    from (
      select date(timezone('Africa/Douala', p.created_at)) as day, p.total_amount_xaf as amount
      from payments p
      where p.clinic_id = p_clinic_id and p.status = 'completed'

      union all

      select date(timezone('Africa/Douala', pos.created_at)) as day, pos.total_amount_xaf as amount
      from pos_sales pos
      where pos.clinic_id = p_clinic_id and pos.status = 'completed'
    ) combined
    group by day
  ) rev on rev.day = d.report_date
  order by d.report_date desc
$$;
