-- 183_fix_lab_payment_prepare_uuid.sql
-- The original migration 181 was already partially applied in the live
-- database: create_lab_order was renamed to create_lab_order_legacy and the
-- idempotent prepare function was installed. Do NOT rerun migration 181.
--
-- This patch only replaces the prepare function body. The previous version
-- used min(uuid), which PostgreSQL does not support.

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

  select count(distinct x.item_id)
    into v_selected_count
  from unnest(p_lab_order_item_ids) as x(item_id);

  select count(*)
    into v_deferred_count
  from public.lab_order_items
  where id = any(p_lab_order_item_ids)
    and billing_status = 'deferred'
    and status = 'pending';

  if v_deferred_count > 0 then
    return public.prepare_selected_lab_payment_legacy(
      p_lab_order_item_ids,
      p_staff_id
    );
  end if;

  foreach v_item_id in array p_lab_order_item_ids loop
    select loi.status::text,
           loi.billing_status,
           loi.service_charge_id
      into v_item_status,
           v_billing_status,
           v_charge_id
    from public.lab_order_items loi
    where loi.id = v_item_id
    for update;

    if v_item_status is null
       or v_item_status <> 'pending'
       or v_billing_status <> 'pending_payment'
       or v_charge_id is null then
      raise exception 'One selected laboratory investigation is no longer payable';
    end if;

    if not (v_charge_id = any(v_charge_ids)) then
      v_charge_ids := array_append(v_charge_ids, v_charge_id);
    end if;
  end loop;

  -- UUID has no min() aggregate in PostgreSQL. Select an existing open
  -- invoice deterministically instead.
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

  return public.prepare_selected_lab_payment_legacy(
    p_lab_order_item_ids,
    p_staff_id
  );
end;
$$;

revoke all on function public.prepare_selected_lab_payment(uuid[], uuid) from public;
grant execute on function public.prepare_selected_lab_payment(uuid[], uuid) to authenticated;

notify pgrst, 'reload schema';
