-- MIGRATION 157: attribute laboratory payment events to the staff member
-- who actually received/recorded the payment.

create or replace function public.audit_lab_payment_allocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge_id uuid;
  v_item_id uuid;
  v_clinic_id uuid;
  v_received_by uuid;
begin
  v_charge_id := new.service_charge_id;

  if v_charge_id is null then
    return new;
  end if;

  select loi.id, loi.clinic_id, p.received_by
    into v_item_id, v_clinic_id, v_received_by
  from public.lab_order_items loi
  join public.payments p on p.id = new.payment_id
  where loi.service_charge_id = v_charge_id
  limit 1;

  if v_item_id is not null then
    update public.lab_order_items
    set billing_status = 'paid',
        authorization_status = 'paid'
    where id = v_item_id
      and billing_status not in ('deferred','cancelled');

    insert into public.audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
    values (
      v_clinic_id,
      v_received_by,
      'laboratory.item_paid',
      'lab_order_item',
      v_item_id,
      jsonb_build_object(
        'service_charge_id', v_charge_id,
        'payment_id', new.payment_id,
        'amount_xaf', new.amount_xaf
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_lab_payment_allocation on public.payment_allocations;
create trigger trg_audit_lab_payment_allocation
after insert on public.payment_allocations
for each row execute function public.audit_lab_payment_allocation();
