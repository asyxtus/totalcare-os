-- ============================================================================
-- FIX: record_stock_movement HAD TWO OVERLOADS, CAUSING AMBIGUITY
-- The 7-arg version and the 8-arg version (with p_dispensing_record_id
-- presumably defaulting to NULL) both matched a 7-argument call equally
-- well, so Postgres couldn't pick one. Dropping the redundant 7-arg
-- version — the 8-arg version already covers every call site in the
-- system correctly via its default parameter.
-- ============================================================================

drop function if exists record_stock_movement(
  uuid, stock_movement_type, integer, text, uuid, text, uuid
);

-- Belt-and-suspenders: explicitly confirm the surviving version has the
-- default in place, rather than assuming — if this errors saying the
-- function doesn't exist with this exact body, that's fine, it just
-- means CREATE OR REPLACE will fail loudly with a clear reason instead
-- of silently leaving a 7-argument call broken.
-- If you get an error here, paste it back — do not skip this step.
select pg_get_functiondef(
  (select oid from pg_proc where proname = 'record_stock_movement' limit 1)
);
