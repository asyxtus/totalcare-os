-- ============================================================================
-- FIX: visit_status_events had NO row-level security at all
--
-- Found via a pre-launch multi-tenant audit: this table (added in migration
-- 123 for wait-time tracking) was created without RLS enabled and with zero
-- policies. Any authenticated user, from any clinic, could read every
-- clinic's visit-status timeline. Not financial data, but real cross-tenant
-- exposure, and a bug introduced this session.
--
-- IMPORTANT: this table is populated by a trigger (log_visit_status_change)
-- that fires on every visits insert/update. With RLS OFF, every insert
-- from that trigger silently succeeded. Enabling RLS with only a SELECT
-- policy — no INSERT policy — would make every visit registration/status
-- change fail from this point forward. Both policies are required together.
-- ============================================================================

alter table visit_status_events enable row level security;

create policy visit_status_events_select
  on visit_status_events
  for select
  using (clinic_id = current_staff_clinic_id());

-- The trigger inserts using NEW.clinic_id from the visits row being
-- changed, which is already clinic-scoped by visits' own RLS — so in
-- normal operation this will always match the inserting staff member's
-- clinic. Mirrors the trigger-insert pattern already used elsewhere
-- (e.g. stock_movements_insert_via_function).
create policy visit_status_events_insert
  on visit_status_events
  for insert
  with check (clinic_id = current_staff_clinic_id());
