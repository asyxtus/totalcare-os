-- ============================================================================
-- FIX: stock_movements missing INSERT (and UPDATE) RLS policies
--
-- The table has RLS enabled but only a SELECT policy. Every function that
-- writes to stock_movements (record_stock_movement, receive stock, adjust,
-- dispense) runs as the authenticated caller and gets blocked.
-- ============================================================================

-- INSERT: staff can only insert movements for batches belonging to their clinic
create policy stock_movements_insert on stock_movements
  for insert with check (
    batch_id in (
      select b.id from batches b
      join products p on p.id = b.product_id
      where p.clinic_id = current_staff_clinic_id()
    )
  );

-- UPDATE: same scope — needed for any status updates on movements
create policy stock_movements_update on stock_movements
  for update using (
    batch_id in (
      select b.id from batches b
      join products p on p.id = b.product_id
      where p.clinic_id = current_staff_clinic_id()
    )
  );
