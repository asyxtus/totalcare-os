-- ============================================================================
-- PLATFORM ADMIN AUDIT LOG
--
-- Right now /platform-admin is gated by one shared secret with no record
-- of who did what. This table logs every privileged action (provision,
-- rename, suspend/reactivate) with a timestamp, so at minimum there's a
-- timeline to review even before per-person platform-admin accounts exist.
--
-- Deliberately NOT clinic-scoped like the regular audit_log table — a
-- clinic provisioning action happens before the clinic exists, and this
-- log needs to survive a clinic being suspended/renamed to remain a
-- trustworthy record of what happened to it. It's platform-wide by nature.
--
-- RLS is enabled with ZERO policies for the `authenticated` role — this
-- table should only ever be touched by the admin (service-role) client
-- that already bypasses RLS, matching how the rest of /platform-admin
-- works. No regular staff login should ever be able to read or write it.
-- ============================================================================

create table if not exists platform_admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  action       text not null,        -- 'provision_clinic' | 'rename_clinic' | 'suspend_clinic' | 'reactivate_clinic'
  clinic_id    uuid references clinics(id) on delete set null,
  clinic_name  text,                 -- snapshot at the time of the action — survives a later rename
  detail       jsonb,                -- e.g. {"from": "Old Name", "to": "New Name"} for renames
  created_at   timestamptz not null default now()
);

create index if not exists idx_platform_admin_audit_log_created on platform_admin_audit_log (created_at desc);
create index if not exists idx_platform_admin_audit_log_clinic on platform_admin_audit_log (clinic_id);

alter table platform_admin_audit_log enable row level security;
-- No policies added deliberately — authenticated users get zero access by
-- default once RLS is on. Only the service-role admin client (which
-- bypasses RLS entirely) can read or write this table.
