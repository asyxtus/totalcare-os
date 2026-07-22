-- ============================================================================
-- MULTI-TENANT HARDENING, PART 2: CORE CLINICAL FUNCTIONS
-- Full audit of every function across this session found two more real
-- gaps, both more significant than the pharmacy ones already fixed —
-- these sit in core clinical workflow (check-in, lab ordering), not
-- just procurement.
-- ============================================================================

create or replace function register_visit_with_charge(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_visit_reason text,
  p_service_price_id uuid,
  p_registered_by uuid,
  p_assigned_doctor_id uuid default null
)
returns table (visit_id uuid, service_charge_id uuid, amount_xaf numeric)
language plpgsql
as $$
declare
  v_visit_id uuid;
  v_charge_id uuid;
  v_amount numeric(10,2);
  v_service_name text;
begin
  -- THE FIX: verify the patient actually belongs to this clinic before
  -- creating a visit for them. Everything else in this function already
  -- checked its own foreign references (service price, assigned
  -- doctor) — the patient itself was the one gap.
  if not exists (select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id) then
    raise exception 'Patient does not belong to this clinic';
  end if;

  select price_xaf, service_name into v_amount, v_service_name
  from service_prices where id = p_service_price_id and clinic_id = p_clinic_id;

  if v_amount is null then
    raise exception 'Service price % not found for this clinic', p_service_price_id;
  end if;

  if p_assigned_doctor_id is not null and not exists (
    select 1 from staff where id = p_assigned_doctor_id and clinic_id = p_clinic_id
      and role = 'doctor' and is_active = true
  ) then
    raise exception 'Selected doctor not found or inactive in this clinic';
  end if;

  begin
    insert into visits (clinic_id, patient_id, visit_reason, status, registered_by, assigned_doctor_id)
    values (p_clinic_id, p_patient_id, p_visit_reason, 'registered', p_registered_by, p_assigned_doctor_id)
    returning id into v_visit_id;
  exception
    when unique_violation then
      raise exception 'This patient already has an active visit in progress — check the queue rather than starting a new one';
  end;

  v_charge_id := create_service_charge(
    p_clinic_id, p_patient_id, v_visit_id, p_service_price_id,
    'consultation', v_service_name, v_amount, p_registered_by
  );

  return query select v_visit_id, v_charge_id, v_amount;
end;
$$;

create or replace function create_lab_order(
  p_clinic_id uuid,
  p_visit_id uuid,
  p_ordered_by uuid,
  p_items jsonb
)
returns table (lab_order_id uuid, service_charge_ids uuid[])
language plpgsql
as $$
declare
  v_patient_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_item_type text;
  v_charge_ids uuid[] := ARRAY[]::uuid[];
  v_charge_id uuid;
  v_price numeric(10,2);
  v_name text;
begin
  -- THE FIX: the visit lookup now also checks clinic_id, so a mismatched
  -- p_clinic_id / p_visit_id pair fails cleanly here instead of silently
  -- creating a lab order tagged with the wrong clinic.
  select patient_id into v_patient_id from visits where id = p_visit_id and clinic_id = p_clinic_id;
  if v_patient_id is null then
    raise exception 'Visit % not found for this clinic', p_visit_id;
  end if;

  insert into lab_orders (clinic_id, visit_id, ordered_by)
  values (p_clinic_id, p_visit_id, p_ordered_by)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_type := v_item->>'type';

    if v_item_type = 'panel' then
      select clp.price_xaf, lp.name_fr into v_price, v_name
      from clinic_lab_panels clp
      join lab_panels lp on lp.id = clp.lab_panel_id
      where clp.clinic_id = p_clinic_id and clp.lab_panel_id = (v_item->>'panel_id')::uuid and clp.is_active;

      if v_price is null then
        raise exception 'Panel % is not available for this clinic', v_item->>'panel_id';
      end if;

      v_charge_id := create_service_charge(
        p_clinic_id, v_patient_id, p_visit_id, null, 'lab', v_name, v_price, p_ordered_by
      );
      v_charge_ids := array_append(v_charge_ids, v_charge_id);

      insert into lab_order_items (lab_order_id, clinic_id, item_type, lab_panel_id, service_charge_id)
      values (v_order_id, p_clinic_id, 'panel', (v_item->>'panel_id')::uuid, v_charge_id);

    elsif v_item_type = 'individual_test' then
      select clt.price_xaf, cat.name_fr into v_price, v_name
      from clinic_lab_tests clt
      join lab_test_catalog cat on cat.id = clt.lab_test_catalog_id
      where clt.clinic_id = p_clinic_id and clt.lab_test_catalog_id = (v_item->>'catalog_id')::uuid and clt.is_active;

      if v_price is null then
        raise exception 'Test % is not available for this clinic', v_item->>'catalog_id';
      end if;

      v_charge_id := create_service_charge(
        p_clinic_id, v_patient_id, p_visit_id, null, 'lab', v_name, v_price, p_ordered_by
      );
      v_charge_ids := array_append(v_charge_ids, v_charge_id);

      insert into lab_order_items (lab_order_id, clinic_id, item_type, lab_test_catalog_id, service_charge_id)
      values (v_order_id, p_clinic_id, 'individual_test', (v_item->>'catalog_id')::uuid, v_charge_id);

    elsif v_item_type = 'external' then
      insert into lab_order_items (lab_order_id, clinic_id, item_type, external_test_name)
      values (v_order_id, p_clinic_id, 'external', v_item->>'name');

    else
      raise exception 'Unknown lab order item type: %', v_item_type;
    end if;
  end loop;

  return query select v_order_id, v_charge_ids;
end;
$$;
