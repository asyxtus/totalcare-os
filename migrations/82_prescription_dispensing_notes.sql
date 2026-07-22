-- ============================================================================
-- COUNSELING NOTES — added as a plain column, updated via a separate
-- statement AFTER dispense_prescription_item runs, not as a new
-- parameter on that function. Given this session's history with
-- ambiguous overloads, touching a function I don't have full internal
-- visibility into (dispense_prescription_item was built outside this
-- sandbox) is exactly the kind of change that's caused four bugs
-- already. Sidestepping that risk entirely for a feature that doesn't
-- need it.
-- ============================================================================

alter table prescription_items add column if not exists dispensing_notes text;
