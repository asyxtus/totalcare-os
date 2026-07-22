-- ============================================================================
-- STOCK ADJUSTMENTS, STEP 1: ADD THE ENUM VALUE — RUN THIS FILE ALONE
-- Postgres won't allow a newly-added enum value to be used in the same
-- transaction it was added in. Supabase's SQL Editor runs a pasted
-- script as one transaction, so this step must be run and committed by
-- itself before running 61_stock_adjustments_step2.sql.
-- ============================================================================

alter type stock_movement_type add value if not exists 'adjustment_increase';
