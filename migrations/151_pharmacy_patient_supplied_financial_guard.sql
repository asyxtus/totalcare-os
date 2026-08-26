-- ============================================================================
-- MIGRATION 151: PHARMACY PATIENT-SUPPLIED + FINANCIAL GUARDS
--
-- Business rules:
--   1. Patient-supplied medication is recorded clinically but is never billed
--      and never removes stock.
--   2. A catalogued product always uses its catalog sale price. A submitted
--      manual price cannot override it.
--   3. Manual pricing is permitted only for a genuine free-text prescription
--      item with no catalog product.
--   4. Patient-supplied medication may still reference a catalog product for
--      clinical/MAR identification, but its price is always zero.
--   5. Billing is created only when the clinic actually supplies the item.
--
-- This migration intentionally replaces all known dispensing function
-- signatures so an older overloaded function cannot bypass these rules.
-- ============================================================================

alter table public.dispensing_records
  add column if not exists patient_supplied boolean not null default false,
  add column if not exists patient_supplied_at timestamptz,
  add column if not exists patient_supplied_by uuid references public.staff(id),
  add column if not exists patient_supplied_notes text;

-- Drop known legacy overloads. The current application calls the 10-argument
-- version including p_patient_supplied.
drop function if exists public.dispense_prescription_item(uuid, int, uuid, uuid, boolean, text, uuid, numeric, uuid, boolean);
drop function if exists public.dispense_prescription_item(uuid, int, uuid, uuid, boolean, text, uuid, numeric, uuid);
drop function if exists public.dispense_prescription_item(uuid, int, uuid, uuid, boolean, text, uuid, numeric);

