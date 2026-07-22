-- ============================================================================
-- FIX: return_to_supplier WAS CODED BACKWARDS
-- batch_quantity_on_hand() treated 'return_to_supplier' as ADDING to
-- stock — but returning defective/expired stock TO a supplier should
-- DECREASE our inventory, the same direction as a sale or dispense.
-- This movement type was defined in the original schema but never
-- actually used by any built feature until the returns workflow now
-- being built — so there's no historical data this could corrupt, safe
-- to fix cleanly.
-- ============================================================================

create or replace function batch_quantity_on_hand(p_batch_id uuid)
returns int
language sql
stable
as $$
  select coalesce(sum(
    case
      when movement_type in ('receipt','release_from_quarantine') then quantity
      when movement_type in ('dispense','sale','adjustment','quarantine','return_to_supplier') then -quantity
      else 0
    end
  ), 0)
  from stock_movements
  where batch_id = p_batch_id;
$$;
