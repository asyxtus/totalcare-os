-- ============================================================================
-- FIX: stock_movements missing columns
--
-- record_stock_movement() inserts into columns that were defined in early
-- migrations outside the visible range. Adding all missing ones at once.
-- ============================================================================

alter table stock_movements
  add column if not exists notes text,
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists reference_type text,
  add column if not exists reference_id uuid,
  add column if not exists dispensing_record_id uuid;
