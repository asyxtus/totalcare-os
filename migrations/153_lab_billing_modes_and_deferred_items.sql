-- ============================================================================
-- MIGRATION 153: FLEXIBLE LABORATORY BILLING
--
-- Clinical order != financial payment.
-- Supports:
--   pay_now           : test is billable and should be paid before processing
--   charge_to_encounter: test is authorized for emergency/admission and can
--                        be performed now; payment may be settled later
--   deferred          : ordered clinically, but intentionally not billed or
--                        performed yet because the patient deferred it
--
-- Existing calls to create_lab_order remain compatible: when no billing mode
-- is supplied, the historical pay-now behaviour is preserved.
-- ============================================================================

alter table lab_orders
  add column if not exists billing_mode text not null default 'pay_now';

alter table lab_orders
  drop constraint if exists lab_orders_billing_mode_check;

alter table lab_orders
  add constraint lab_orders_billing_mode_check
  check (billing_mode in ('pay_now','charge_to_encounter','deferred'));

alter table lab_order_items
  add column if not exists billing_status text not null default 'pending_payment';

alter table lab_order_items
  drop constraint if exists lab_order_items_billing_status_check;

alter table lab_order_items
  add constraint lab_order_items_billing_status_check
  check (billing_status in ('pending_payment','authorized','paid','deferred','cancelled'));

create index if not exists idx_lab_order_items_billing_status
  on lab_order_items(clinic_id, billing_status, status);

-- ---------------------------------------------------------------------------
-- Rebuild create_lab_order with an optional billing mode.
-- ---------------------------------------------------------------------------
drop function if exists public.create_lab_order(uuid, uuid, uuid, jsonb);

