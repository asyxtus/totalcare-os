-- ============================================================================
-- LAB CATALOG: FROM SHARED PLATFORM TABLE TO PER-CLINIC OWNERSHIP
--
-- lab_test_catalog and lab_panels were built with no clinic_id — every
-- clinic saw the same catalog, and (found this session) a new test or
-- panel created for one clinic would show up as an option for every
-- future tenant too. Fine with one clinic in the system. Not fine the
-- moment a second one is onboarded, since clinic B has no business
-- seeing, let alone building panels out of, clinic A's custom tests.
--
-- This migration makes ownership explicit and enforced at three levels:
--   1. Schema: clinic_id, NOT NULL, backfilled from real activation data.
--   2. Triggers: a clinic can only activate (clinic_lab_tests/
--      clinic_lab_panels) its OWN catalog rows, and a panel can only be
--      built from tests owned by that same clinic — not just "hidden by
--      RLS," actually structurally impossible to cross-link.
--   3. RLS: replaces whatever platform-wide SELECT policy these tables
--      had before (defined pre-dating this migration set, name unknown
--      from here — discovered and dropped dynamically rather than
--      guessed) with clinic-scoped ones.
--
-- Known consequence, not a bug: a brand-new clinic tenant now starts
-- with an EMPTY lab catalog — no tests, no panels — since there's no
-- shared starter set to inherit from anymore. That's the honest tradeoff
-- of real isolation. Worth building a "clone starter catalog into new
-- tenant" step into onboarding later; out of scope for this migration.
-- ============================================================================

-- ── Step 1: add ownership column ───────────────────────────────────────
alter table lab_test_catalog add column if not exists clinic_id uuid references clinics(id);
alter table lab_panels add column if not exists clinic_id uuid references clinics(id);

-- ── Step 2: backfill from real activation records — a catalog row
-- activated (priced) by exactly one clinic obviously belongs to that
-- clinic. This is the actual signal, not a guess. ────────────────────
update lab_test_catalog cat
set clinic_id = clt.clinic_id
from clinic_lab_tests clt
where clt.lab_test_catalog_id = cat.id
  and cat.clinic_id is null;

update lab_panels p
set clinic_id = cp.clinic_id
from clinic_lab_panels cp
where cp.lab_panel_id = p.id
  and p.clinic_id is null;

-- ── Step 3: anything still unowned (seeded but never activated by any
-- clinic) — only safe to auto-assign if exactly one clinic exists in
-- the system. If you're reading this after onboarding clinic #2 and it
-- fires, it means there's genuinely ambiguous reference data that needs
-- a human decision, not an automatic guess. ──────────────────────────
do $$
declare
  v_clinic_count int;
  v_only_clinic_id uuid;
  v_orphan_tests int;
  v_orphan_panels int;
begin
  select count(*) into v_orphan_tests from lab_test_catalog where clinic_id is null;
  select count(*) into v_orphan_panels from lab_panels where clinic_id is null;

  if v_orphan_tests = 0 and v_orphan_panels = 0 then
    return;
  end if;

  select count(*) into v_clinic_count from clinics;

  if v_clinic_count = 1 then
    select id into v_only_clinic_id from clinics limit 1;
    update lab_test_catalog set clinic_id = v_only_clinic_id where clinic_id is null;
    update lab_panels set clinic_id = v_only_clinic_id where clinic_id is null;
  else
    raise exception
      'Found % unowned lab_test_catalog row(s) and % unowned lab_panels row(s), and % clinics exist — cannot auto-assign ownership safely. Set clinic_id on these rows manually before re-running this migration.',
      v_orphan_tests, v_orphan_panels, v_clinic_count;
  end if;
end $$;

-- ── Step 4: enforce ownership going forward ────────────────────────────
alter table lab_test_catalog alter column clinic_id set not null;
alter table lab_panels alter column clinic_id set not null;

-- ── Step 5: structural guards — not just RLS-hidden, actually
-- impossible to activate or link across clinics. ──────────────────────
create or replace function check_clinic_lab_test_ownership()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from lab_test_catalog where id = NEW.lab_test_catalog_id and clinic_id = NEW.clinic_id
  ) then
    raise exception 'This test does not belong to this clinic — cannot activate it here.';
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_check_clinic_lab_test_ownership on clinic_lab_tests;
create trigger trg_check_clinic_lab_test_ownership
  before insert or update on clinic_lab_tests
  for each row execute function check_clinic_lab_test_ownership();

create or replace function check_clinic_lab_panel_ownership()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from lab_panels where id = NEW.lab_panel_id and clinic_id = NEW.clinic_id
  ) then
    raise exception 'This panel does not belong to this clinic — cannot activate it here.';
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_check_clinic_lab_panel_ownership on clinic_lab_panels;
create trigger trg_check_clinic_lab_panel_ownership
  before insert or update on clinic_lab_panels
  for each row execute function check_clinic_lab_panel_ownership();

create or replace function check_lab_panel_item_same_clinic()
returns trigger language plpgsql as $$
declare
  v_panel_clinic uuid;
  v_test_clinic uuid;
begin
  select clinic_id into v_panel_clinic from lab_panels where id = NEW.panel_id;
  select clinic_id into v_test_clinic from lab_test_catalog where id = NEW.lab_test_catalog_id;
  if v_panel_clinic is distinct from v_test_clinic then
    raise exception 'Cannot add a test from a different clinic''s catalog to this panel.';
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_check_lab_panel_item_same_clinic on lab_panel_items;
create trigger trg_check_lab_panel_item_same_clinic
  before insert or update on lab_panel_items
  for each row execute function check_lab_panel_item_same_clinic();

-- ── Step 6: RLS — drop whatever platform-wide policies pre-date this
-- migration (names unknown from here, discovered dynamically) and
-- replace with clinic-scoped SELECT. Writes to these three tables
-- happen only through the service-role client in
-- lib/actions/pricingAdmin.ts (same security model as staff invites —
-- see 94_staff_admin_management.sql), so no client-facing write policy
-- is added; a guessed-at admin RLS policy here would be redundant at
-- best and a false sense of security at worst. ────────────────────────
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'lab_test_catalog' loop
    execute format('drop policy %I on lab_test_catalog', pol.policyname);
  end loop;
  for pol in select policyname from pg_policies where tablename = 'lab_panels' loop
    execute format('drop policy %I on lab_panels', pol.policyname);
  end loop;
  for pol in select policyname from pg_policies where tablename = 'lab_panel_items' loop
    execute format('drop policy %I on lab_panel_items', pol.policyname);
  end loop;
end $$;

alter table lab_test_catalog enable row level security;
alter table lab_panels enable row level security;
alter table lab_panel_items enable row level security;

create policy lab_test_catalog_select on lab_test_catalog for select using (
  clinic_id = current_staff_clinic_id()
);

create policy lab_panels_select on lab_panels for select using (
  clinic_id = current_staff_clinic_id()
);

create policy lab_panel_items_select on lab_panel_items for select using (
  exists (
    select 1 from lab_panels p
    where p.id = lab_panel_items.panel_id and p.clinic_id = current_staff_clinic_id()
  )
);
