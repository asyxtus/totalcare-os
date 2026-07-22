-- ============================================================================
-- FIX: dispensing_records missing columns
--
-- The dispense_prescription_item function in migration 116 inserts into
-- columns that may not exist if dispensing_records was created before them.
-- ============================================================================

alter table dispensing_records
  add column if not exists prescription_id  uuid references prescriptions(id),
  add column if not exists product_id       uuid references products(id),
  add column if not exists unit_price_xaf   numeric(10,2),
  add column if not exists total_price_xaf  numeric(10,2),
  add column if not exists dispensed_at     timestamptz;
