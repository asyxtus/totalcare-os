-- ============================================================================
-- FIX: FOUR MORE AMBIGUOUS OVERLOADS FOUND BY THE AUDIT
-- Two of these (complete_consultation, and likely record_goods_receipt/
-- register_visit_with_charge from the multi-tenant hardening pass) were
-- introduced by me earlier this session — before I'd caught the pattern
-- with discharge_patient. Genuinely worth naming: applying a lesson
-- only after the mistake it addresses, rather than before, is itself
-- a real failure worth acknowledging, not just quietly patching over.
-- ============================================================================

drop function if exists complete_consultation(uuid, uuid, uuid, boolean);
drop function if exists complete_consultation(uuid, uuid, uuid, boolean, boolean);

drop function if exists dispense_prescription_item(uuid, integer, uuid, uuid, boolean, text, uuid);

drop function if exists record_goods_receipt(uuid, uuid, uuid, text, text, jsonb);

drop function if exists register_visit_with_charge(uuid, uuid, text, uuid, uuid);

-- Confirm exactly one version of each remains, with the full argument
-- list — review this before trusting any of them are fixed.
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('complete_consultation', 'dispense_prescription_item', 'record_goods_receipt', 'register_visit_with_charge')
order by p.proname;
