-- 181_lab_duplicate_financial_protection.sql
-- Prevent duplicate laboratory charges/invoices for the same investigation
-- within the same encounter, repair safe legacy duplicates, and make reception
-- lab payment preparation idempotent.

-- ---------------------------------------------------------------------------
-- 1. Rename the existing 5-argument implementation. The compatibility
-- 4-argument wrapper from migration 154 will continue to call the new public
-- create_lab_order() wrapper below.
-- ---------------------------------------------------------------------------
alter function public.create_lab_order(uuid, uuid, uuid, jsonb, text)
  rename to create_lab_order_legacy;

-- ---------------------------------------------------------------------------
-- 2. Safe laboratory order entry point.
--
-- A visit row is locked before checking existing items. This matters because
-- two concurrent consultation submissions can otherwise both observe "no
-- existing lab order" and both create a charge.
--
-- Duplicate definition:
--   same visit + same panel
--   same visit + same individual test
--   same visit + same external test name
--
-- Completed + paid tests may be ordered again deliberately. Pending,
-- sample-collected, paid-but-not-yet-performed, authorized and deferred
-- duplicates are suppressed.
-- ---------------------------------------------------------------------------
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
  v_visit record;
  v_item jsonb;
  v_filtered jsonb := '[]'::jsonb;
  v_seen_keys text[] := array[]::text[];
  v_key text;
  v_existing_order_id uuid;
  v_existing_charge_id uuid;
  v_existing_order_ids uuid[] := array[]::uuid[];
  v_existing_charge_ids uuid[] := array[]::uuid[];
  v_result record;
  v_items_array jsonb[];
begin
  if p_billing_mode not in ('pay_now','charge_to_encounter','deferred') then
    raise exception 'Invalid laboratory billing mode: %', p_billing_mode;
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one laboratory investigation is required';
  end if;

  select *
    into v_visit
  from public.visits
  where id = p_visit_id
    and clinic_id = p_clinic_id
  for update;

  if not found then
    raise exception 'Visit % not found', p_visit_id;
  end if;

  select array_agg(value order by ordinality)
    into v_items_array
  from jsonb_array_elements(p_items) with ordinality;

  foreach v_item in array v_items_array
  loop
    if v_item->>'type' = 'panel' then
      v_key := 'panel:' || lower(trim(v_item->>'panel_id'));

      if v_key = any(v_seen_keys) then
        continue;
      end if;

      select loi.lab_order_id, loi.service_charge_id
        into v_existing_order_id, v_existing_charge_id
      from public.lab_order_items loi
      join public.lab_orders lo on lo.id = loi.lab_order_id
      where lo.visit_id = p_visit_id
        and loi.item_type = 'panel'
        and loi.lab_panel_id = nullif(trim(v_item->>'panel_id'), '')::uuid
        and loi.status <> 'cancelled'
        and loi.billing_status <> 'cancelled'
        and not (loi.status = 'completed' and loi.billing_status = 'paid')
      order by loi.created_at asc
      limit 1;

    elsif v_item->>'type' = 'individual_test' then
      v_key := 'test:' || lower(trim(v_item->>'catalog_id'));

      if v_key = any(v_seen_keys) then
        continue;
      end if;

      select loi.lab_order_id, loi.service_charge_id
        into v_existing_order_id, v_existing_charge_id
      from public.lab_order_items loi
      join public.lab_orders lo on lo.id = loi.lab_order_id
      where lo.visit_id = p_visit_id
        and loi.item_type = 'individual_test'
        and loi.lab_test_catalog_id = nullif(trim(v_item->>'catalog_id'), '')::uuid
        and loi.status <> 'cancelled'
        and loi.billing_status <> 'cancelled'
        and not (loi.status = 'completed' and loi.billing_status = 'paid')
      order by loi.created_at asc
      limit 1;

    elsif v_item->>'type' = 'external' then
      v_key := 'external:' || lower(trim(v_item->>'name'));

      if v_key = any(v_seen_keys) then
        continue;
      end if;

      select loi.lab_order_id, loi.service_charge_id
        into v_existing_order_id, v_existing_charge_id
      from public.lab_order_items loi
      join public.lab_orders lo on lo.id = loi.lab_order_id
      where lo.visit_id = p_visit_id
        and loi.item_type = 'external'
        and lower(trim(coalesce(loi.external_test_name, ''))) = lower(trim(v_item->>'name'))
        and loi.status <> 'cancelled'
        and loi.billing_status <> 'cancelled'
        and not (loi.status = 'completed' and loi.billing_status = 'paid')
      order by loi.created_at asc
      limit 1;

    else
      raise exception 'Unknown lab order item type: %', v_item->>'type';
    end if;

    v_seen_keys := array_append(v_seen_keys, v_key);

    if v_existing_order_id is not null then
      v_existing_order_ids := array_append(v_existing_order_ids, v_existing_order_id);
      if v_existing_charge_id is not null then
        v_existing_charge_ids := array_append(v_existing_charge_ids, v_existing_charge_id);
      end if;

      insert into public.audit_log (
        clinic_id, staff_id, action, entity_type, entity_id, details
      )
      values (
        p_clinic_id,
        p_ordered_by,
        'laboratory.duplicate_order_suppressed',
        'visit',
        p_visit_id,
        jsonb_build_object(
          'item_key', v_key,
          'existing_lab_order_id', v_existing_order_id,
          'existing_service_charge_id', v_existing_charge_id
        )
      );
    else
      v_filtered := v_filtered || jsonb_build_array(v_item);
    end if;

    v_existing_order_id := null;
    v_existing_charge_id := null;
  end loop;

  -- Nothing new was requested. Return an existing order rather than creating
  -- an empty lab order. This makes retries a harmless no-op.
  if jsonb_array_length(v_filtered) = 0 then
    if coalesce(array_length(v_existing_order_ids, 1), 0) = 0 then
      raise exception 'No new laboratory investigations to order';
    end if;

    return query
    select
      v_existing_order_ids[1],
      coalesce(v_existing_charge_ids, array[]::uuid[]);
    return;
  end if;

  select *
    into v_result
  from public.create_lab_order_legacy(
    p_clinic_id,
    p_visit_id,
    p_ordered_by,
    v_filtered,
    p_billing_mode
  );

  return query
  select v_result.lab_order_id, coalesce(v_result.service_charge_ids, array[]::uuid[]);
