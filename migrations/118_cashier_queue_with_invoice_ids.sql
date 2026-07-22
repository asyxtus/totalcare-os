-- ============================================================================
-- CASHIER QUEUE WITH INVOICE IDs
-- invoice_id lives on invoice_items, not service_charges — join through there.
-- Must drop first because return type changes (added invoice_ids column).
-- ============================================================================

drop function if exists cashier_queue_summary(uuid);

create or replace function cashier_queue_summary(p_clinic_id uuid)
returns table (
  patient_id   uuid,
  patient_name text,
  patient_code text,
  item_count   bigint,
  total_xaf    numeric,
  paid_xaf     numeric,
  balance_xaf  numeric,
  has_emergency boolean,
  invoice_ids  uuid[]
)
language sql
stable
as $$
  select
    p.id,
    p.full_name,
    p.patient_code,
    count(sc.id),
    sum(coalesce(sc.patient_portion_xaf, sc.amount_xaf)),
    sum(sc.amount_paid_xaf),
    sum(coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf),
    bool_or(coalesce(v.is_emergency, false)),
    array_agg(distinct ii.invoice_id) filter (where ii.invoice_id is not null)
  from service_charges sc
  join patients p on p.id = sc.patient_id
  left join visits v on v.id = sc.visit_id
  left join invoice_items ii on ii.service_charge_id = sc.id
  where sc.clinic_id = p_clinic_id and sc.status in ('pending', 'partial')
  group by p.id, p.full_name, p.patient_code
  having sum(coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf) > 0
  order by sum(coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf) desc
$$;
