-- ============================================================================
-- DASHBOARD AUDIT FIX: COMPARISON BASELINE + OVERDUE VS ROUTINE UNPAID
--
-- Two real design fixes, not cosmetic:
--   1. Nothing compared this period to the last one — fixed by exposing
--      a way to query the PRIOR 7-day window alongside the current one,
--      computed the same frontend-side way (no new view needed, since
--      daily_revenue_by_method/daily_visit_counts already support this
--      if the frontend just queries a second date range).
--   2. Every outstanding balance was shown with the same alarm color,
--      whether it's five minutes old (completely normal) or genuinely
--      aging. Splitting outstanding_balance_summary into "routine"
--      (recent, expected) vs "overdue" (pending 3+ days) so the UI can
--      finally only alarm on what's actually worth alarming about.
-- ============================================================================

-- Postgres won't allow CREATE OR REPLACE to change a function's return
-- columns when it's defined with OUT parameters (the `returns table`
-- syntax below counts as that) — it has to be dropped first.
drop function if exists outstanding_balance_summary(uuid);

create or replace function outstanding_balance_summary(p_clinic_id uuid)
returns table (
  total_outstanding_xaf numeric,
  unpaid_charge_count bigint,
  emergency_unpaid_count bigint,
  overdue_outstanding_xaf numeric,
  overdue_charge_count bigint
)
language sql
stable
as $$
  select
    coalesce(sum(sc.amount_xaf - sc.amount_paid_xaf) filter (where sc.status in ('pending','partial')), 0),
    count(*) filter (where sc.status in ('pending','partial')),
    count(distinct v.id) filter (where v.is_emergency and sc.status in ('pending','partial')),
    coalesce(sum(sc.amount_xaf - sc.amount_paid_xaf) filter (
      where sc.status in ('pending','partial') and sc.service_date < current_date - interval '3 days'
    ), 0),
    count(*) filter (
      where sc.status in ('pending','partial') and sc.service_date < current_date - interval '3 days'
    )
  from service_charges sc
  join visits v on v.id = sc.visit_id
  where sc.clinic_id = p_clinic_id and sc.status <> 'void'
$$;