end;
$$;

revoke all on function public.create_lab_order(uuid, uuid, uuid, jsonb, text) from public;
grant execute on function public.create_lab_order(uuid, uuid, uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Protect invoice_items from attaching one service charge to multiple
-- invoices. A service charge represents one financial obligation and should
-- have one invoice line at most.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_duplicate_invoice_service_charge()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.invoice_items ii
    where ii.service_charge_id = new.service_charge_id
  ) then
    raise exception 'Service charge % is already attached to an invoice', new.service_charge_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_invoice_service_charge on public.invoice_items;
create trigger trg_prevent_duplicate_invoice_service_charge
before insert on public.invoice_items
for each row
execute function public.prevent_duplicate_invoice_service_charge();

-- ---------------------------------------------------------------------------
-- 4. Make reception "prepare payment" idempotent.
--
-- If the selected charges are already bundled into the same open invoice,
-- reuse it. If a selected charge is already attached to a different open
-- invoice, refuse to create another invoice rather than duplicating the
-- financial line.
--
-- Deferred items still delegate to the existing legacy implementation once;
-- after activation, a retry sees the existing charge/invoice and reuses it.
-- ---------------------------------------------------------------------------
alter function public.prepare_selected_lab_payment(uuid[], uuid)
  rename to prepare_selected_lab_payment_legacy;

