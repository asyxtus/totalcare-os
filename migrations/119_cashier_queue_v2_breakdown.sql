-- ============================================================================
-- CASHIER QUEUE V2 — TRANSPARENT CHARGE BREAKDOWN
--
-- Returns per-patient charge details as a JSON array so the UI can show
-- exactly what each line item is, its category, and whether it's invoiced.
-- Replaces the opaque "balance" with a full itemized breakdown.
-- ============================================================================

drop function if exists cashier_queue_summary(uuid);

create or replace function cashier_queue_summary(p_clinic_id uuid)
returns table (
  patient_id    uuid,
  patient_name  text,
  patient_code  text,
  item_count    bigint,
  total_xaf     numeric,
  paid_xaf      numeric,
  balance_xaf   numeric,
  has_emergency boolean,
  invoice_ids   uuid[],
  -- JSON array of charge details for the UI breakdown
  charges_json  jsonb
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
    array_agg(distinct ii.invoice_id) filter (where ii.invoice_id is not null),
    jsonb_agg(
      jsonb_build_object(
        'id',          sc.id,
        'description', sc.description,
        'category',    sc.category,
        'amount',      coalesce(sc.patient_portion_xaf, sc.amount_xaf),
        'paid',        sc.amount_paid_xaf,
        'balance',     coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf,
        'invoiced',    (ii.invoice_id is not null),
        'visit_date',  v.created_at,
        'visit_status',v.status,
        'insurer_owes',coalesce(sc.insurer_portion_xaf, 0)
      )
      order by sc.created_at asc
    )
  from service_charges sc
  join patients p on p.id = sc.patient_id
  left join visits v on v.id = sc.visit_id
  left join invoice_items ii on ii.service_charge_id = sc.id
  where sc.clinic_id = p_clinic_id
    and sc.status in ('pending', 'partial')
    and coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf > 0
  group by p.id, p.full_name, p.patient_code
  having sum(coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf) > 0
  order by sum(coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf) desc
$$;