create or replace function public.create_lab_order(
  p_clinic_id uuid,
  p_visit_id uuid,
  p_ordered_by uuid,
  p_items jsonb,
  p_billing_mode text default 'pay_now'
)
returns table (lab_order_id uuid, service_charge_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_item_type text;
  v_charge_ids uuid[] := array[]::uuid[];
  v_charge_id uuid;
  v_price numeric(10,2);
  v_name text;
  v_item_billing_status text;
begin
  if p_billing_mode not in ('pay_now','charge_to_encounter','deferred') then
    raise exception 'Invalid laboratory billing mode: %', p_billing_mode;
  end if;

  select patient_id into v_patient_id
  from visits
  where id = p_visit_id and clinic_id = p_clinic_id;

  if v_patient_id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;

  insert into lab_orders (clinic_id, visit_id, ordered_by, billing_mode)
  values (p_clinic_id, p_visit_id, p_ordered_by, p_billing_mode)
  returning id into v_order_id;

  v_item_billing_status := case
    when p_billing_mode = 'charge_to_encounter' then 'authorized'
    when p_billing_mode = 'deferred' then 'deferred'
    else 'pending_payment'
  end;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_type := v_item->>'type';

    if v_item_type = 'panel' then
      if p_billing_mode = 'deferred' then
        select lp.name_fr into v_name
        from lab_panels lp
        join clinic_lab_panels clp on clp.lab_panel_id = lp.id
        where clp.clinic_id = p_clinic_id
          and clp.lab_panel_id = (v_item->>'panel_id')::uuid
          and clp.is_active;
        if v_name is null then
          raise exception 'Panel % is not available for this clinic', v_item->>'panel_id';
        end if;

        insert into lab_order_items (lab_order_id, clinic_id, item_type, lab_panel_id, billing_status)
        values (v_order_id, p_clinic_id, 'panel', (v_item->>'panel_id')::uuid, 'deferred');
      else
        select clp.price_xaf, lp.name_fr into v_price, v_name
        from clinic_lab_panels clp
        join lab_panels lp on lp.id = clp.lab_panel_id
        where clp.clinic_id = p_clinic_id
          and clp.lab_panel_id = (v_item->>'panel_id')::uuid
          and clp.is_active;

        if v_price is null then
          raise exception 'Panel % is not available for this clinic', v_item->>'panel_id';
        end if;

        v_charge_id := create_service_charge(
          p_clinic_id, v_patient_id, p_visit_id, null, 'lab', v_name, v_price, p_ordered_by
        );
        v_charge_ids := array_append(v_charge_ids, v_charge_id);

        insert into lab_order_items (
          lab_order_id, clinic_id, item_type, lab_panel_id, service_charge_id, billing_status
        ) values (
          v_order_id, p_clinic_id, 'panel', (v_item->>'panel_id')::uuid, v_charge_id, v_item_billing_status
        );
      end if;

    elsif v_item_type = 'individual_test' then
      if p_billing_mode = 'deferred' then
        select cat.name_fr into v_name
        from clinic_lab_tests clt
        join lab_test_catalog cat on cat.id = clt.lab_test_catalog_id
        where clt.clinic_id = p_clinic_id
          and clt.lab_test_catalog_id = (v_item->>'catalog_id')::uuid
          and clt.is_active;
        if v_name is null then
          raise exception 'Test % is not available for this clinic', v_item->>'catalog_id';
        end if;

        insert into lab_order_items (lab_order_id, clinic_id, item_type, lab_test_catalog_id, billing_status)
        values (v_order_id, p_clinic_id, 'individual_test', (v_item->>'catalog_id')::uuid, 'deferred');
      else
        select clt.price_xaf, cat.name_fr into v_price, v_name
        from clinic_lab_tests clt
        join lab_test_catalog cat on cat.id = clt.lab_test_catalog_id
        where clt.clinic_id = p_clinic_id
          and clt.lab_test_catalog_id = (v_item->>'catalog_id')::uuid
          and clt.is_active;

        if v_price is null then
          raise exception 'Test % is not available for this clinic', v_item->>'catalog_id';
        end if;

        v_charge_id := create_service_charge(
          p_clinic_id, v_patient_id, p_visit_id, null, 'lab', v_name, v_price, p_ordered_by
        );
        v_charge_ids := array_append(v_charge_ids, v_charge_id);

        insert into lab_order_items (
          lab_order_id, clinic_id, item_type, lab_test_catalog_id, service_charge_id, billing_status
        ) values (
          v_order_id, p_clinic_id, 'individual_test', (v_item->>'catalog_id')::uuid, v_charge_id, v_item_billing_status
        );
      end if;

    elsif v_item_type = 'external' then
      insert into lab_order_items (lab_order_id, clinic_id, item_type, external_test_name, billing_status)
      values (v_order_id, p_clinic_id, 'external', v_item->>'name', 'authorized');
    else
      raise exception 'Unknown lab order item type: %', v_item_type;
    end if;
  end loop;

  return query select v_order_id, v_charge_ids;
end;
$$;

revoke all on function public.create_lab_order(uuid, uuid, uuid, jsonb, text) from public;
grant execute on function public.create_lab_order(uuid, uuid, uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Defer an ordered lab item before it is performed.
-- This preserves the clinical order while removing its financial liability.
-- ---------------------------------------------------------------------------
create or replace function public.defer_lab_order_item(
  p_lab_order_item_id uuid,
  p_staff_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_charge_id uuid;
  v_status text;
  v_billing_status text;
  v_role staff_role;
begin
  select lo.clinic_id, loi.service_charge_id, loi.status::text, loi.billing_status
    into v_clinic_id, v_charge_id, v_status, v_billing_status
  from lab_order_items loi
  join lab_orders lo on lo.id = loi.lab_order_id
  where loi.id = p_lab_order_item_id
  for update;

  select coalesce(active_role, role) into v_role
  from staff where id = p_staff_id and clinic_id = v_clinic_id and is_active;

  if v_role not in ('admin','receptionist','billing_clerk','doctor') then
    raise exception 'Staff role is not authorized to defer laboratory charges';
  end if;

  if v_status <> 'pending' then
    raise exception 'Only a pending laboratory item can be deferred';
  end if;

  if v_billing_status in ('paid','authorized') then
    raise exception 'This laboratory item is already paid or authorized and cannot be deferred';
  end if;

  if v_charge_id is not null then
    update service_charges
    set status = 'cancelled'
    where id = v_charge_id
      and amount_paid_xaf = 0;

    if not found then
      raise exception 'The laboratory charge has already received payment and cannot be deferred';
    end if;
  end if;

  update lab_order_items
  set billing_status = 'deferred'
  where id = p_lab_order_item_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    v_clinic_id, p_staff_id, 'laboratory.item_deferred', 'lab_order_item',
    p_lab_order_item_id,
    jsonb_build_object('reason', p_reason, 'service_charge_id', v_charge_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Re-activate a deferred item for payment or for encounter billing.
-- ---------------------------------------------------------------------------
create or replace function public.activate_deferred_lab_order_item(
  p_lab_order_item_id uuid,
  p_staff_id uuid,
  p_billing_mode text default 'pay_now'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_patient_id uuid;
  v_visit_id uuid;
  v_item_type text;
  v_test_id uuid;
  v_panel_id uuid;
  v_price numeric(12,2);
  v_name text;
  v_charge_id uuid;
  v_role staff_role;
begin
  if p_billing_mode not in ('pay_now','charge_to_encounter') then
    raise exception 'Invalid activation billing mode';
  end if;

  select lo.clinic_id, lo.visit_id, loi.item_type::text, loi.lab_test_catalog_id, loi.lab_panel_id
    into v_clinic_id, v_visit_id, v_item_type, v_test_id, v_panel_id
  from lab_order_items loi
  join lab_orders lo on lo.id = loi.lab_order_id
  where loi.id = p_lab_order_item_id
    and loi.billing_status = 'deferred'
    and loi.status = 'pending'
  for update;

  if v_clinic_id is null then
    raise exception 'Deferred laboratory item not found or is no longer pending';
  end if;

  select coalesce(active_role, role) into v_role
  from staff where id = p_staff_id and clinic_id = v_clinic_id and is_active;
  if v_role not in ('admin','receptionist','billing_clerk','doctor') then
    raise exception 'Staff role is not authorized to activate laboratory billing';
  end if;

  select patient_id into v_patient_id from visits where id = v_visit_id;

  if v_item_type = 'individual_test' then
    select clt.price_xaf, cat.name_fr into v_price, v_name
    from clinic_lab_tests clt
    join lab_test_catalog cat on cat.id = clt.lab_test_catalog_id
    where clt.clinic_id = v_clinic_id and clt.lab_test_catalog_id = v_test_id and clt.is_active;
  else
    select clp.price_xaf, lp.name_fr into v_price, v_name
    from clinic_lab_panels clp
    join lab_panels lp on lp.id = clp.lab_panel_id
    where clp.clinic_id = v_clinic_id and clp.lab_panel_id = v_panel_id and clp.is_active;
  end if;

  if v_price is null then
    raise exception 'The laboratory item is no longer active or priced for this clinic';
  end if;

  v_charge_id := create_service_charge(
    v_clinic_id, v_patient_id, v_visit_id, null, 'lab', v_name, v_price, p_staff_id
  );

  update lab_order_items
  set service_charge_id = v_charge_id,
      billing_status = case when p_billing_mode = 'charge_to_encounter' then 'authorized' else 'pending_payment' end
  where id = p_lab_order_item_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    v_clinic_id, p_staff_id, 'laboratory.item_billing_activated', 'lab_order_item',
    p_lab_order_item_id,
    jsonb_build_object('service_charge_id', v_charge_id, 'billing_mode', p_billing_mode)
  );

  return v_charge_id;
end;
$$;

revoke all on function public.defer_lab_order_item(uuid, uuid, text) from public;
grant execute on function public.defer_lab_order_item(uuid, uuid, text) to authenticated;
revoke all on function public.activate_deferred_lab_order_item(uuid, uuid, text) from public;
grant execute on function public.activate_deferred_lab_order_item(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Synchronize paid lab items. A fully paid service charge becomes lab-ready.
-- Emergency/encounter-authorized items are already lab-ready without payment.
-- ---------------------------------------------------------------------------
create or replace function public.sync_lab_item_payment_status(p_lab_order_item_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge_id uuid;
  v_current text;
  v_amount numeric;
  v_paid numeric;
  v_new_status text;
begin
  select service_charge_id, billing_status into v_charge_id, v_current
  from lab_order_items where id = p_lab_order_item_id for update;

  if v_charge_id is null then
    return v_current;
  end if;

  select coalesce(amount_xaf,0), coalesce(amount_paid_xaf,0)
    into v_amount, v_paid
  from service_charges where id = v_charge_id;

  if v_paid >= v_amount and v_amount >= 0 then
    v_new_status := 'paid';
    update lab_order_items set billing_status = 'paid' where id = p_lab_order_item_id;
  else
    v_new_status := v_current;
  end if;

  return v_new_status;
end;
$$;

grant execute on function public.sync_lab_item_payment_status(uuid) to authenticated;

comment on column lab_orders.billing_mode is
  'Laboratory financial mode: pay_now, charge_to_encounter, or deferred';
comment on column lab_order_items.billing_status is
  'Financial readiness: pending_payment, authorized, paid, deferred, or cancelled';
