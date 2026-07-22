-- ============================================================================
-- FIX: dispense_fefo HAD THREE OVERLOADS, CAUSING AMBIGUITY
-- Same pattern as record_stock_movement earlier — each of the three
-- versions has the last param(s) presumably defaulted, so a 9-argument
-- call matched all three at once. Dropping the two older/shorter
-- versions, keeping only the most complete 11-argument one.
-- ============================================================================

drop function if exists dispense_fefo(
  uuid, uuid, integer, text, uuid, uuid, boolean, text, uuid
);

drop function if exists dispense_fefo(
  uuid, uuid, integer, text, uuid, uuid, boolean, text, uuid, uuid
);

-- Belt-and-suspenders: show the definition of whatever's left, to
-- confirm it actually has defaults for the trailing params (otherwise
-- a 9-argument call would now fail with "no function matches" instead
-- of "not unique" — a different but related problem).
select pg_get_functiondef(
  (select oid from pg_proc where proname = 'dispense_fefo' limit 1)
);
