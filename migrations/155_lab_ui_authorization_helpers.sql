-- Migration 155: helpers for laboratory billing mode UI.
-- Keeps clinical ordering separate from financial authorization.

create or replace function public.set_lab_order_item_billing_mode(
  p_lab_order_item_id uuid,
  p_billing_mode text,
  p_reason text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_clinic_id uuid;
begin
  if p_billing_mode not in ('pay_now','charge_to_encounter','deferred') then
    raise exception 'Invalid laboratory billing mode';
  end if;

  select lo.clinic_id into v_clinic_id
  from lab_order_items loi
  join lab_orders lo on lo.id = loi.lab_order_id
  where loi.id = p_lab_order_item_id;

  if v_clinic_id is null then
    raise exception 'Laboratory order item not found';
  end if;

  update lab_order_items
  set billing_mode = p_billing_mode,
      authorization_status = case
        when p_billing_mode = 'deferred' then 'deferred'
        when p_billing_mode = 'charge_to_encounter' then 'authorized'
        else authorization_status
      end,
      deferred_reason = case when p_billing_mode = 'deferred' then nullif(trim(coalesce(p_reason,'')), '') else null end,
      deferred_at = case when p_billing_mode = 'deferred' then now() else null end
  where id = p_lab_order_item_id;
end;
$$;

grant execute on function public.set_lab_order_item_billing_mode(uuid, text, text) to authenticated;
