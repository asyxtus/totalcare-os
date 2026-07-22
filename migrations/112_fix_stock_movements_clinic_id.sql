-- ============================================================================
-- FIX: stock_movements.clinic_id not populated by record_stock_movement()
--
-- The original function signature never included clinic_id. We derive it
-- from the batch → product → clinic chain inside the function itself,
-- so all existing callers (receive, dispense, adjust) work unchanged.
-- ============================================================================

drop function if exists record_stock_movement(uuid, stock_movement_type, integer, text, uuid, text, uuid);
drop function if exists record_stock_movement(uuid, stock_movement_type, integer, text, uuid, text, uuid, uuid);

create or replace function record_stock_movement(
  p_batch_id             uuid,
  p_movement_type        stock_movement_type,
  p_quantity             integer,
  p_reference_type       text,
  p_reference_id         uuid,
  p_notes                text,
  p_staff_id             uuid,
  p_dispensing_record_id uuid default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_clinic_id uuid;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive (got %)', p_quantity;
  end if;

  -- Derive clinic_id from the batch so callers don't need to pass it
  select p.clinic_id into v_clinic_id
  from batches b
  join products p on p.id = b.product_id
  where b.id = p_batch_id;

  if v_clinic_id is null then
    raise exception 'Batch % not found or has no clinic', p_batch_id;
  end if;

  insert into stock_movements (
    clinic_id, batch_id, movement_type, quantity,
    reference_type, reference_id,
    notes, created_by, dispensing_record_id
  ) values (
    v_clinic_id, p_batch_id, p_movement_type, p_quantity,
    p_reference_type, p_reference_id,
    p_notes, p_staff_id, p_dispensing_record_id
  );
end;
$$;
