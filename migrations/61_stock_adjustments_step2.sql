-- ============================================================================
-- STOCK ADJUSTMENTS, STEP 2 — run only after 60_stock_adjustments_step1.sql
-- has completed successfully in its own separate run.
-- ============================================================================

create or replace function batch_quantity_on_hand(p_batch_id uuid)
returns int
language sql
stable
as $$
  select coalesce(sum(
    case
      when movement_type in ('receipt','release_from_quarantine','adjustment_increase') then quantity
      when movement_type in ('dispense','sale','adjustment','quarantine','return_to_supplier') then -quantity
      else 0
    end
  ), 0)
  from stock_movements
  where batch_id = p_batch_id;
$$;

create or replace function record_stock_adjustment(
  p_clinic_id uuid,
  p_batch_id uuid,
  p_quantity int,
  p_direction text,  -- 'increase' or 'decrease'
  p_reason text,
  p_staff_id uuid
)
returns void
language plpgsql
as $$
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to adjust stock';
  end if;
  if p_direction not in ('increase', 'decrease') then
    raise exception 'Direction must be increase or decrease';
  end if;

  perform record_stock_movement(
    p_batch_id,
    case when p_direction = 'increase' then 'adjustment_increase' else 'adjustment' end,
    p_quantity, 'manual_adjustment', null, p_reason, p_staff_id
  );

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_staff_id, 'pharmacy.stock_adjusted', 'batch', p_batch_id,
    jsonb_build_object('direction', p_direction, 'quantity', p_quantity, 'reason', p_reason));
end;
$$;
