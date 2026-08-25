-- ============================================================================
-- MIGRATION 144: DIRECT LABORATORY / ANCILLARY VISITS
--
-- A patient may arrive specifically for laboratory work without seeing a
-- clinician first. Previously lab_orders.visit_id required a normal visit and
-- the existing lab completion workflow returned every waiting_lab visit to
-- waiting_consultation, which is wrong for a direct laboratory encounter.
--
-- This migration keeps the existing financial model intact:
--   patient -> visit -> lab order -> service charges -> invoice -> cashier
-- and marks the encounter so it can finish without creating a consultation.
-- The same encounter_type column can later support direct imaging encounters.
-- ============================================================================

alter table visits
  add column if not exists encounter_type text not null default 'consultation';

alter table visits
  drop constraint if exists visits_encounter_type_check;

alter table visits
  add constraint visits_encounter_type_check
  check (encounter_type in ('consultation', 'direct_lab', 'direct_imaging', 'other_ancillary'));

create index if not exists idx_visits_clinic_encounter_type
  on visits(clinic_id, encounter_type, created_at desc);

-- ----------------------------------------------------------------------------
-- Direct laboratory registration.
-- Creates the visit, lab order, line items, service charges and one invoice
-- atomically. No consultation charge is created.
-- ----------------------------------------------------------------------------
create or replace function create_direct_lab_visit(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_registered_by uuid,
  p_items jsonb,
  p_reason text default null
)
returns table (
  visit_id uuid,
  lab_order_id uuid,
  invoice_id uuid,
  service_charge_ids uuid[],
  total_amount_xaf numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role staff_role;
  v_existing_visit uuid;
  v_visit_id uuid;
  v_order_id uuid;
  v_charge_ids uuid[] := array[]::uuid[];
  v_invoice_id uuid;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_type text;
  v_panel_id uuid;
  v_test_id uuid;
  v_price numeric(12,2);
  v_name text;
  v_charge_id uuid;
begin
  select coalesce(active_role, role) into v_role
  from staff
  where id = p_registered_by
    and clinic_id = p_clinic_id
    and is_active = true;

  if v_role is null then
    raise exception 'Staff member not found or inactive in this clinic';
  end if;

  if v_role not in ('admin', 'receptionist', 'billing_clerk', 'doctor', 'lab_technician') then
    raise exception 'Staff role % cannot register a direct laboratory visit', v_role;
  end if;

  if not exists (
    select 1 from patients
    where id = p_patient_id and clinic_id = p_clinic_id
  ) then
    raise exception 'Patient does not belong to this clinic';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one laboratory test or panel is required';
  end if;

  -- Do not silently attach a direct laboratory visit to an unrelated active
  -- consultation/triage visit. The receptionist should use that existing
  -- visit if the patient is already in the normal clinical workflow.
  select id into v_existing_visit
  from visits
  where patient_id = p_patient_id
    and clinic_id = p_clinic_id
    and status not in ('discharged', 'cancelled')
  order by created_at desc
  limit 1
  for update;

  if v_existing_visit is not null then
    raise exception 'Patient already has an active visit (%). Use the existing visit instead of opening a second visit.', v_existing_visit;
  end if;

  insert into visits (
    clinic_id,
    patient_id,
    visit_reason,
    status,
    registered_by,
    encounter_type
  ) values (
    p_clinic_id,
    p_patient_id,
    coalesce(nullif(trim(p_reason), ''), 'Direct laboratory services'),
    'waiting_lab',
    p_registered_by,
    'direct_lab'
  )
  returning id into v_visit_id;

  insert into lab_orders (clinic_id, visit_id, ordered_by, notes)
  values (
    p_clinic_id,
    v_visit_id,
    p_registered_by,
    'Direct laboratory visit — no consultation'
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_type := v_item->>'type';

    if v_type = 'individual_test' then
      v_test_id := nullif(v_item->>'catalog_id', '')::uuid;

      select clt.price_xaf, cat.name_fr
      into v_price, v_name
      from clinic_lab_tests clt
      join lab_test_catalog cat on cat.id = clt.lab_test_catalog_id
      where clt.clinic_id = p_clinic_id
        and clt.lab_test_catalog_id = v_test_id
        and clt.is_active = true;

      if v_price is null then
        raise exception 'Laboratory test % is not active or not configured for this clinic', v_test_id;
      end if;

      v_charge_id := create_service_charge(
        p_clinic_id,
        p_patient_id,
        v_visit_id,
        null,
        'lab',
        v_name,
        v_price,
        p_registered_by
      );

      v_charge_ids := array_append(v_charge_ids, v_charge_id);
      v_total := v_total + v_price;

      insert into lab_order_items (
        lab_order_id, clinic_id, item_type, lab_test_catalog_id, service_charge_id
      ) values (
        v_order_id, p_clinic_id, 'individual_test', v_test_id, v_charge_id
      );

    elsif v_type = 'panel' then
      v_panel_id := nullif(v_item->>'panel_id', '')::uuid;

      select clp.price_xaf, lp.name_fr
      into v_price, v_name
      from clinic_lab_panels clp
      join lab_panels lp on lp.id = clp.lab_panel_id
      where clp.clinic_id = p_clinic_id
        and clp.lab_panel_id = v_panel_id
        and clp.is_active = true;

      if v_price is null then
        raise exception 'Laboratory panel % is not active or not configured for this clinic', v_panel_id;
      end if;

      v_charge_id := create_service_charge(
        p_clinic_id,
        p_patient_id,
        v_visit_id,
        null,
        'lab',
        v_name,
        v_price,
        p_registered_by
      );

      v_charge_ids := array_append(v_charge_ids, v_charge_id);
      v_total := v_total + v_price;

      insert into lab_order_items (
        lab_order_id, clinic_id, item_type, lab_panel_id, service_charge_id
      ) values (
        v_order_id, p_clinic_id, 'panel', v_panel_id, v_charge_id
      );

    else
      raise exception 'Direct laboratory visits support only individual_test or panel items';
    end if;
  end loop;

  v_invoice_id := open_invoice_for_charges(v_charge_ids, p_registered_by);

  insert into audit_log (
    clinic_id, staff_id, action, entity_type, entity_id, details
  ) values (
    p_clinic_id,
    p_registered_by,
    'laboratory.direct_visit_created',
    'visit',
    v_visit_id,
    jsonb_build_object(
      'lab_order_id', v_order_id,
      'invoice_id', v_invoice_id,
      'service_charge_ids', v_charge_ids,
      'total_amount_xaf', v_total,
      'reason', p_reason
    )
  );

  return query select v_visit_id, v_order_id, v_invoice_id, v_charge_ids, v_total;
end;
$$;

revoke all on function create_direct_lab_visit(uuid, uuid, uuid, jsonb, text) from public;
grant execute on function create_direct_lab_visit(uuid, uuid, uuid, jsonb, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Direct-lab completion must discharge the encounter rather than returning
-- the patient to the consultation queue. Normal consultation-linked lab
-- encounters retain the old behaviour.
-- ----------------------------------------------------------------------------
create or replace function complete_lab_order_item(
  p_lab_order_item_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
as $$
declare
  v_has_result boolean;
  v_has_attachment boolean;
  v_visit_id uuid;
  v_clinic_id uuid;
  v_visit_status visit_status;
  v_encounter_type text;
  v_remaining_in_house_items int;
begin
  select exists(
    select 1 from lab_results where lab_order_item_id = p_lab_order_item_id
  ) into v_has_result;

  select exists(
    select 1 from lab_result_attachments where lab_order_item_id = p_lab_order_item_id
  ) into v_has_attachment;

  if not v_has_result and not v_has_attachment then
    raise exception 'Cannot complete: no result value or attachment has been recorded for this item';
  end if;

  update lab_order_items
  set status = 'completed'
  where id = p_lab_order_item_id;

  if not found then
    raise exception 'Laboratory item % not found', p_lab_order_item_id;
  end if;

  select lo.visit_id, lo.clinic_id
  into v_visit_id, v_clinic_id
  from lab_order_items loi
  join lab_orders lo on lo.id = loi.lab_order_id
  where loi.id = p_lab_order_item_id;

  select status, encounter_type
  into v_visit_status, v_encounter_type
  from visits
  where id = v_visit_id;

  if v_visit_status = 'waiting_lab' then
    select count(*)
    into v_remaining_in_house_items
    from lab_order_items loi
    join lab_orders lo on lo.id = loi.lab_order_id
    where lo.visit_id = v_visit_id
      and loi.item_type <> 'external'
      and loi.status not in ('completed', 'cancelled');

    if v_remaining_in_house_items = 0 then
      if v_encounter_type = 'direct_lab' then
        update visits
        set status = 'discharged'
        where id = v_visit_id;

        insert into audit_log (
          clinic_id, staff_id, action, entity_type, entity_id, details
        ) values (
          v_clinic_id,
          p_staff_id,
          'visit.direct_lab_completed',
          'visit',
          v_visit_id,
          '{}'::jsonb
        );
      else
        update visits
        set status = 'waiting_consultation'
        where id = v_visit_id;

        insert into audit_log (
          clinic_id, staff_id, action, entity_type, entity_id, details
        ) values (
          v_clinic_id,
          p_staff_id,
          'visit.returned_to_doctor_after_lab',
          'visit',
          v_visit_id,
          '{}'::jsonb
        );
      end if;
    end if;
  end if;
end;
$$;

-- Backward-compatible metadata for administrators/reporting.
comment on column visits.encounter_type is
  'Encounter classification: consultation, direct_lab, direct_imaging, or other_ancillary';
