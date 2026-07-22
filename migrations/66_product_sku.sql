-- ============================================================================
-- PRODUCT SKU
-- A barcode is for scanning; a SKU is for humans to read and say out
-- loud ("check MED-047"). Auto-generated sequentially per clinic, with
-- an advisory lock to avoid a race condition if two products are
-- created at nearly the same moment.
-- ============================================================================

alter table products add column sku text;

create unique index idx_products_sku_per_clinic
  on products (clinic_id, sku)
  where sku is not null;

create or replace function generate_next_sku(p_clinic_id uuid)
returns text
language plpgsql
as $$
declare
  v_next_number int;
begin
  perform pg_advisory_xact_lock(hashtext(p_clinic_id::text));

  select coalesce(max(substring(sku from 5)::int), 0) + 1 into v_next_number
  from products
  where clinic_id = p_clinic_id and sku ~ '^MED-[0-9]+$';

  return 'MED-' || lpad(v_next_number::text, 3, '0');
end;
$$;
