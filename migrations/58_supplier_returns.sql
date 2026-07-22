-- ============================================================================
-- SUPPLIER RETURNS
-- Uses the now-corrected 'return_to_supplier' movement direction (file
-- 55) — this is the first real feature to actually exercise that
-- movement type, which is exactly why the bug had gone unnoticed.
-- ============================================================================

create table supplier_returns (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  batch_id uuid not null references batches(id),
  quantity int not null check (quantity > 0),
  reason text not null,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);

create or replace function record_supplier_return(
  p_clinic_id uuid,
  p_supplier_id uuid,
  p_batch_id uuid,
  p_quantity int,
  p_reason text,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_return_id uuid;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to return stock to a supplier';
  end if;

  -- record_stock_movement already enforces sufficient stock exists
  -- (can't return more than is actually on hand) via its own check —
  -- reusing it here means this gets that safety net for free.
  perform record_stock_movement(
    p_batch_id, 'return_to_supplier', p_quantity, 'supplier_return', null,
    p_reason, p_created_by
  );

  insert into supplier_returns (clinic_id, supplier_id, batch_id, quantity, reason, created_by)
  values (p_clinic_id, p_supplier_id, p_batch_id, p_quantity, p_reason, p_created_by)
  returning id into v_return_id;

  -- Backfill the reference_id on the movement we just created, now that
  -- we have the return's own id (record_stock_movement needed to run
  -- first to get the concurrency-safe lock and quantity check).
  -- Postgres UPDATE doesn't support ORDER BY/LIMIT directly (that's
  -- MySQL syntax) — select the target row's id via a subquery instead.
  update stock_movements set reference_id = v_return_id
  where id = (
    select id from stock_movements
    where batch_id = p_batch_id and reference_type = 'supplier_return' and reference_id is null
    order by created_at desc
    limit 1
  );

  return v_return_id;
end;
$$;

alter table supplier_returns enable row level security;

create policy supplier_returns_select on supplier_returns for select
  using (clinic_id = current_staff_clinic_id());
create policy supplier_returns_write on supplier_returns for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'pharmacist')
);
