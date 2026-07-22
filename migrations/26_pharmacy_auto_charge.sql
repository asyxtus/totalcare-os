-- ============================================================================
-- PHARMACY PATCH: DISPENSING CANNOT HAPPEN WITHOUT A CHARGE
-- This is the actual fraud fix. Previously, dispense_prescription_item
-- moved stock and recorded who dispensed it, but nothing forced a
-- service_charge to exist. A pharmacist could dispense a real drug with
-- zero billing trail. Now: no price available (from the product catalog
-- OR an explicit manual price) means the function REFUSES to dispense at
-- all. The charge isn't a courtesy step anymore — it's a precondition.
-- ============================================================================

-- Traceability: which charge did this dispensing act create?
-- Must run BEFORE the function below, since Postgres validates that
-- referenced columns exist at function-creation time.
alter table dispensing_records add column service_charge_id uuid references service_charges(id);

create or replace function dispense_prescription_item(
  p_prescription_item_id uuid,
  p_quantity int,
  p_dispensed_by uuid,
  p_witness_id uuid default null,
  p_allow_expired_override boolean default false,
  p_override_reason text default null,
  p_override_approved_by uuid default null,
  p_manual_unit_price_xaf numeric default null
)
returns jsonb
language plpgsql
as $$
declare
  v_item record;
  v_clinic_id uuid;
  v_patient_id uuid;
  v_visit_id uuid;
  v_is_controlled boolean;
  v_remaining_on_item int;
  v_allocations jsonb;
  v_prescription_requires_review boolean;
  v_dispensing_record_id uuid;
  v_unit_price numeric(10,2);
  v_charge_amount numeric(10,2);
  v_charge_id uuid;
  v_product_name text;
begin
  select pi.* into v_item
  from prescription_items pi
  where pi.id = p_prescription_item_id
  for update of pi;

  if v_item.id is null then
    raise exception 'Prescription item % not found', p_prescription_item_id;
  end if;

  select p.clinic_id, p.requires_review, p.visit_id into v_clinic_id, v_prescription_requires_review, v_visit_id
  from prescriptions p
  where p.id = v_item.prescription_id;

  select patient_id into v_patient_id from visits where id = v_visit_id;

  if v_prescription_requires_review then
    raise exception 'This prescription contains a controlled substance and has not yet been reviewed by an admin — nothing on it can be dispensed until approve_prescription_review() has run';
  end if;

  v_remaining_on_item := v_item.quantity_prescribed - v_item.quantity_dispensed;
  if p_quantity > v_remaining_on_item then
    raise exception 'Cannot dispense % — only % remaining on this prescription item', p_quantity, v_remaining_on_item;
  end if;

  -- THE FRAUD FIX: determine a real price BEFORE touching any stock.
  -- If there's no way to bill this dispensing, refuse it outright.
  if v_item.product_id is not null then
    select dc.is_controlled, pr.sale_price_xaf, pr.name
      into v_is_controlled, v_unit_price, v_product_name
    from products pr
    left join drug_classes dc on dc.id = pr.drug_class_id
    where pr.id = v_item.product_id;
  end if;

  if v_unit_price is null then
    -- No catalog product, or a product with no price set — fall back to
    -- an explicit manual price. If that's ALSO not provided, refuse.
    if p_manual_unit_price_xaf is null then
      raise exception 'Cannot dispense: no catalog price available for this item and no manual price was provided. A price is required before dispensing can proceed.';
    end if;
    v_unit_price := p_manual_unit_price_xaf;
    v_product_name := coalesce(v_item.drug_name_freetext, 'Article non catalogué');
  end if;

  v_charge_amount := v_unit_price * p_quantity;

  if v_is_controlled then
    if p_witness_id is null then
      raise exception 'A witness is required to dispense a controlled substance';
    end if;
    if p_witness_id = p_dispensed_by then
      raise exception 'The witness must be a different person from whoever is dispensing';
    end if;
    if not exists (
      select 1 from staff where id = p_witness_id and clinic_id = v_clinic_id and is_active = true
    ) then
      raise exception 'Witness not found or inactive in this clinic';
    end if;
  end if;

  insert into dispensing_records (
    clinic_id, prescription_item_id, quantity_dispensed, dispensed_by, witness_id
  ) values (
    v_clinic_id, p_prescription_item_id, p_quantity, p_dispensed_by, p_witness_id
  )
  returning id into v_dispensing_record_id;

  if v_item.product_id is null then
    v_allocations := jsonb_build_object('note', 'no catalog product linked — stock not tracked, manual price billed');
  else
    v_allocations := dispense_fefo(
      v_clinic_id, v_item.product_id, p_quantity,
      'prescription_item', p_prescription_item_id, p_dispensed_by,
      p_allow_expired_override, p_override_reason, p_override_approved_by,
      v_dispensing_record_id
    );
  end if;

  update dispensing_records set batch_allocations = v_allocations where id = v_dispensing_record_id;

  -- THE ACTUAL FIX: the charge is created HERE, in the same transaction
  -- as the dispensing, using the same function every other charge goes
  -- through. If this insert fails, the whole dispense rolls back —
  -- stock movements included. Dispensing and billing succeed together
  -- or not at all.
  v_charge_id := create_service_charge(
    v_clinic_id, v_patient_id, v_visit_id, null, 'pharmacy',
    v_product_name || ' x' || p_quantity, v_charge_amount, p_dispensed_by
  );

  update dispensing_records set service_charge_id = v_charge_id where id = v_dispensing_record_id;

  update prescription_items
    set quantity_dispensed = quantity_dispensed + p_quantity
    where id = p_prescription_item_id;

  update prescriptions set status = (
    select case
      when bool_and(quantity_dispensed = 0) then 'pending'
      when bool_and(quantity_dispensed >= quantity_prescribed) then 'dispensed'
      else 'partially_dispensed'
    end::prescription_status
    from prescription_items where prescription_id = v_item.prescription_id
  )
  where id = v_item.prescription_id;

  return v_allocations || jsonb_build_object('service_charge_id', v_charge_id, 'charge_amount', v_charge_amount);
end;
$$;
