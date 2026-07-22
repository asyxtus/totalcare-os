-- ============================================================================
-- FIX: stock_movements.created_by foreign key points to auth.users
-- but we store staff.id (a different UUID space).
-- Drop the FK constraint — created_by is an audit field, not a join target.
-- ============================================================================

alter table stock_movements
  drop constraint if exists stock_movements_created_by_fkey;
