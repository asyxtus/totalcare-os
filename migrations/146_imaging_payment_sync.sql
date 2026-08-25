-- ============================================================================
-- MIGRATION 146: IMAGING PAYMENT SYNCHRONIZATION
-- ============================================================================

create or replace function public.sync_imaging_order_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_unpaid boolean;
begin
  select imaging_order_id into v_order_id
  from public.imaging_order_items
  where service_charge_id = new.id
  limit 1;

  if v_order_id is null then
    return new;
  end if;

  select exists (
    select 1
    from public.imaging_order_items ioi
    join public.service_charges sc on sc.id = ioi.service_charge_id
    where ioi.imaging_order_id = v_order_id
      and ioi.status <> 'cancelled'
      and greatest(
        coalesce(sc.patient_portion_xaf, sc.amount_xaf, 0) - coalesce(sc.amount_paid_xaf, 0),
        0
      ) > 0
  ) into v_unpaid;

  if not v_unpaid then
    update public.imaging_order_items
    set status = case when status = 'completed' then status else 'paid' end
    where imaging_order_id = v_order_id
      and status not in ('completed','cancelled');

    update public.imaging_orders
    set status = case when status = 'completed' then status else 'paid' end
    where id = v_order_id
      and status not in ('completed','cancelled');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_imaging_order_payment on public.service_charges;
create trigger trg_sync_imaging_order_payment
after insert or update of status, amount_paid_xaf, patient_portion_xaf
on public.service_charges
for each row
execute function public.sync_imaging_order_payment();

comment on function public.sync_imaging_order_payment() is
  'Automatically advances imaging orders to paid when all linked service charges are fully paid.';
