-- ============================================================================
-- MIGRATION 156: LAB BILLING WORKFLOW HARDENING
--
-- Rules:
--   ORDER != CHARGE != AUTHORIZATION != PAYMENT != PERFORMANCE
--   The laboratory queue may contain only paid or authorized items.
--   Deferred items remain clinically ordered but are financially inactive.
--   Reactivation creates exactly one new service charge for that item.
--   Payment synchronization is automatic when a linked service charge becomes paid.
--   Audit every financial/readiness transition.
-- ============================================================================

alter table public.lab_order_items
  add column if not exists billing_mode text;

alter table public.lab_order_items
  add column if not exists authorization_status text;

alter table public.lab_order_items
  add column if not exists deferred_reason text;

alter table public.lab_order_items
  add column if not exists deferred_at timestamptz;

update public.lab_order_items
set billing_mode = case
  when billing_status = 'authorized' then 'charge_to_encounter'
  when billing_status = 'deferred' then 'deferred'
  else 'pay_now'
end
where billing_mode is null;

update public.lab_order_items
set authorization_status = case
  when billing_status = 'authorized' then 'authorized'
  when billing_status = 'deferred' then 'deferred'
  when billing_status = 'paid' then 'paid'
  else 'pending'
end
where authorization_status is null;

alter table public.lab_order_items
  drop constraint if exists lab_order_items_billing_mode_check;
alter table public.lab_order_items
  add constraint lab_order_items_billing_mode_check
  check (billing_mode in ('pay_now','charge_to_encounter','deferred'));

alter table public.lab_order_items
  drop constraint if exists lab_order_items_authorization_status_check;
alter table public.lab_order_items
  add constraint lab_order_items_authorization_status_check
  check (authorization_status in ('pending','authorized','deferred','paid','cancelled'));

create index if not exists idx_lab_order_items_readiness
  on public.lab_order_items(clinic_id, billing_status, status, created_at);

-- ---------------------------------------------------------------------------
-- Keep the item-level UI fields synchronized with the canonical billing_status.
-- ---------------------------------------------------------------------------
create or replace function public.sync_lab_item_billing_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.billing_status = 'authorized' then
    new.billing_mode := 'charge_to_encounter';
    new.authorization_status := 'authorized';
  elsif new.billing_status = 'deferred' then
    new.billing_mode := 'deferred';
    new.authorization_status := 'deferred';
  elsif new.billing_status = 'paid' then
    new.billing_mode := 'pay_now';
    new.authorization_status := 'paid';
  elsif new.billing_status = 'cancelled' then
    new.authorization_status := 'cancelled';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_lab_item_billing_fields on public.lab_order_items;
create trigger trg_sync_lab_item_billing_fields
before insert or update of billing_status on public.lab_order_items
for each row execute function public.sync_lab_item_billing_fields();

-- ---------------------------------------------------------------------------
-- Payment -> laboratory readiness synchronization.
-- A paid service charge makes its linked lab item paid/readable by the lab.
-- Authorized encounter charges intentionally remain authorized without payment.
-- ---------------------------------------------------------------------------
create or replace function public.sync_lab_order_item_from_service_charge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_amount numeric;
  v_paid numeric;
begin
  select loi.id, coalesce(sc.amount_xaf,0), coalesce(sc.amount_paid_xaf,0)
    into v_item_id, v_amount, v_paid
  from public.lab_order_items loi
  where loi.service_charge_id = new.id
  limit 1;

  if v_item_id is null then
    return new;
  end if;

  if new.status = 'paid' or (v_amount > 0 and v_paid >= v_amount) then
    update public.lab_order_items
    set billing_status = 'paid',
        authorization_status = 'paid'
    where id = v_item_id
      and billing_status not in ('authorized','deferred','cancelled','paid');

    insert into public.audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
    select loi.clinic_id, null, 'laboratory.item_paid', 'lab_order_item', loi.id,
           jsonb_build_object('service_charge_id', new.id, 'amount_paid_xaf', new.amount_paid_xaf)
    from public.lab_order_items loi
    where loi.id = v_item_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_lab_order_item_from_service_charge on public.service_charges;
create trigger trg_sync_lab_order_item_from_service_charge
after insert or update of status, amount_paid_xaf, patient_portion_xaf
on public.service_charges
for each row execute function public.sync_lab_order_item_from_service_charge();

