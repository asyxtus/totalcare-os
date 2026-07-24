-- ============================================================================
-- MULTI-ROLE STAFF SUPPORT
--
-- Lets one person hold more than one role (e.g. nurse + receptionist,
-- doctor + admin) and switch which one is "active" at a time — rather
-- than true simultaneous access to both role's permissions at once.
--
-- Why switchable-one-at-a-time rather than true simultaneous OR access:
-- current_staff_role() is used throughout RLS as
--   current_staff_role() = ANY (ARRAY['admin','doctor',...])
-- across dozens of policies this session didn't write and doesn't have
-- full visibility into (many predate this session). Redefining what
-- current_staff_role() RETURNS — while keeping its signature and the
-- fact that it returns exactly ONE role — means every existing policy
-- keeps working completely unchanged. Rewriting every policy instead to
-- support true multi-role OR-access would mean touching security-critical
-- code this session can't fully audit, which is a materially bigger risk
-- than "switch your hat, then act" for what is fundamentally a small-
-- clinic staffing convenience, not a security requirement.
-- ============================================================================

-- Which role is currently "worn." NULL means "use my primary role" (the
-- common case — most staff only ever have one role and never touch this).
alter table staff add column if not exists active_role staff_role;

-- Additional roles a person holds beyond their primary staff.role. The
-- primary role itself is NOT duplicated in here — it's already on staff.role.
create table if not exists staff_secondary_roles (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  role       staff_role not null,
  granted_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (staff_id, role)
);

create index if not exists idx_staff_secondary_roles_staff on staff_secondary_roles(staff_id);

alter table staff_secondary_roles enable row level security;

create policy staff_secondary_roles_select
  on staff_secondary_roles
  for select
  using (
    staff_id in (select id from staff where clinic_id = current_staff_clinic_id())
  );

create policy staff_secondary_roles_write
  on staff_secondary_roles
  for all
  using (
    current_staff_role() = 'admin'
    and staff_id in (select id from staff where clinic_id = current_staff_clinic_id())
  )
  with check (
    current_staff_role() = 'admin'
    and staff_id in (select id from staff where clinic_id = current_staff_clinic_id())
  );

-- DROP-IN REPLACEMENT — same name, same signature, same return type as
-- before. Every existing RLS policy that calls current_staff_role()
-- continues to work exactly as written; it just now returns the active
-- role (if one has been explicitly selected) instead of always the
-- primary role. For the ~95% of staff with only one role, active_role
-- stays NULL forever and behavior is byte-for-byte identical to before.
create or replace function current_staff_role()
returns staff_role
language sql
stable
as $$
  select coalesce(active_role, role) from staff
  where auth_user_id = auth.uid() and is_active = true
  limit 1
$$;

-- Every role a signed-in person is allowed to switch into: their primary
-- role plus whatever's in staff_secondary_roles. Used to populate the
-- role-switcher UI and to validate a switch request server-side (never
-- trust the client to only offer roles the person actually holds).
create or replace function current_staff_available_roles()
returns staff_role[]
language sql
stable
as $$
  select array_agg(distinct r) from (
    select role as r from staff
    where auth_user_id = auth.uid() and is_active = true
    union
    select ssr.role as r from staff_secondary_roles ssr
    join staff s on s.id = ssr.staff_id
    where s.auth_user_id = auth.uid() and s.is_active = true
  ) roles
$$;
