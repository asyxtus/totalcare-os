-- ============================================================================
-- MIGRATION 168: FIX LAB RECEPTION CHARGE STATUS ENUM
--
-- service_charge_status is: pending, paid, partial, void.
-- Reception lab selection must void an unused charge; 'cancelled' is not a
-- valid service_charge_status value in the existing database schema.
-- ============================================================================

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
  v_first_visit_id uuid;
  v_first_clinic_id uuid;
  v_item_clinic_id uuid;
  v_item_visit_id uuid;
  v_status text;
  v_billing_status text;
  v_role staff_role;
  v_charge_ids uuid[] := array[]::uuid[];
  v_invoice_id uuid;
  v_patient_id uuid;
  v_total numeric(12,2) := 0;
  v_charge record;
  v_unselected record;
begin
  if coalesce(array_length(p_lab_order_item_ids, 1), 0) = 0 then
    raise exception 'Select at least one laboratory investigation';
  end if;

  select lo.clinic_id, lo.visit_id
    into v_first_clinic_id, v_first_visit_id
  from lab_order_items loi
  join lab_orders lo on lo.id = loi.lab_order_id
  where loi.id = p_lab_order_item_ids[1]
    and loi.status = 'pending'
    and loi.billing_status in ('pending_payment','deferred')
  for update;

  if v_first_clinic_id is null then
    raise exception 'Selected laboratory investigation is no longer payable';
  end if;

  select coalesce(active_role, role)
    into v_role
  from staff
  where id = p_staff_id
    and clinic_id = v_first_clinic_id
    and is_active;

  if v_role not in ('admin','receptionist','billing_clerk','doctor') then
    raise exception 'Staff role is not authorized to collect laboratory payment';
  end if;

  select patient_id into v_patient_id
  from visits
  where id = v_first_visit_id;

  foreach v_item_id in array p_lab_order_item_ids loop
    select lo.clinic_id,
           lo.visit_id,
           loi.service_charge_id,
           loi.status::text,
           loi.billing_status
      into v_item_clinic_id,
           v_item_visit_id,
           v_charge_id,
           v_status,
           v_billing_status
    from lab_order_items loi
    join lab_orders lo on lo.id = loi.lab_order_id
    where loi.id = v_item_id
    for update;

    if v_item_clinic_id is null
       or v_item_clinic_id <> v_first_clinic_id
       or v_item_visit_id <> v_first_visit_id then
      raise exception 'All selected laboratory investigations must belong to the same encounter';
    end if;

    if v_status <> 'pending'
       or v_billing_status not in ('pending_payment','deferred') then
      raise exception 'One selected laboratory investigation is no longer payable';
    end if;

    if v_billing_status = 'deferred' then
      v_charge_id := public.activate_deferred_lab_order_item(
        v_item_id,
        p_staff_id,
        'pay_now'
      );
    end if;

    if v_charge_id is null then
      raise exception 'Laboratory investigation has no financial charge';
    end if;

    if not (v_charge_id = any(v_charge_ids)) then
      v_charge_ids := array_append(v_charge_ids, v_charge_id);
    end if;
  end loop;

  -- Unselected pending-payment items remain clinically ordered but are
  -- deferred. Their unused service charge is VOID, not cancelled, because
  -- service_charge_status does not contain a 'cancelled' enum value.
  for v_unselected in
    select loi.id,
           loi.service_charge_id,
           lo.clinic_id
    from lab_order_items loi
    join lab_orders lo on lo.id = loi.lab_order_id
    where loi.lab_order_id in (
      select distinct loi2.lab_order_id
      from lab_order_items loi2
      where loi2.id = any(p_lab_order_item_ids)
    )
      and loi.id <> all(p_lab_order_item_ids)
      and loi.status = 'pending'
      and loi.billing_status = 'pending_payment'
    for update
  loop
    if v_unselected.service_charge_id is not null then
      update service_charges
      set status = 'void'
      where id = v_unselected.service_charge_id
        and amount_paid_xaf = 0;

      if not found then
        raise exception 'An unselected laboratory charge has already received payment';
      end if;
    end if;

    update lab_order_items
    set billing_status = 'deferred'
    where id = v_unselected.id;

    insert into audit_log (
      clinic_id,
      staff_id,
      action,
      entity_type,
      entity_id,
      details
    )
    values (
      v_unselected.clinic_id,
      p_staff_id,
      'laboratory.item_auto_deferred',
      'lab_order_item',
      v_unselected.id,
      jsonb_build_object(
        'reason', 'Reception selected other investigations for payment',
        'selected_item_ids', p_lab_order_item_ids
      )
    );
  end loop;

  foreach v_charge_id in array v_charge_ids loop
    select * into v_charge
    from service_charges
    where id = v_charge_id
    for update;

    if v_charge.id is null then
      raise exception 'Laboratory charge not found';
    end if;

    if v_charge.patient_id <> v_patient_id
       or v_charge.visit_id <> v_first_visit_id then
      raise exception 'Laboratory charge does not belong to the selected encounter';
    end if;

    v_total := v_total + coalesce(v_charge.amount_xaf, 0);
  end loop;

  v_invoice_id := open_invoice_for_charges(v_charge_ids, p_staff_id);

  insert into audit_log (
    clinic_id,
    staff_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    v_first_clinic_id,
    p_staff_id,
    'laboratory.selected_payment_prepared',
    'visit',
    v_first_visit_id,
    jsonb_build_object(
      'lab_order_item_ids', p_lab_order_item_ids,
      'service_charge_ids', v_charge_ids,
      'invoice_id', v_invoice_id,
      'amount_xaf', v_total
    )
  );

  return v_invoice_id;
end;
$$;

grant execute on function public.prepare_selected_lab_payment(uuid[], uuid) to authenticated;
