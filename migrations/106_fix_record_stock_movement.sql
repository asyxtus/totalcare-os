-- ============================================================================
-- FIX: record_stock_movement missing or wrong signature
--
-- The adjustment call in record_stock_adjustment() passes 7 arguments:
--   (batch_id, type, quantity, 'manual_adjustment', null, reason, staff_id)
--
-- But migration 63 dropped the 7-arg version leaving only the 8-arg one
-- (with dispensing_record_id). The solution: recreate a 7-arg version
-- that wraps the 8-arg version, OR recreate both cleanly.
--
-- Run the diagnostic first to see what currently exists:
--   select pg_get_function_identity_arguments(p.oid), p.pronargs
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where p.proname = 'record_stock_movement' and n.nspname = 'public';
-- ============================================================================

-- Drop whatever exists to start clean
drop function if exists record_stock_movement(uuid, stock_movement_type, integer, text, uuid, text, uuid);
drop function if exists record_stock_movement(uuid, stock_movement_type, integer, text, uuid, text, uuid, uuid);

-- Recreate the canonical version with an optional 8th parameter
-- (dispensing_record_id defaults to NULL so 7-arg calls still work)
create or replace function record_stock_movement(
  p_batch_id            uuid,
  p_movement_type       stock_movement_type,
  p_quantity            integer,
  p_reference_type      text,
  p_reference_id        uuid,
  p_notes               text,
  p_staff_id            uuid,
  p_dispensing_record_id uuid default null
)
returns void
language plpgsql
security invoker
as $$
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive (got %)', p_quantity;
  end if;

  insert into stock_movements (
    batch_id, movement_type, quantity,
    reference_type, reference_id,
    notes, created_by, dispensing_record_id
  ) values (
    p_batch_id, p_movement_type, p_quantity,
    p_reference_type, p_reference_id,
    p_notes, p_staff_id, p_dispensing_record_id
  );
end;
$$;
