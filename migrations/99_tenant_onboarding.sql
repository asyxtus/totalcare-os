-- ============================================================================
-- TENANT ONBOARDING: provision_clinic()
--
-- The gap flagged back when the lab catalog became clinic-owned
-- (95_lab_catalog_clinic_scoping.sql): a brand-new clinic tenant starts
-- with an EMPTY catalog — no services, no lab tests, no wards. Nothing
-- to sell, nothing to order, on day one. This is what closes that gap.
--
-- Scope decision, stated plainly: this is NOT a self-serve signup flow.
-- There's no "platform superadmin" role in this schema, and inventing
-- one just for this would be a new privilege tier built for a signup
-- flow you don't have yet. This is a break-glass operation — reachable
-- only via the service-role client, from a secret-protected API route
-- (app/api/admin/provision-clinic), the same trust model as the
-- nightly billing cron. You run it yourself when you're actually ready
-- to onboard a clinic, not a button anyone can click.
--
-- Cross-tenant by nature (it has to write into a clinic that doesn't
-- exist yet, so no admin's RLS session could ever do this), same
-- justification as accrue_nightly_inpatient_charges(): SECURITY
-- DEFINER, EXECUTE revoked from every normal role.
--
-- Idempotent on clinic name, on purpose: this function only creates and
-- clones catalog data — it does NOT create the first admin account
-- (that needs auth.admin.inviteUserByEmail, which is JS-side only, not
-- something plpgsql can do). If the admin-invite step that follows this
-- function fails, there'd be no admin yet to retry through the normal
-- Staff module — so the API route can safely call this function again
-- with the same clinic_name, and it'll find the clinic already exists
-- and skip straight to returning its id rather than cloning a second
-- time or erroring on a duplicate.
-- ============================================================================

create or replace function provision_clinic(
  p_clinic_name text,
  p_template_clinic_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_test record;
  v_new_test_id uuid;
  v_clt record;
  v_panel record;
  v_new_panel_id uuid;
  v_item record;
begin
  select id into v_clinic_id from clinics where name = p_clinic_name;
  if found then
    return v_clinic_id; -- idempotent retry — see header comment
  end if;

  insert into clinics (name) values (p_clinic_name) returning id into v_clinic_id;

  if p_template_clinic_id is not null then
    -- Services: no cross-referencing needed, straight copy.
    insert into service_prices (clinic_id, service_name, category, price_xaf, service_code, is_active)
    select v_clinic_id, service_name, category, price_xaf, service_code, is_active
    from service_prices where clinic_id = p_template_clinic_id;

    -- Wards: same, no cross-referencing.
    insert into wards (clinic_id, name, code, ward_type, capacity, daily_rate_xaf, is_active)
    select v_clinic_id, name, code, ward_type, capacity, daily_rate_xaf, is_active
    from wards where clinic_id = p_template_clinic_id;

    -- Lab tests: each cloned catalog row gets a NEW id (lab_test_catalog
    -- is clinic-owned as of migration 95 — this clinic gets its own
    -- rows, not a link back to the template's). A plain loop, not a
    -- clever bulk INSERT...SELECT...RETURNING, because the old→new id
    -- mapping is needed afterward for clinic_lab_tests and panel items,
    -- and Postgres can't carry an untracked "old_id" column through a
    -- writable CTE's RETURNING — a loop is the correct tool here, not
    -- a shortcut around one.
    create temp table test_id_map (old_id uuid primary key, new_id uuid not null) on commit drop;

    for v_test in select * from lab_test_catalog where clinic_id = p_template_clinic_id loop
      insert into lab_test_catalog (
        clinic_id, name_fr, name_en, category, specimen_type, unit, result_type,
        reference_range_low, reference_range_high, critical_low, critical_high,
        qualitative_options, abnormal_qualitative_values, critical_qualitative_values
      ) values (
        v_clinic_id, v_test.name_fr, v_test.name_en, v_test.category, v_test.specimen_type, v_test.unit, v_test.result_type,
        v_test.reference_range_low, v_test.reference_range_high, v_test.critical_low, v_test.critical_high,
        v_test.qualitative_options, v_test.abnormal_qualitative_values, v_test.critical_qualitative_values
      ) returning id into v_new_test_id;

      insert into test_id_map (old_id, new_id) values (v_test.id, v_new_test_id);

      select * into v_clt from clinic_lab_tests
        where clinic_id = p_template_clinic_id and lab_test_catalog_id = v_test.id;
      if found then
        insert into clinic_lab_tests (
          clinic_id, lab_test_catalog_id, price_xaf, is_active,
          override_reference_range_low, override_reference_range_high,
          override_critical_low, override_critical_high,
          override_abnormal_qualitative_values, override_critical_qualitative_values
        ) values (
          v_clinic_id, v_new_test_id, v_clt.price_xaf, v_clt.is_active,
          v_clt.override_reference_range_low, v_clt.override_reference_range_high,
          v_clt.override_critical_low, v_clt.override_critical_high,
          v_clt.override_abnormal_qualitative_values, v_clt.override_critical_qualitative_values
        );
      end if;
    end loop;

    -- Lab panels: same new-id-per-clinic reasoning, plus their item
    -- links have to be rebuilt against the NEW test ids via the map
    -- just built above.
    create temp table panel_id_map (old_id uuid primary key, new_id uuid not null) on commit drop;

    for v_panel in select * from lab_panels where clinic_id = p_template_clinic_id loop
      insert into lab_panels (clinic_id, name_fr, name_en, category)
      values (v_clinic_id, v_panel.name_fr, v_panel.name_en, v_panel.category)
      returning id into v_new_panel_id;

      insert into panel_id_map (old_id, new_id) values (v_panel.id, v_new_panel_id);

      for v_item in select * from lab_panel_items where panel_id = v_panel.id loop
        insert into lab_panel_items (panel_id, lab_test_catalog_id)
        select v_new_panel_id, tm.new_id
        from test_id_map tm where tm.old_id = v_item.lab_test_catalog_id;
      end loop;

      insert into clinic_lab_panels (clinic_id, lab_panel_id, price_xaf, is_active)
      select v_clinic_id, v_new_panel_id, cp.price_xaf, cp.is_active
      from clinic_lab_panels cp
      where cp.clinic_id = p_template_clinic_id and cp.lab_panel_id = v_panel.id;
    end loop;
  end if;

  return v_clinic_id;
end;
$$;

-- Locked down hard, same reasoning as accrue_nightly_inpatient_charges:
-- reachable only via the service-role client, never from a logged-in
-- staff session regardless of role.
revoke all on function provision_clinic(text, uuid) from public, anon, authenticated;
