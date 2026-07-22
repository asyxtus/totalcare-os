-- ============================================================================
-- END-OF-DAY CASH REPORT
--
-- The daily anti-theft ritual: "how much money should be in the drawer,
-- who collected it, by what method, and does the physical count match?"
--
-- Three functions, one report:
--   eod_revenue_by_method(clinic, date)   → cash/momo/om/card totals
--   eod_revenue_by_cashier(clinic, date)  → per-staff collected totals
--   eod_revenue_by_category(clinic, date) → consultation/lab/pharmacy/POS split
--
-- All include BOTH invoice payments AND POS sales (the gap migration 85
-- fixed at the view level). All use Africa/Douala dates.
-- ============================================================================

-- service_charges may not have updated_at — add it if missing
alter table service_charges add column if not exists updated_at timestamptz default now();

-- Keep updated_at fresh on every update (needed for category attribution)
create or replace function touch_service_charge_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists trg_touch_service_charge on service_charges;
create trigger trg_touch_service_charge
  before update on service_charges
  for each row execute function touch_service_charge_updated_at();

-- ── By payment method ───────────────────────────────────────────────────────
create or replace function eod_revenue_by_method(p_clinic_id uuid, p_date date default null)
returns table (
  method text,
  total_xaf numeric,
  transaction_count bigint
)
language sql
stable
as $$
  with target as (select coalesce(p_date, (timezone('Africa/Douala', now()))::date) as d)
  select method, sum(amount) as total_xaf, count(*) as transaction_count
  from (
    select ps.method::text, ps.amount_xaf as amount
    from payments p
    join payment_splits ps on ps.payment_id = p.id, target
    where p.clinic_id = p_clinic_id
      and p.status = 'completed'
      and date(timezone('Africa/Douala', p.created_at)) = target.d

    union all

    select pos.payment_method::text, pos.total_amount_xaf
    from pos_sales pos, target
    where pos.clinic_id = p_clinic_id
      and pos.status = 'completed'
      and date(timezone('Africa/Douala', pos.created_at)) = target.d
  ) combined
  group by method
  order by total_xaf desc
$$;

-- ── By cashier ──────────────────────────────────────────────────────────────
create or replace function eod_revenue_by_cashier(p_clinic_id uuid, p_date date default null)
returns table (
  staff_id uuid,
  staff_name text,
  total_xaf numeric,
  cash_xaf numeric,
  transaction_count bigint
)
language sql
stable
as $$
  with target as (select coalesce(p_date, (timezone('Africa/Douala', now()))::date) as d)
  select
    s.id,
    s.full_name,
    sum(c.amount) as total_xaf,
    sum(c.amount) filter (where c.method = 'cash') as cash_xaf,
    count(*) as transaction_count
  from (
    select p.received_by as staff_id, ps.method::text, ps.amount_xaf as amount
    from payments p
    join payment_splits ps on ps.payment_id = p.id, target
    where p.clinic_id = p_clinic_id
      and p.status = 'completed'
      and date(timezone('Africa/Douala', p.created_at)) = target.d

    union all

    select pos.sold_by, pos.payment_method::text, pos.total_amount_xaf
    from pos_sales pos, target
    where pos.clinic_id = p_clinic_id
      and pos.status = 'completed'
      and date(timezone('Africa/Douala', pos.created_at)) = target.d
  ) c
  join staff s on s.id = c.staff_id
  group by s.id, s.full_name
  order by total_xaf desc
$$;

-- ── By category (what the money was for) ────────────────────────────────────
create or replace function eod_revenue_by_category(p_clinic_id uuid, p_date date default null)
returns table (
  category text,
  total_xaf numeric
)
language sql
stable
as $$
  with target as (select coalesce(p_date, (timezone('Africa/Douala', now()))::date) as d)
  select category, sum(amount) as total_xaf
  from (
    -- Invoice payments: apportion each payment across its invoice's charges
    -- proportionally. Simpler approximation: use the charge categories of
    -- charges paid TODAY (amount_paid_xaf delta is not tracked historically,
    -- so we attribute today's paid charges directly).
    select sc.category::text, coalesce(sc.patient_portion_xaf, sc.amount_xaf) as amount
    from service_charges sc, target
    where sc.clinic_id = p_clinic_id
      and sc.status = 'paid'
      and date(timezone('Africa/Douala', sc.updated_at)) = target.d

    union all

    select 'pos'::text, pos.total_amount_xaf
    from pos_sales pos, target
    where pos.clinic_id = p_clinic_id
      and pos.status = 'completed'
      and date(timezone('Africa/Douala', pos.created_at)) = target.d
  ) combined
  group by category
  order by total_xaf desc
$$;

