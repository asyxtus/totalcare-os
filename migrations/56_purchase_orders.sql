-- ============================================================================
-- PURCHASE ORDERS + GOODS RECEIPT MATCHING
-- A PO is a planning document — "here's what we've ordered." When a
-- matching goods receipt comes in, the PO's received quantities update
-- automatically and its status transitions (draft → sent →
-- partially_received → received) without a separate manual step.
-- ============================================================================

create type po_status as enum ('draft', 'sent', 'partially_received', 'received', 'cancelled');

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  created_by uuid references staff(id),
  status po_status not null default 'draft',
  order_date timestamptz not null default now(),
  expected_delivery_date date,
  notes text
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity_ordered int not null check (quantity_ordered > 0),
  unit_cost_xaf numeric(10,2),
  quantity_received int not null default 0
);

-- Link goods_receipts to the PO they fulfill, when applicable — a
-- receipt can also stand alone with no PO (common for smaller pharmacies
-- that don't formally order everything in advance).
alter table goods_receipts add column purchase_order_id uuid references purchase_orders(id);

create or replace function create_purchase_order(
  p_clinic_id uuid,
  p_supplier_id uuid,
  p_created_by uuid,
  p_expected_delivery_date date,
  p_notes text,
  p_items jsonb  -- [{"product_id":"...","quantity":N,"unit_cost_xaf":N}]
)
returns uuid
language plpgsql
as $$
declare
  v_po_id uuid;
  v_item jsonb;
begin
  insert into purchase_orders (clinic_id, supplier_id, created_by, expected_delivery_date, notes)
  values (p_clinic_id, p_supplier_id, p_created_by, p_expected_delivery_date, p_notes)
  returning id into v_po_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into purchase_order_items (purchase_order_id, product_id, quantity_ordered, unit_cost_xaf)
    values (
      v_po_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_cost_xaf')::numeric
    );
  end loop;

  return v_po_id;
end;
$$;

create or replace function mark_po_sent(p_po_id uuid, p_staff_id uuid)
returns void
language plpgsql
as $$
begin
  update purchase_orders set status = 'sent' where id = p_po_id and status = 'draft';
  if not found then
    raise exception 'Purchase order not found or not in draft status';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- record_goods_receipt() extended with an optional purchase_order_id.
-- When provided, matches received items to the PO's items by product_id,
-- updates quantity_received, and recomputes the PO's overall status.
-- ----------------------------------------------------------------------------
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
  insert into goods_receipts (clinic_id, supplier_id, received_by, invoice_reference, notes, purchase_order_id)
  values (p_clinic_id, p_supplier_id, p_received_by, p_invoice_reference, p_notes, p_purchase_order_id)
  returning id into v_receipt_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
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

    -- PO matching: apply received quantity to the corresponding PO item.
    if p_purchase_order_id is not null then
      update purchase_order_items
        set quantity_received = quantity_received + v_quantity
        where purchase_order_id = p_purchase_order_id and product_id = v_product_id;
    end if;
  end loop;

  -- Recompute PO status once, after all items processed.
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

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;

create policy purchase_orders_select on purchase_orders for select
  using (clinic_id = current_staff_clinic_id());
create policy purchase_orders_write on purchase_orders for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'pharmacist')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'pharmacist')
);

create policy purchase_order_items_select on purchase_order_items for select
  using (exists (
    select 1 from purchase_orders po where po.id = purchase_order_items.purchase_order_id
      and po.clinic_id = current_staff_clinic_id()
  ));
create policy purchase_order_items_write on purchase_order_items for all using (
  exists (
    select 1 from purchase_orders po where po.id = purchase_order_items.purchase_order_id
      and po.clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'pharmacist')
  )
);
