-- ============================================================================
-- PER-PERSON PLATFORM ADMIN ACCOUNTS
--
-- Replaces the single shared PLATFORM_ADMIN_SECRET with individual accounts
-- tied to real Supabase auth users, so the audit log can finally say WHO
-- did something, not just what and when.
--
-- PLATFORM_ADMIN_SECRET doesn't go away — it becomes a bootstrap-only
-- mechanism: it can create the very first admin account (when the table is
-- empty) or serve as an emergency path if every admin is ever locked out.
-- Day-to-day, admins sign in with their own email + password, and any
-- active admin can invite another from within the console.
-- ============================================================================

create table if not exists platform_admins (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name    text not null,
  email        text not null,
  is_active    boolean not null default true,
  invited_by   uuid references platform_admins(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_platform_admins_auth_user on platform_admins(auth_user_id);

alter table platform_admins enable row level security;
-- No policies for `authenticated` — deliberately locked down like the
-- audit log. Every read/write to this table happens through the
-- service-role admin client after the app code has already verified the
-- caller's Supabase session server-side. A regular clinic staff login
-- (even an admin role) has zero visibility into this table.

-- Attribute audit log entries to the admin who performed the action.
-- Nullable + ON DELETE SET NULL: if an admin account is later removed,
-- the historical log entries survive with the name/email preserved as
-- plain text (captured at write time), just without a live FK.
alter table platform_admin_audit_log
  add column if not exists admin_id uuid references platform_admins(id) on delete set null,
  add column if not exists admin_name text,
  add column if not exists admin_email text;
