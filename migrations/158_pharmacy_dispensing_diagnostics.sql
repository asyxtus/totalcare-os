-- ============================================================================
-- MIGRATION 158: PHARMACY DISPENSING DIAGNOSTICS / HARDENING
--
-- The live database confirms the guarded dispensing RPC has the expected
-- 10-argument signature. Keep this migration additive: do not create an
-- overloaded dispensing function.
--
-- The dispensing transaction is atomic because the RPC is one PostgreSQL
-- function call. Any exception rolls back its inserts, stock movements,
-- prescription update, and service charge together.
-- ============================================================================

-- Explicitly remove any legacy 9-argument overload if it exists. The live
-- application calls the 10-argument function and should never resolve to an
-- older implementation.
drop function if exists public.dispense_prescription_item(
  uuid, integer, uuid, uuid, boolean, text, uuid, numeric, uuid
);

-- Revoke direct execution from the anonymous role; authenticated staff access
-- remains governed by the existing application/RPC security model.
revoke execute on function public.dispense_prescription_item(
  uuid, integer, uuid, uuid, boolean, text, uuid, numeric, uuid, boolean
) from anon;

-- Grant execution to authenticated users. The function itself is SECURITY
-- DEFINER and performs the clinical/stock checks.
grant execute on function public.dispense_prescription_item(
  uuid, integer, uuid, uuid, boolean, text, uuid, numeric, uuid, boolean
) to authenticated;
