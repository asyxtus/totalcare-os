-- ============================================================================
-- PHARMACY: SUPPLIERS + GOODS RECEIPT
-- The most fundamental gap in the pharmacy module: there was never a
-- real way to receive stock. Every batch tested so far was inserted
-- directly via SQL — meaning the initial 'receipt' stock_movement that
-- makes batch_quantity_on_hand() correct was never actually recorded
-- through the real system for any of it. This fixes that at the root.
-- ============================================================================

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  payment_terms_days int default 0,  -- 0 = cash on delivery, common for smaller suppliers
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table goods_receipts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  supplier_id uuid references suppliers(id),
  received_by uuid references staff(id),
  received_at timestamptz not null default now(),
  invoice_reference text,   -- supplier's own delivery note / invoice number
  notes text
);

create table goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references goods_receipts(id) on delete cascade,
  product_id uuid not null references products(id),
  batch_id uuid not null references batches(id),  -- the batch this receipt created or added to
  quantity int not null check (quantity > 0),
  unit_cost_xaf numeric(10,2)
);

-- ----------------------------------------------------------------------------
-- record_goods_receipt() — THE fix. For each item: finds an existing
-- batch by (product_id, batch_number) if this is a repeat delivery of
-- the same lot, or creates a new one — then ALWAYS records a real
-- 'receipt' stock_movement via record_stock_movement(), which is what
-- actually makes batch_quantity_on_hand() correct. This was the missing
-- step this whole time.
-- ----------------------------------------------------------------------------
create or replace function record_goods_receipt(
  p_clinic_id uuid,
  p_supplier_id uuid,
  p_received_by uuid,
  p_invoice_reference text,
  p_notes text,
  p_items jsonb  -- [{"product_id":"...","batch_number":"...","expiry_date":"...","quantity":N,"unit_cost_xaf":N}]
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
begin
  insert into goods_receipts (clinic_id, supplier_id, received_by, invoice_reference, notes)
  values (p_clinic_id, p_supplier_id, p_received_by, p_invoice_reference, p_notes)
  returning id into v_receipt_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_batch_number := v_item->>'batch_number';
    v_expiry_date := (v_item->>'expiry_date')::date;
    v_quantity := (v_item->>'quantity')::int;
    v_unit_cost := (v_item->>'unit_cost_xaf')::numeric;

    -- Reuse an existing batch if this is a repeat delivery of the same
    -- lot number; otherwise create a new one.
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

    -- THE ACTUAL FIX: a real stock_movements row, via the same
    -- concurrency-safe function every other stock change goes through.
    perform record_stock_movement(
      v_batch_id, 'receipt', v_quantity, 'goods_receipt', v_receipt_id,
      null, p_received_by
    );

    insert into goods_receipt_items (goods_receipt_id, product_id, batch_id, quantity, unit_cost_xaf)
    values (v_receipt_id, v_product_id, v_batch_id, v_quantity, v_unit_cost);
  end loop;

  return v_receipt_id;
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table suppliers enable row level security;
alter table goods_receipts enable row level security;
alter table goods_receipt_items enable row level security;

create policy suppliers_select on suppliers for select
  using (clinic_id = current_staff_clinic_id());
create policy suppliers_write on suppliers for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'pharmacist')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'pharmacist')
);

create policy goods_receipts_select on goods_receipts for select
  using (clinic_id = current_staff_clinic_id());
create policy goods_receipts_insert on goods_receipts for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'pharmacist')
);

create policy goods_receipt_items_select on goods_receipt_items for select
  using (exists (
    select 1 from goods_receipts gr where gr.id = goods_receipt_items.goods_receipt_id
      and gr.clinic_id = current_staff_clinic_id()
  ));
create policy goods_receipt_items_insert on goods_receipt_items for insert with check (
  exists (
    select 1 from goods_receipts gr where gr.id = goods_receipt_items.goods_receipt_id
      and gr.clinic_id = current_staff_clinic_id()
  )
);
