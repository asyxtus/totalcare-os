-- ============================================================================
-- CASHIER QUEUE: PER-PATIENT OUTSTANDING BALANCE
-- The core data behind the Billing hub's main screen — one row per
-- patient who owes money, aggregated across every unpaid/partial charge
-- they have, regardless of which visit or module (consultation, lab,
-- pharmacy) generated it.
-- ============================================================================

create or replace function cashier_queue_summary(p_clinic_id uuid)
returns table (
  patient_id uuid,
  patient_name text,
  patient_code text,
  item_count bigint,
  total_xaf numeric,
  paid_xaf numeric,
  balance_xaf numeric,
  has_emergency boolean
)
language sql
stable
as $$
  select
    p.id,
    p.full_name,
    p.patient_code,
    count(sc.id),
    sum(sc.amount_xaf),
    sum(sc.amount_paid_xaf),
    sum(sc.amount_xaf - sc.amount_paid_xaf),
    bool_or(coalesce(v.is_emergency, false))
  from service_charges sc
  join patients p on p.id = sc.patient_id
  left join visits v on v.id = sc.visit_id
  where sc.clinic_id = p_clinic_id and sc.status in ('pending', 'partial')
  group by p.id, p.full_name, p.patient_code
  having sum(sc.amount_xaf - sc.amount_paid_xaf) > 0
  order by sum(sc.amount_xaf - sc.amount_paid_xaf) desc
$$;