-- ---------------------------------------------------------------------------
-- Item audit trigger: captures ordering and any direct billing-status change.
-- Staff-specific actions (defer/activate/perform) are also recorded by their
-- server actions with the authenticated staff ID.
-- ---------------------------------------------------------------------------
create or replace function public.audit_lab_item_billing_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'laboratory.item_ordered';
  elsif new.billing_status is distinct from old.billing_status then
    v_action := case new.billing_status
      when 'authorized' then 'laboratory.item_authorized'
      when 'deferred' then 'laboratory.item_deferred'
      when 'paid' then 'laboratory.item_paid'
      when 'cancelled' then 'laboratory.item_cancelled'
      else 'laboratory.item_billing_status_changed'
    end;
  else
    return new;
  end if;

  insert into public.audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    new.clinic_id,
    null,
    v_action,
    'lab_order_item',
    new.id,
    jsonb_build_object(
      'billing_mode', new.billing_mode,
      'billing_status', new.billing_status,
      'authorization_status', new.authorization_status,
      'service_charge_id', new.service_charge_id,
      'lab_order_id', new.lab_order_id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_audit_lab_item_billing_transition on public.lab_order_items;
create trigger trg_audit_lab_item_billing_transition
after insert or update of billing_status on public.lab_order_items
for each row execute function public.audit_lab_item_billing_transition();

-- ---------------------------------------------------------------------------
-- Replace the UI helper so changing billing mode is financially correct.
-- pay_now on an already-deferred item creates no charge here; activation is
-- the operation responsible for creating exactly one service charge.
-- ---------------------------------------------------------------------------
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
  v_status text;
  v_current_billing text;
  v_role staff_role;
  v_staff_id uuid := auth.uid();
begin
  if p_billing_mode not in ('pay_now','charge_to_encounter','deferred') then
    raise exception 'Invalid laboratory billing mode';
  end if;

  select lo.clinic_id, loi.status::text, loi.billing_status
    into v_clinic_id, v_status, v_current_billing
  from public.lab_order_items loi
  join public.lab_orders lo on lo.id = loi.lab_order_id
  where loi.id = p_lab_order_item_id
  for update;

  if v_clinic_id is null then
    raise exception 'Laboratory order item not found';
  end if;

  select coalesce(active_role, role)
    into v_role
  from public.staff
  where id = v_staff_id and clinic_id = v_clinic_id and is_active;

  if v_role not in ('admin','receptionist','billing_clerk','doctor') then
    raise exception 'Staff role is not authorized to change laboratory billing mode';
  end if;

  if v_status <> 'pending' then
    raise exception 'Only a pending laboratory item can change billing mode';
  end if;

  if v_current_billing = 'paid' or v_current_billing = 'authorized' then
    raise exception 'Paid or authorized laboratory items cannot be changed to another billing mode';
  end if;

  if p_billing_mode = 'deferred' then
    update public.lab_order_items
    set billing_mode = 'deferred',
        billing_status = 'deferred',
        authorization_status = 'deferred',
        deferred_reason = nullif(trim(coalesce(p_reason,'')), ''),
        deferred_at = now()
    where id = p_lab_order_item_id;
  elsif p_billing_mode = 'charge_to_encounter' then
    update public.lab_order_items
    set billing_mode = 'charge_to_encounter',
        billing_status = 'authorized',
        authorization_status = 'authorized',
        deferred_reason = null,
        deferred_at = null
    where id = p_lab_order_item_id;
  else
    raise exception 'Use activate_deferred_lab_order_item to reactivate a deferred item for payment';
  end if;

  insert into public.audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    v_clinic_id, v_staff_id,
    case when p_billing_mode = 'deferred' then 'laboratory.item_deferred' else 'laboratory.item_authorized' end,
    'lab_order_item', p_lab_order_item_id,
    jsonb_build_object('billing_mode', p_billing_mode, 'reason', p_reason)
  );
end;
$$;

grant execute on function public.set_lab_order_item_billing_mode(uuid,text,text) to authenticated;

comment on column public.lab_order_items.billing_status is
  'Canonical laboratory financial readiness: pending_payment, authorized, paid, deferred, cancelled';
comment on column public.lab_order_items.billing_mode is
  'Requested financial mode: pay_now, charge_to_encounter, deferred';
comment on column public.lab_order_items.authorization_status is
  'Laboratory authorization state, separate from payment state';
