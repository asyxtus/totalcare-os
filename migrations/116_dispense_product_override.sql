-- ============================================================================
-- ADD PRODUCT OVERRIDE TO dispense_prescription_item
--
-- A doctor prescribes "Amoxicillin 500mg" but the pharmacy only has
-- "Amoxicillin 250mg" in stock. The pharmacist needs to be able to dispense
-- the available product and note the substitution, rather than being blocked.
--
-- This adds an optional p_product_id_override parameter. When supplied, the
-- function uses that product's batches instead of the prescribed product's.
-- The original prescription item keeps its product_id for record integrity;
-- the dispensing_record records what was actually dispensed.
-- ============================================================================

-- First get the latest version of the function body
create or replace function dispense_prescription_item(
  p_prescription_item_id  uuid,
  p_quantity              int,
  p_dispensed_by          uuid,
  p_witness_id            uuid    default null,
  p_allow_expired_override boolean default false,
  p_override_reason       text    default null,
  p_override_approved_by  uuid    default null,
  p_manual_unit_price_xaf numeric default null,
  p_product_id_override   uuid    default null   -- NEW: pharmacist selects different dosage
)
returns jsonb
language plpgsql
as $$
declare
  v_item                       record;
  v_clinic_id                  uuid;
  v_patient_id                 uuid;
  v_visit_id                   uuid;
  v_is_controlled              boolean;
  v_remaining_on_item          int;
  v_allocations                jsonb;
  v_prescription_requires_review boolean;
  v_dispensing_record_id       uuid;
  v_unit_price                 numeric(10,2);
  v_charge_amount              numeric(10,2);
  v_charge_id                  uuid;
  v_product_name               text;
  v_effective_product_id       uuid;
begin
  select pi.* into v_item
  from prescription_items pi
  where pi.id = p_prescription_item_id
  for update of pi;

  if v_item.id is null then
    raise exception 'Prescription item % not found', p_prescription_item_id;
  end if;

  select p.clinic_id, p.requires_review, p.visit_id
    into v_clinic_id, v_prescription_requires_review, v_visit_id
  from prescriptions p
  where p.id = v_item.prescription_id;

  select patient_id into v_patient_id from visits where id = v_visit_id;

  if v_prescription_requires_review then
    raise exception 'This prescription has not yet been reviewed by an admin — nothing can be dispensed until approve_prescription_review() has run';
  end if;

  v_remaining_on_item := v_item.quantity_prescribed - v_item.quantity_dispensed;
  if v_remaining_on_item <= 0 then
    raise exception 'This item has already been fully dispensed';
  end if;
  if p_quantity > v_remaining_on_item then
    raise exception 'Cannot dispense % units — only % remaining', p_quantity, v_remaining_on_item;
  end if;

  -- Use override product if supplied, otherwise use the prescribed product
  v_effective_product_id := coalesce(p_product_id_override, v_item.product_id);

  if v_effective_product_id is null and p_manual_unit_price_xaf is null then
    raise exception 'Cannot dispense a freetext item without a manual price';
  end if;

  -- Allocate batches using FEFO (first-expiry first-out)
  if v_effective_product_id is not null then
    select jsonb_agg(
      jsonb_build_object('batch_id', b.id, 'qty', least(batch_quantity_on_hand(b.id), p_quantity))
      order by b.expiry_date asc nulls last
    )
    into v_allocations
    from batches b
    where b.product_id = v_effective_product_id
      and b.status = 'active'
      and (p_allow_expired_override or b.expiry_date is null or b.expiry_date >= current_date)
      and batch_quantity_on_hand(b.id) > 0;

    if v_allocations is null or jsonb_array_length(v_allocations) = 0 then
      raise exception 'No stock available for this product';
    end if;
  end if;

  -- Get product name and price
  if v_effective_product_id is not null then
    select name, sale_price_xaf into v_product_name, v_unit_price
    from products where id = v_effective_product_id;
  else
    v_product_name := v_item.drug_name_freetext;
    v_unit_price := p_manual_unit_price_xaf;
  end if;

  if p_manual_unit_price_xaf is not null then
    v_unit_price := p_manual_unit_price_xaf;
  end if;

  v_charge_amount := v_unit_price * p_quantity;

  -- Create dispensing record
  insert into dispensing_records (
    clinic_id, prescription_id, prescription_item_id,
    product_id, dispensed_by, witness_id,
    quantity_dispensed, unit_price_xaf, total_price_xaf,
    dispensed_at
  ) values (
    v_clinic_id, v_item.prescription_id, p_prescription_item_id,
    v_effective_product_id, p_dispensed_by, p_witness_id,
    p_quantity, v_unit_price, v_charge_amount,
    now()
  ) returning id into v_dispensing_record_id;

  -- Move stock from batches
  if v_effective_product_id is not null then
    for i in 0..jsonb_array_length(v_allocations)-1 loop
      declare
        v_batch_id uuid := (v_allocations->i->>'batch_id')::uuid;
        v_batch_qty int  := (v_allocations->i->>'qty')::int;
      begin
        if v_batch_qty <= 0 then continue; end if;
        perform record_stock_movement(
          v_batch_id, 'dispense', v_batch_qty,
          'dispensing', v_dispensing_record_id,
          null, p_dispensed_by, v_dispensing_record_id
        );
      end;
    end loop;
  end if;

  -- Auto-charge via create_service_charge
  -- Pass null for service_price_id (pharmacy charges don't use the service_prices table)
  v_charge_id := create_service_charge(
    v_clinic_id, v_patient_id, v_visit_id,
    null, 'pharmacy',
    v_product_name || ' x' || p_quantity,
    v_charge_amount, p_dispensed_by
  );

  -- Stamp the actual product on the charge for profit margin tracking
  if v_effective_product_id is not null then
    update service_charges set product_id = v_effective_product_id where id = v_charge_id;
  end if;

  update dispensing_records set service_charge_id = v_charge_id where id = v_dispensing_record_id;

  -- Update quantity_dispensed on the item
  update prescription_items
  set quantity_dispensed = quantity_dispensed + p_quantity
  where id = p_prescription_item_id;

  -- Update prescription status: pending → partially_dispensed → dispensed
  update prescriptions set status = (
    select case
      when bool_and(quantity_dispensed = 0) then 'pending'
      when bool_and(quantity_dispensed >= quantity_prescribed) then 'dispensed'
      else 'partially_dispensed'
    end::prescription_status
    from prescription_items where prescription_id = v_item.prescription_id
  )
  where id = v_item.prescription_id;

  return jsonb_build_object('service_charge_id', v_charge_id);
end;
$$;
