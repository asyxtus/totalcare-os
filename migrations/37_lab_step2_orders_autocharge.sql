-- ============================================================================
-- LAB MODULE, STEP 2: ORDERS + AUTO-CHARGE
-- Same fraud-prevention principle as pharmacy dispensing, built in from
-- day one this time: ordering an in-house test or panel generates its
-- charge automatically, in the same transaction — not a separate step
-- someone could forget or skip.
--
-- Deliberately different from pharmacy in one way: an EXTERNAL test
-- (something your clinic doesn't have in-house) generates NO charge at
-- all. You're not billing for a test you didn't perform — the patient
-- pays whatever outside facility actually runs it.
-- ============================================================================

create type lab_order_item_type as enum ('panel', 'individual_test', 'external');
create type lab_order_item_status as enum ('pending', 'sample_collected', 'completed', 'cancelled');

create table lab_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  ordered_by uuid references staff(id),
  ordered_at timestamptz not null default now(),
  notes text
);
create index idx_lab_orders_visit on lab_orders(visit_id);

create table lab_order_items (
  id uuid primary key default gen_random_uuid(),
  lab_order_id uuid not null references lab_orders(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  item_type lab_order_item_type not null,
  lab_panel_id uuid references lab_panels(id),           -- set only when item_type = 'panel'
  lab_test_catalog_id uuid references lab_test_catalog(id), -- set only when item_type = 'individual_test'
  external_test_name text,                                -- set only when item_type = 'external'
  service_charge_id uuid references service_charges(id),  -- null for external items — no charge
  status lab_order_item_status not null default 'pending',
  created_at timestamptz not null default now(),
  check (
    (item_type = 'panel' and lab_panel_id is not null) or
    (item_type = 'individual_test' and lab_test_catalog_id is not null) or
    (item_type = 'external' and external_test_name is not null)
  )
);
create index idx_lab_order_items_order on lab_order_items(lab_order_id);

-- ----------------------------------------------------------------------------
-- Bundle multiple charges into ONE invoice — generalizes
-- open_invoice_for_charge (built for the single consultation charge at
-- check-in) to handle a lab order that might bill for several panels/
-- tests at once as one payable invoice, not one invoice per line.
-- ----------------------------------------------------------------------------
create or replace function open_invoice_for_charges(
  p_service_charge_ids uuid[],
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_clinic_id uuid;
  v_patient_id uuid;
  v_visit_id uuid;
  v_total numeric(10,2) := 0;
  v_invoice_id uuid;
  v_charge record;
begin
  if array_length(p_service_charge_ids, 1) is null then
    raise exception 'No charges provided';
  end if;

  for v_charge in select * from service_charges where id = any(p_service_charge_ids)
  loop
    v_clinic_id := v_charge.clinic_id;
    v_patient_id := v_charge.patient_id;
    v_visit_id := v_charge.visit_id;
    v_total := v_total + v_charge.amount_xaf;
  end loop;

  insert into invoices (clinic_id, patient_id, visit_id, total_amount_xaf, created_by)
  values (v_clinic_id, v_patient_id, v_visit_id, v_total, p_created_by)
  returning id into v_invoice_id;

  insert into invoice_items (invoice_id, service_charge_id, amount_xaf)
  select v_invoice_id, sc.id, sc.amount_xaf
  from service_charges sc where sc.id = any(p_service_charge_ids);

  return v_invoice_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- create_lab_order() — the actual fraud-prevention function. Takes a
-- jsonb array of requested items, creates the order + items, and
-- auto-charges every in-house item (panel or individual test) in the
-- SAME transaction. External items get no charge, per the design above.
-- ----------------------------------------------------------------------------
create or replace function create_lab_order(
  p_clinic_id uuid,
  p_visit_id uuid,
  p_ordered_by uuid,
  p_items jsonb  -- [{"type":"panel","panel_id":"..."}, {"type":"individual_test","catalog_id":"..."}, {"type":"external","name":"..."}]
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
  select patient_id into v_patient_id from visits where id = p_visit_id;
  if v_patient_id is null then
    raise exception 'Visit % not found', p_visit_id;
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
      -- NO CHARGE — the clinic isn't performing this test.
      insert into lab_order_items (lab_order_id, clinic_id, item_type, external_test_name)
      values (v_order_id, p_clinic_id, 'external', v_item->>'name');

    else
      raise exception 'Unknown lab order item type: %', v_item_type;
    end if;
  end loop;

  return query select v_order_id, v_charge_ids;
end;
$$;

-- ----------------------------------------------------------------------------
-- Simple status transition for the lab tech workflow — collecting a
-- sample. No complex gate needed here; the real gate (can't mark
-- completed without a result) comes in Step 3 alongside lab_results.
-- ----------------------------------------------------------------------------
create or replace function mark_sample_collected(
  p_lab_order_item_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
as $$
begin
  update lab_order_items set status = 'sample_collected'
  where id = p_lab_order_item_id and status = 'pending';

  if not found then
    raise exception 'Item not found or not in pending status';
  end if;
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table lab_orders enable row level security;
alter table lab_order_items enable row level security;

create policy lab_orders_select on lab_orders for select
  using (clinic_id = current_staff_clinic_id());
create policy lab_orders_write on lab_orders for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin','doctor')
);

create policy lab_order_items_select on lab_order_items for select
  using (clinic_id = current_staff_clinic_id());
create policy lab_order_items_write on lab_order_items for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin','doctor','lab_technician')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin','doctor','lab_technician')
);

-- ============================================================================
-- NOT YET INCLUDED — waiting for your review before adding:
--   - lab_results (structured values + critical flagging using
--     effective_lab_test_range())
--   - lab_result_attachments (the image-instead-of-manual-entry option)
--   - verification workflow
--   - lab tech's own screen + doctor's results-viewing panel
-- ============================================================================
