-- ============================================================================
-- HELPER: active batches with stock, in one query
-- Avoids calling batch_quantity_on_hand() once per batch from the
-- frontend (N+1 problem) — computes it inline for every active batch at
-- once, used by the supplier returns screen's batch search.
-- ============================================================================

create or replace function get_active_batches_with_stock(p_clinic_id uuid)
returns table (
  batch_id uuid,
  product_name text,
  batch_number text,
  on_hand int
)
language sql
stable
as $$
  select
    b.id,
    p.name,
    b.batch_number,
    batch_quantity_on_hand(b.id)
  from batches b
  join products p on p.id = b.product_id
  where b.clinic_id = p_clinic_id and b.status = 'active'
  order by p.name
$$;
