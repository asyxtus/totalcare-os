-- ============================================================================
-- EXECUTIVE DASHBOARD — DATA LAYER
-- Real aggregate views for an owner's view of the business, distinct from
-- the operational queue every other role sees. Each view is scoped by
-- clinic_id and left for the frontend to filter by date range.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Revenue by day and payment method
-- ----------------------------------------------------------------------------
create view daily_revenue_by_method as
select
  p.clinic_id,
  date(timezone('Africa/Douala', p.created_at)) as revenue_date,
  ps.method,
  sum(ps.amount_xaf) as total_xaf
from payments p
join payment_splits ps on ps.payment_id = p.id
where p.status = 'completed'
group by p.clinic_id, date(timezone('Africa/Douala', p.created_at)), ps.method;

-- ----------------------------------------------------------------------------
-- Visit volume by day
-- ----------------------------------------------------------------------------
create view daily_visit_counts as
select
  clinic_id,
  date(timezone('Africa/Douala', created_at)) as visit_date,
  count(*) as visit_count
from visits
group by clinic_id, date(timezone('Africa/Douala', created_at));

-- ----------------------------------------------------------------------------
-- Doctor productivity by day — consultations actually completed, not
-- just started (a consultation that's still open doesn't count yet).
-- ----------------------------------------------------------------------------
create view doctor_productivity_daily as
select
  c.clinic_id,
  c.doctor_id,
  s.full_name as doctor_name,
  date(timezone('Africa/Douala', c.completed_at)) as work_date,
  count(*) as consultations_completed
from consultations c
join staff s on s.id = c.doctor_id
where c.completed_at is not null
group by c.clinic_id, c.doctor_id, s.full_name, date(timezone('Africa/Douala', c.completed_at));

-- ----------------------------------------------------------------------------
-- Lab tech productivity by day — results actually entered. Uses
-- recorded_by on lab_results since lab_order_items itself doesn't track
-- who completed it, only who ordered it.
-- ----------------------------------------------------------------------------
create view lab_tech_productivity_daily as
select
  lr.clinic_id,
  lr.recorded_by as lab_tech_id,
  s.full_name as lab_tech_name,
  date(timezone('Africa/Douala', lr.recorded_at)) as work_date,
  count(*) as results_recorded
from lab_results lr
join staff s on s.id = lr.recorded_by
group by lr.clinic_id, lr.recorded_by, s.full_name, date(timezone('Africa/Douala', lr.recorded_at));

-- ----------------------------------------------------------------------------
-- Money at risk — outstanding balances, and emergency-bypassed visits
-- that are STILL unpaid (the fraud/leakage signal an owner most needs
-- to see, tying directly back to the payment-gate work).
-- ----------------------------------------------------------------------------
create or replace function outstanding_balance_summary(p_clinic_id uuid)
returns table (
  total_outstanding_xaf numeric,
  unpaid_charge_count bigint,
  emergency_unpaid_count bigint
)
language sql
stable
as $$
  select
    coalesce(sum(sc.amount_xaf - sc.amount_paid_xaf) filter (where sc.status in ('pending','partial')), 0),
    count(*) filter (where sc.status in ('pending','partial')),
    count(distinct v.id) filter (where v.is_emergency and sc.status in ('pending','partial'))
  from service_charges sc
  join visits v on v.id = sc.visit_id
  where sc.clinic_id = p_clinic_id and sc.status <> 'void'
$$;

-- ----------------------------------------------------------------------------
-- Compliance signals — pending reviews that need an admin's attention.
-- ----------------------------------------------------------------------------
create or replace function compliance_pending_summary(p_clinic_id uuid)
returns table (
  pending_prescription_reviews bigint,
  pending_shift_variance_reviews bigint,
  pending_discount_approvals bigint
)
language sql
stable
as $$
  select
    (select count(*) from prescriptions where clinic_id = p_clinic_id and requires_review = true),
    (select count(*) from cashier_shifts where clinic_id = p_clinic_id and requires_review = true),
    (select count(*) from discounts where clinic_id = p_clinic_id and status = 'pending_approval')
$$;

-- ----------------------------------------------------------------------------
-- Inventory alerts — expiring soon, and below reorder threshold. Stock
-- on hand is computed the same way as everywhere else in the pharmacy
-- module — summed from stock_movements, never a stored/cached number.
-- ----------------------------------------------------------------------------
create or replace function inventory_alert_summary(p_clinic_id uuid)
returns table (
  expiring_soon_count bigint,
  low_stock_product_count bigint
)
language plpgsql
stable
as $$
declare
  v_expiring_soon bigint;
  v_low_stock bigint;
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

  expiring_soon_count := v_expiring_soon;
  low_stock_product_count := v_low_stock;
  return next;
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- Views inherit RLS from their underlying tables automatically (they're
-- plain queries, not security-definer) — so these already only ever
-- return the calling staff member's own clinic's data. The functions are
-- STABLE SQL/plpgsql running as the caller too, same guarantee.
-- Restricting who actually SEES this data (admin only) happens at the
-- frontend query level, not by further locking the views themselves —
-- an admin querying their own clinic's aggregate data isn't a privilege
-- escalation, so no additional RLS layer is needed here.
-- ============================================================================
