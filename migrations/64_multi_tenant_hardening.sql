-- ============================================================================
-- MULTI-TENANT HARDENING: EXPLICIT CROSS-TENANT VALIDATION
-- Today's procurement functions trusted product_id/supplier_id/batch_id
-- parameters without re-verifying they actually belong to the calling
-- clinic. In normal use this can't be exploited — the UI only ever
-- offers IDs already scoped to the caller's own clinic — but a function
-- that doesn't defend itself against a wrong ID, relying purely on "the
-- frontend will never send that," is a real weakness in a multi-tenant
-- system. Adding explicit checks now.
-- ============================================================================

create or replace function record_goods_receipt(
  p_clinic_id uuid,
  p_supplier_id uuid,
  p_received_by uuid,
  p_invoice_reference text,
  p_notes text,
  p_items jsonb,
  p_purchase_order_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_receipt_id uuid;
  v_item jsonb;
  v_batch_id uuid;
  v_product_id uuid;
  v_batch_number text;
  v_expiry_date date;
  v_quantity int;
  v_unit_cost numeric(10,2);
  v_po_fully_received boolean;
begin
  if p_supplier_id is not null and not exists (
    select 1 from suppliers where id = p_supplier_id and clinic_id = p_clinic_id
  ) then
    raise exception 'Supplier does not belong to this clinic';
  end if;

  if p_purchase_order_id is not null and not exists (
    select 1 from purchase_orders where id = p_purchase_order_id and clinic_id = p_clinic_id
  ) then
    raise exception 'Purchase order does not belong to this clinic';
  end if;

  insert into goods_receipts (clinic_id, supplier_id, received_by, invoice_reference, notes, purchase_order_id)
  values (p_clinic_id, p_supplier_id, p_received_by, p_invoice_reference, p_notes, p_purchase_order_id)
  returning id into v_receipt_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;

    if not exists (select 1 from products where id = v_product_id and clinic_id = p_clinic_id) then
      raise exception 'Product % does not belong to this clinic', v_product_id;
    end if;

    v_batch_number := v_item->>'batch_number';
    v_expiry_date := (v_item->>'expiry_date')::date;
    v_quantity := (v_item->>'quantity')::int;
    v_unit_cost := (v_item->>'unit_cost_xaf')::numeric;

    select id into v_batch_id from batches
      where clinic_id = p_clinic_id and product_id = v_product_id and batch_number = v_batch_number;

    if v_batch_id is null then
      insert into batches (
        clinic_id, product_id, batch_number, expiry_date, quantity_received, unit_cost_xaf, received_by
      ) values (
        p_clinic_id, v_product_id, v_batch_number, v_expiry_date, v_quantity, v_unit_cost, p_received_by
      )
      returning id into v_batch_id;
    end if;

    perform record_stock_movement(
      v_batch_id, 'receipt', v_quantity, 'goods_receipt', v_receipt_id,
      null, p_received_by
    );

    insert into goods_receipt_items (goods_receipt_id, product_id, batch_id, quantity, unit_cost_xaf)
    values (v_receipt_id, v_product_id, v_batch_id, v_quantity, v_unit_cost);

    if p_purchase_order_id is not null then
      update purchase_order_items
        set quantity_received = quantity_received + v_quantity
        where purchase_order_id = p_purchase_order_id and product_id = v_product_id;
    end if;
  end loop;

  if p_purchase_order_id is not null then
    select bool_and(quantity_received >= quantity_ordered) into v_po_fully_received
    from purchase_order_items where purchase_order_id = p_purchase_order_id;

    update purchase_orders set status = case
      when v_po_fully_received then 'received'
      else 'partially_received'
    end::po_status
    where id = p_purchase_order_id and status in ('sent', 'partially_received');
  end if;

  return v_receipt_id;
end;
$$;

create or replace function create_purchase_order(
  p_clinic_id uuid,
  p_supplier_id uuid,
  p_created_by uuid,
  p_expected_delivery_date date,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_po_id uuid;
  v_item jsonb;
  v_product_id uuid;
begin
  if not exists (select 1 from suppliers where id = p_supplier_id and clinic_id = p_clinic_id) then
    raise exception 'Supplier does not belong to this clinic';
  end if;

  insert into purchase_orders (clinic_id, supplier_id, created_by, expected_delivery_date, notes)
  values (p_clinic_id, p_supplier_id, p_created_by, p_expected_delivery_date, p_notes)
  returning id into v_po_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;

    if not exists (select 1 from products where id = v_product_id and clinic_id = p_clinic_id) then
      raise exception 'Product % does not belong to this clinic', v_product_id;
    end if;

    insert into purchase_order_items (purchase_order_id, product_id, quantity_ordered, unit_cost_xaf)
    values (v_po_id, v_product_id, (v_item->>'quantity')::int, (v_item->>'unit_cost_xaf')::numeric);
  end loop;

  return v_po_id;
end;
$$;

create or replace function record_supplier_invoice(
  p_clinic_id uuid,
  p_supplier_id uuid,
  p_purchase_order_id uuid,
  p_invoice_number text,
  p_invoice_date date,
  p_total_amount_xaf numeric,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_invoice_id uuid;
  v_terms_days int;
  v_due_date date;
begin
  if not exists (select 1 from suppliers where id = p_supplier_id and clinic_id = p_clinic_id) then
    raise exception 'Supplier does not belong to this clinic';
  end if;
  if p_purchase_order_id is not null and not exists (
    select 1 from purchase_orders where id = p_purchase_order_id and clinic_id = p_clinic_id
  ) then
    raise exception 'Purchase order does not belong to this clinic';
  end if;

  select payment_terms_days into v_terms_days from suppliers where id = p_supplier_id;
  v_due_date := coalesce(p_invoice_date, current_date) + coalesce(v_terms_days, 0);

  insert into supplier_invoices (
    clinic_id, supplier_id, purchase_order_id, invoice_number, invoice_date, due_date, total_amount_xaf, created_by
  ) values (
    p_clinic_id, p_supplier_id, p_purchase_order_id, p_invoice_number,
    coalesce(p_invoice_date, current_date), v_due_date, p_total_amount_xaf, p_created_by
  )
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;

create or replace function record_supplier_return(
  p_clinic_id uuid,
  p_supplier_id uuid,
  p_batch_id uuid,
  p_quantity int,
  p_reason text,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_return_id uuid;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to return stock to a supplier';
  end if;
  if not exists (select 1 from suppliers where id = p_supplier_id and clinic_id = p_clinic_id) then
    raise exception 'Supplier does not belong to this clinic';
  end if;
  if not exists (select 1 from batches where id = p_batch_id and clinic_id = p_clinic_id) then
    raise exception 'Batch does not belong to this clinic';
  end if;

  perform record_stock_movement(
    p_batch_id, 'return_to_supplier', p_quantity, 'supplier_return', null,
    p_reason, p_created_by
  );

  insert into supplier_returns (clinic_id, supplier_id, batch_id, quantity, reason, created_by)
  values (p_clinic_id, p_supplier_id, p_batch_id, p_quantity, p_reason, p_created_by)
  returning id into v_return_id;

  update stock_movements set reference_id = v_return_id
  where id = (
    select id from stock_movements
    where batch_id = p_batch_id and reference_type = 'supplier_return' and reference_id is null
    order by created_at desc
    limit 1
  );

  return v_return_id;
end;
$$;

create or replace function record_stock_adjustment(
  p_clinic_id uuid,
  p_batch_id uuid,
  p_quantity int,
  p_direction text,
  p_reason text,
  p_staff_id uuid
)
returns void
language plpgsql
as $$
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to adjust stock';
  end if;
  if p_direction not in ('increase', 'decrease') then
    raise exception 'Direction must be increase or decrease';
  end if;
  if not exists (select 1 from batches where id = p_batch_id and clinic_id = p_clinic_id) then
    raise exception 'Batch does not belong to this clinic';
  end if;

  perform record_stock_movement(
    p_batch_id,
    case when p_direction = 'increase' then 'adjustment_increase' else 'adjustment' end,
    p_quantity, 'manual_adjustment', null, p_reason, p_staff_id
  );

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_staff_id, 'pharmacy.stock_adjusted', 'batch', p_batch_id,
    jsonb_build_object('direction', p_direction, 'quantity', p_quantity, 'reason', p_reason));
end;
$$;

create or replace function initiate_batch_recall(
  p_clinic_id uuid,
  p_batch_id uuid,
  p_initiated_by uuid,
  p_reason text
)
returns uuid
language plpgsql
as $$
declare
  v_recall_id uuid;
  v_initiator_role staff_role;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to initiate a batch recall';
  end if;

  select role into v_initiator_role from staff
    where id = p_initiated_by and clinic_id = p_clinic_id and is_active = true;
  if v_initiator_role not in ('admin', 'pharmacist') then
    raise exception 'Only an admin or pharmacist can initiate a batch recall, got %', v_initiator_role;
  end if;

  if not exists (select 1 from batches where id = p_batch_id and clinic_id = p_clinic_id) then
    raise exception 'Batch does not belong to this clinic';
  end if;

  update batches set status = 'recalled' where id = p_batch_id and clinic_id = p_clinic_id;

  insert into batch_recalls (clinic_id, batch_id, initiated_by, reason)
  values (p_clinic_id, p_batch_id, p_initiated_by, p_reason)
  returning id into v_recall_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_initiated_by, 'pharmacy.batch_recalled', 'batch', p_batch_id,
    jsonb_build_object('reason', p_reason, 'recall_id', v_recall_id));

  return v_recall_id;
end;
$$;