create function public.dispense_prescription_item(
  p_prescription_item_id uuid,
  p_quantity int,
  p_dispensed_by uuid,
  p_witness_id uuid default null,
  p_allow_expired_override boolean default false,
  p_override_reason text default null,
  p_override_approved_by uuid default null,
  p_manual_unit_price_xaf numeric default null,
  p_product_id_override uuid default null,
  p_patient_supplied boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_product record;
  v_clinic_id uuid;
  v_patient_id uuid;
  v_visit_id uuid;
  v_remaining int;
  v_effective_product_id uuid;
  v_allocations jsonb;
  v_dispensing_record_id uuid;
  v_unit_price numeric(10,2) := 0;
  v_charge_amount numeric(10,2) := 0;
  v_charge_id uuid;
  v_product_name text;
  v_requires_review boolean;
begin
  select pi.* into v_item
  from public.prescription_items pi
  where pi.id = p_prescription_item_id
  for update;

  if not found then
    raise exception 'Prescription item % not found', p_prescription_item_id;
  end if;

  select p.clinic_id, p.requires_review, p.visit_id
    into v_clinic_id, v_requires_review, v_visit_id
  from public.prescriptions p
  where p.id = v_item.prescription_id;

  if not found then
    raise exception 'Prescription not found';
  end if;

  select v.patient_id into v_patient_id
  from public.visits v
  where v.id = v_visit_id;

  if v_patient_id is null then
    raise exception 'Patient visit could not be resolved';
  end if;

  if v_requires_review then
    raise exception 'This prescription has not yet been reviewed by an admin';
  end if;

  v_remaining := v_item.quantity_prescribed - v_item.quantity_dispensed;
  if v_remaining <= 0 then
    raise exception 'This item has already been fully dispensed';
  end if;
  if p_quantity <= 0 or p_quantity > v_remaining then
    raise exception 'Cannot dispense % units — % remaining', p_quantity, v_remaining;
  end if;

  v_effective_product_id := coalesce(p_product_id_override, v_item.product_id);

  -- ========================================================================
  -- PATIENT-SUPPLIED PATH
  -- ========================================================================
  -- This path deliberately ignores any price supplied by the browser and
  -- never allocates stock or creates a service charge.
  if p_patient_supplied then
    if p_is_distinct_from(p_witness_id, null) then
      null;
    end if;

    if v_effective_product_id is not null then
      select id, name, sale_price_xaf into v_product
      from public.products
      where id = v_effective_product_id
        and clinic_id = v_clinic_id;

      if not found then
        raise exception 'Selected pharmacy product was not found in this clinic';
      end if;
      v_product_name := v_product.name;
    else
      v_product_name := coalesce(v_item.drug_name_freetext, 'Medication');
    end if;

    insert into public.dispensing_records (
      clinic_id, prescription_id, prescription_item_id,
      product_id, dispensed_by, witness_id,
      quantity_dispensed, unit_price_xaf, total_price_xaf,
      dispensed_at, patient_supplied, patient_supplied_at,
      patient_supplied_by
    ) values (
      v_clinic_id, v_item.prescription_id, p_prescription_item_id,
      v_effective_product_id, p_dispensed_by, p_witness_id,
      p_quantity, 0, 0,
      now(), true, now(), p_dispensed_by
    ) returning id into v_dispensing_record_id;

    update public.prescription_items
    set quantity_dispensed = quantity_dispensed + p_quantity
    where id = p_prescription_item_id;

    update public.prescriptions
    set status = (
      select case
        when bool_and(quantity_dispensed = 0) then 'pending'
        when bool_and(quantity_dispensed >= quantity_prescribed) then 'dispensed'
        else 'partially_dispensed'
      end::prescription_status
      from public.prescription_items
      where prescription_id = v_item.prescription_id
    )
    where id = v_item.prescription_id;

    return jsonb_build_object(
      'dispensing_record_id', v_dispensing_record_id,
      'service_charge_id', null,
      'patient_supplied', true,
      'amount_xaf', 0
    );
  end if;

  -- ========================================================================
  -- CLINIC-SUPPLIED PATH
  -- ========================================================================
  if v_effective_product_id is not null then
    select id, name, sale_price_xaf into v_product
    from public.products
    where id = v_effective_product_id
      and clinic_id = v_clinic_id
      and is_active = true;

    if not found then
      raise exception 'Selected pharmacy product was not found or is inactive';
    end if;

    v_product_name := v_product.name;
    -- Catalog price is authoritative. Browser-supplied manual price is
    -- intentionally ignored for catalogued products.
    v_unit_price := v_product.sale_price_xaf;

    select jsonb_agg(
      jsonb_build_object(
        'batch_id', b.id,
        'qty', least(batch_quantity_on_hand(b.id), p_quantity)
      ) order by b.expiry_date asc nulls last
    ) into v_allocations
    from public.batches b
    where b.product_id = v_effective_product_id
      and b.status = 'active'
      and (p_allow_expired_override or b.expiry_date is null or b.expiry_date >= current_date)
      and batch_quantity_on_hand(b.id) > 0;

    if v_allocations is null or jsonb_array_length(v_allocations) = 0 then
      raise exception 'No stock available for this product. If the patient supplied it, select “Patient-supplied”.';
    end if;

    if (
      select coalesce(sum((x->>'qty')::int), 0)
      from jsonb_array_elements(v_allocations) x
    ) < p_quantity then
      raise exception 'Insufficient stock for this product. If the patient supplied it, select “Patient-supplied”.';
    end if;
  else
    -- Manual pricing is only legitimate for a true free-text item.
    if p_manual_unit_price_xaf is null or p_manual_unit_price_xaf <= 0 then
      raise exception 'A manual price is required only when the prescribed medication is not linked to a pharmacy product';
    end if;

    v_product_name := coalesce(v_item.drug_name_freetext, 'Medication');
    v_unit_price := p_manual_unit_price_xaf;
  end if;

  v_charge_amount := v_unit_price * p_quantity;

  insert into public.dispensing_records (
    clinic_id, prescription_id, prescription_item_id,
    product_id, dispensed_by, witness_id,
    quantity_dispensed, unit_price_xaf, total_price_xaf,
    dispensed_at, patient_supplied
  ) values (
    v_clinic_id, v_item.prescription_id, p_prescription_item_id,
    v_effective_product_id, p_dispensed_by, p_witness_id,
    p_quantity, v_unit_price, v_charge_amount,
    now(), false
  ) returning id into v_dispensing_record_id;

  -- Move stock only for medication actually supplied by the clinic.
  for i in 0..jsonb_array_length(v_allocations)-1 loop
    declare
      v_batch_id uuid := (v_allocations->i->>'batch_id')::uuid;
      v_batch_qty int := (v_allocations->i->>'qty')::int;
    begin
      if v_batch_qty <= 0 then continue; end if;
      perform public.record_stock_movement(
        v_batch_id, 'dispense', v_batch_qty,
        'dispensing', v_dispensing_record_id,
        null, p_dispensed_by, v_dispensing_record_id
      );
    end;
  end loop;

  v_charge_id := public.create_service_charge(
    v_clinic_id, v_patient_id, v_visit_id,
    null, 'pharmacy',
    v_product_name || ' x' || p_quantity,
    v_charge_amount, p_dispensed_by
  );

  if v_effective_product_id is not null then
    update public.service_charges
    set product_id = v_effective_product_id
    where id = v_charge_id;
  end if;

  update public.dispensing_records
  set service_charge_id = v_charge_id
  where id = v_dispensing_record_id;

  update public.prescription_items
  set quantity_dispensed = quantity_dispensed + p_quantity
  where id = p_prescription_item_id;

  update public.prescriptions
  set status = (
    select case
      when bool_and(quantity_dispensed = 0) then 'pending'
      when bool_and(quantity_dispensed >= quantity_prescribed) then 'dispensed'
      else 'partially_dispensed'
    end::prescription_status
    from public.prescription_items
    where prescription_id = v_item.prescription_id
  )
  where id = v_item.prescription_id;

  return jsonb_build_object(
    'dispensing_record_id', v_dispensing_record_id,
    'service_charge_id', v_charge_id,
    'patient_supplied', false,
    'amount_xaf', v_charge_amount
  );
end;
$$;
