-- 182_fix_lab_payment_rpc_schema.sql
-- Restore/re-register the reception lab payment RPC and force PostgREST
-- to reload its schema cache. The preparation step can already succeed while
-- collection fails if this function was not present in the exposed schema.

create or replace function public.collect_selected_lab_payment(
  p_invoice_id uuid,
  p_lab_order_item_ids uuid[],
  p_total_amount_xaf numeric,
  p_received_by uuid,
  p_method text,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_invoice_patient_id uuid;
  v_invoice_visit_id uuid;
  v_invoice_clinic_id uuid;
  v_item_count integer := 0;
  v_invoice_item_count integer := 0;
  v_selected_outstanding numeric(12,2) := 0;
  v_payment_id uuid;
  v_billing_status text;
  v_item_status text;
  v_service_charge_id uuid;
  v_item_visit_id uuid;
  v_role text;
begin
  if p_invoice_id is null then
    raise exception 'Laboratory invoice is required';
  end if;

  if p_lab_order_item_ids is null
     or coalesce(array_length(p_lab_order_item_ids, 1), 0) = 0 then
    raise exception 'Select at least one laboratory investigation';
  end if;

  if p_total_amount_xaf is null or p_total_amount_xaf <= 0 then
    raise exception 'Invalid laboratory payment amount';
  end if;

  select i.clinic_id, i.patient_id, i.visit_id
    into v_invoice_clinic_id, v_invoice_patient_id, v_invoice_visit_id
  from public.invoices i
  where i.id = p_invoice_id
    and i.status in ('unpaid','partial')
  for update;

  if v_invoice_clinic_id is null then
    raise exception 'Laboratory invoice not found or is already settled';
  end if;

  select coalesce(active_role, role)::text
    into v_role
  from public.staff
  where id = p_received_by
    and clinic_id = v_invoice_clinic_id
    and is_active = true;

  if v_role not in ('admin','receptionist','billing_clerk','doctor') then
    raise exception 'Staff role is not authorized to collect laboratory payment';
  end if;

  select count(distinct x.item_id)
    into v_item_count
  from unnest(p_lab_order_item_ids) as x(item_id);

  foreach v_item_id in array p_lab_order_item_ids loop
    select loi.status::text,
           loi.billing_status::text,
           loi.service_charge_id,
           lo.visit_id
      into v_item_status,
           v_billing_status,
           v_service_charge_id,
           v_item_visit_id
    from public.lab_order_items loi
    join public.lab_orders lo on lo.id = loi.lab_order_id
    where loi.id = v_item_id
      and loi.clinic_id = v_invoice_clinic_id
    for update;

    if v_item_status is null then
      raise exception 'Laboratory investigation % was not found', v_item_id;
    end if;

    if v_item_visit_id <> v_invoice_visit_id then
      raise exception 'Selected laboratory investigations do not belong to this invoice/encounter';
    end if;

    if v_item_status <> 'pending' then
      raise exception 'Laboratory investigation % is no longer pending', v_item_id;
    end if;

    if v_billing_status not in ('pending_payment','deferred') then
      raise exception 'Laboratory investigation % is no longer payable (status: %)', v_item_id, v_billing_status;
    end if;

    if v_service_charge_id is null then
      raise exception 'Laboratory investigation % has no financial charge', v_item_id;
    end if;

    if not exists (
      select 1
      from public.invoice_items ii
      where ii.invoice_id = p_invoice_id
        and ii.service_charge_id = v_service_charge_id
    ) then
      raise exception 'Laboratory investigation % is not part of the selected invoice', v_item_id;
    end if;

    if not exists (
      select 1
      from public.service_charges sc
      where sc.id = v_service_charge_id
        and sc.patient_id = v_invoice_patient_id
        and sc.visit_id = v_invoice_visit_id
        and sc.status <> 'void'
    ) then
      raise exception 'Financial charge for laboratory investigation % is missing or void', v_item_id;
    end if;
  end loop;

  select count(*)
    into v_invoice_item_count
  from public.invoice_items
  where invoice_id = p_invoice_id;

  if v_invoice_item_count <> v_item_count then
    raise exception 'The laboratory invoice contains charges outside the selected investigations';
  end if;

  if exists (
    select 1
    from public.invoice_items ii
    where ii.invoice_id = p_invoice_id
      and not exists (
        select 1
        from public.lab_order_items loi
        where loi.id = any(p_lab_order_item_ids)
          and loi.service_charge_id = ii.service_charge_id
      )
  ) then
    raise exception 'The laboratory invoice does not exactly match the selected investigations';
  end if;

  select coalesce(
    sum(
      greatest(
        coalesce(sc.patient_portion_xaf, sc.amount_xaf)
        - coalesce(sc.amount_paid_xaf, 0),
        0
      )
    ),
    0
  )
    into v_selected_outstanding
  from public.lab_order_items loi
  join public.service_charges sc on sc.id = loi.service_charge_id
  where loi.id = any(p_lab_order_item_ids)
    and sc.patient_id = v_invoice_patient_id
    and sc.visit_id = v_invoice_visit_id
    and sc.status <> 'void';

  if round(p_total_amount_xaf, 2) <> round(v_selected_outstanding, 2) then
    raise exception 'Selected laboratory payment must be exactly % FCFA; received amount was % FCFA',
      v_selected_outstanding,
      p_total_amount_xaf;
  end if;

  v_payment_id := public.create_payment(
    p_invoice_id,
    p_total_amount_xaf,
    p_received_by,
    jsonb_build_array(
      jsonb_build_object(
        'method', p_method,
        'amount', p_total_amount_xaf,
        'provider_transaction_ref', nullif(trim(p_reference), '')
      )
    )
  );

  if exists (
    select 1
    from public.lab_order_items loi
    join public.service_charges sc on sc.id = loi.service_charge_id
    where loi.id = any(p_lab_order_item_ids)
      and (
        loi.billing_status <> 'paid'
        or greatest(
          coalesce(sc.patient_portion_xaf, sc.amount_xaf)
          - coalesce(sc.amount_paid_xaf, 0),
          0
        ) > 0
      )
  ) then
    raise exception 'Payment was recorded but one or more selected laboratory investigations were not fully paid';
  end if;

  insert into public.audit_log (
    clinic_id,
    staff_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    v_invoice_clinic_id,
    p_received_by,
    'laboratory.selected_payment_collected',
    'invoice',
    p_invoice_id,
    jsonb_build_object(
      'visit_id', v_invoice_visit_id,
      'patient_id', v_invoice_patient_id,
      'lab_order_item_ids', p_lab_order_item_ids,
      'amount_xaf', p_total_amount_xaf,
      'method', p_method,
      'reference', nullif(trim(p_reference), ''),
      'payment_id', v_payment_id
    )
  );

  return v_payment_id;
end;
$$;

revoke all on function public.collect_selected_lab_payment(uuid, uuid[], numeric, uuid, text, text) from public;
grant execute on function public.collect_selected_lab_payment(uuid, uuid[], numeric, uuid, text, text) to authenticated;

comment on function public.collect_selected_lab_payment(uuid, uuid[], numeric, uuid, text, text)
is 'Atomically collects exactly the selected laboratory investigations.';

-- PostgREST can retain a stale schema cache after a function is created or
-- replaced. Force a reload so the reception RPC is immediately discoverable.
notify pgrst, 'reload schema';