create or replace function public.prepare_selected_lab_payment(
  p_lab_order_item_ids uuid[],
  p_staff_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_charge_id uuid;
  v_charge_ids uuid[] := array[]::uuid[];
  v_invoice_id uuid;
  v_candidate_invoice_id uuid;
  v_open_invoice_count integer;
  v_invoice_item_count integer;
  v_selected_count integer;
  v_deferred_count integer;
  v_item_status text;
  v_billing_status text;
begin
  if coalesce(array_length(p_lab_order_item_ids, 1), 0) = 0 then
    raise exception 'Select at least one laboratory investigation';
  end if;

  select count(*)
    into v_selected_count
  from unnest(p_lab_order_item_ids) as x(item_id);

  select count(*)
    into v_deferred_count
  from public.lab_order_items
  where id = any(p_lab_order_item_ids)
    and billing_status = 'deferred'
    and status = 'pending';

  -- A deferred item has no charge yet. Let the existing atomic workflow
  -- activate it and bundle the first invoice. Repeated calls after that
  -- activation are handled by the branch below.
  if v_deferred_count > 0 then
    return public.prepare_selected_lab_payment_legacy(p_lab_order_item_ids, p_staff_id);
  end if;

  foreach v_item_id in array p_lab_order_item_ids loop
    select loi.status::text, loi.billing_status, loi.service_charge_id
      into v_item_status, v_billing_status, v_charge_id
    from public.lab_order_items loi
    where loi.id = v_item_id
    for update;

    if v_item_status is null
       or v_item_status <> 'pending'
       or v_billing_status <> 'pending_payment'
       or v_charge_id is null then
      raise exception 'One selected laboratory investigation is no longer payable';
    end if;

    v_charge_ids := array_append(v_charge_ids, v_charge_id);
  end loop;

  -- Is there already an open invoice containing these exact charges?
  select ii.invoice_id
    into v_candidate_invoice_id
  from public.invoice_items ii
  join public.invoices i on i.id = ii.invoice_id
  where ii.service_charge_id = any(v_charge_ids)
    and i.status in ('unpaid','partial')
  order by ii.invoice_id
  limit 1;

  if v_candidate_invoice_id is not null then
    select count(*)
      into v_open_invoice_count
    from public.invoice_items ii
    where ii.invoice_id = v_candidate_invoice_id;

    select count(*)
      into v_invoice_item_count
    from public.invoice_items ii
    where ii.invoice_id = v_candidate_invoice_id
      and ii.service_charge_id = any(v_charge_ids);

    if v_open_invoice_count = v_selected_count
       and v_invoice_item_count = v_selected_count then
      return v_candidate_invoice_id;
    end if;

    raise exception 'One or more selected laboratory investigations are already attached to another open invoice';
  end if;

  -- No existing invoice: use the established atomic implementation.
  return public.prepare_selected_lab_payment_legacy(p_lab_order_item_ids, p_staff_id);
end;
$$;

revoke all on function public.prepare_selected_lab_payment(uuid[], uuid) from public;
grant execute on function public.prepare_selected_lab_payment(uuid[], uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. One-time repair of legacy duplicate laboratory items.
--
-- Only unpaid, pending/deferred duplicates are touched. Paid, authorized,
-- partially-paid, collected or completed records are preserved.
--
-- Canonical item preference:
--   paid > authorized > completed > earliest pending
--
-- For each duplicate that is safe to remove, void its zero-paid service
-- charge and cancel the lab item. The audit record preserves the reason.
-- ---------------------------------------------------------------------------
with ranked as (
  select
    loi.id,
    loi.clinic_id,
    loi.service_charge_id,
    loi.status::text as item_status,
    loi.billing_status,
    row_number() over (
      partition by
        lo.visit_id,
        loi.item_type,
        loi.lab_panel_id,
        loi.lab_test_catalog_id,
        lower(trim(coalesce(loi.external_test_name, '')))
      order by
        case
          when loi.billing_status = 'paid' then 0
          when loi.billing_status = 'authorized' then 1
          when loi.status = 'completed' then 2
          else 3
        end,
        loi.created_at asc,
        loi.id asc
    ) as rn
  from public.lab_order_items loi
  join public.lab_orders lo on lo.id = loi.lab_order_id
  where loi.status <> 'cancelled'
    and loi.billing_status <> 'cancelled'
)
update public.service_charges sc
set status = 'void',
    voided_reason = coalesce(sc.voided_reason, 'Duplicate laboratory charge reconciled by migration 181')
from ranked r
where r.rn > 1
  and r.service_charge_id = sc.id
  and r.item_status = 'pending'
  and r.billing_status in ('pending_payment','deferred')
  and sc.amount_paid_xaf = 0
  and sc.status in ('pending','partial');

with ranked as (
  select
    loi.id,
    row_number() over (
      partition by
        lo.visit_id,
        loi.item_type,
        loi.lab_panel_id,
        loi.lab_test_catalog_id,
        lower(trim(coalesce(loi.external_test_name, '')))
      order by
        case
          when loi.billing_status = 'paid' then 0
          when loi.billing_status = 'authorized' then 1
          when loi.status = 'completed' then 2
          else 3
        end,
        loi.created_at asc,
        loi.id asc
    ) as rn
  from public.lab_order_items loi
  join public.lab_orders lo on lo.id = loi.lab_order_id
  where loi.status <> 'cancelled'
    and loi.billing_status <> 'cancelled'
)
update public.lab_order_items loi
set billing_status = 'cancelled',
    status = case when loi.status = 'pending' then 'cancelled'::lab_order_item_status else loi.status end
from ranked r
where r.id = loi.id
  and r.rn > 1
  and loi.status = 'pending'
  and loi.billing_status in ('pending_payment','deferred')
  and (
    loi.service_charge_id is null
    or exists (
      select 1
      from public.service_charges sc
      where sc.id = loi.service_charge_id
        and sc.status = 'void'
        and sc.amount_paid_xaf = 0
    )
  );

-- Audit the repaired duplicate items.
insert into public.audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
select
  loi.clinic_id,
  null,
  'laboratory.duplicate_item_reconciled',
  'lab_order_item',
  loi.id,
  jsonb_build_object(
    'reason', 'Duplicate laboratory investigation within the same encounter',
    'migration', 181
  )
from public.lab_order_items loi
where loi.billing_status = 'cancelled'
  and exists (
    select 1
    from public.audit_log al
    where al.entity_type = 'lab_order_item'
      and al.entity_id = loi.id
      and al.action = 'laboratory.duplicate_item_reconciled'
  ) is false;
