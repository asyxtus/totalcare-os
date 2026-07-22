-- ============================================================================
-- REPAIR: RE-LINK THE TWO DISPENSES ORPHANED BY THE RLS GAP
-- Both real service_charges were confirmed to exist, correctly
-- attributed, with the right amounts — nothing was ever lost. This
-- just restores the audit trail. Matched by exact timestamp (both pairs
-- share the identical fractional second), so there's no ambiguity
-- about which charge belongs to which dispense.
-- ============================================================================

update dispensing_records
set service_charge_id = 'db6fbba1-cebf-4e88-aa8c-28eb18e7b93d'
where id = 'e7f6b70c-8345-4c78-8b62-28dac2ebed36';

update dispensing_records
set service_charge_id = 'c6d00201-dee9-4d6b-9892-75f54216d0a2'
where id = '5478f726-9f16-464a-a683-8ee612e469fd';

-- Confirm both are now correctly linked
select id, dispensed_at, service_charge_id
from dispensing_records
where id in ('e7f6b70c-8345-4c78-8b62-28dac2ebed36', '5478f726-9f16-464a-a683-8ee612e469fd');
