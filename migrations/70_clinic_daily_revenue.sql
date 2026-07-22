-- ============================================================================
-- BILLING: CLINIC-WIDE DAILY REVENUE
-- Same pattern as pharmacy_daily_revenue, but across every category
-- (consultation, lab, pharmacy) — the clinic-wide view, not just one
-- department's slice of it.
-- ============================================================================

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
    select date(timezone('Africa/Douala', pay.created_at)) as day,
           sum(pay.total_amount_xaf) as revenue, count(*) as txns
    from payments pay
    where pay.clinic_id = p_clinic_id and pay.status = 'completed'
    group by date(timezone('Africa/Douala', pay.created_at))
  ) rev on rev.day = d.report_date
  order by d.report_date desc
$$;
