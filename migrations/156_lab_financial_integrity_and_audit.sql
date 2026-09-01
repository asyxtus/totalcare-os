-- ============================================================================
-- MIGRATION 156: LABORATORY FINANCIAL INTEGRITY + AUDIT TRAIL
--
-- Principles enforced by this migration:
--   1. Ordering an investigation is not the same as charging for it.
--   2. Authorization is not payment.
--   3. The laboratory may work only paid or explicitly authorized items.
--   4. Performing an investigation never creates a second financial charge.
--   5. Deferred investigations acquire a charge exactly once when activated.
--   6. Every material laboratory financial/clinical transition is auditable.
--
-- Existing migrations 153-155 already introduced the billing_status state
-- machine and the single-item billing helpers. This migration hardens the
-- boundary around those primitives rather than creating a second workflow.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Useful index for the laboratory work queue.
-- ----------------------------------------------------------------------------
create index if not exists idx_lab_order_items_work_queue
  on public.lab_order_items (clinic_id, billing_status, status, created_at);

create index if not exists idx_lab_order_items_service_charge
  on public.lab_order_items (service_charge_id)
  where service_charge_id is not null;

-- ----------------------------------------------------------------------------
-- 2. Authoritative work-queue view.
--
-- The UI should consume this view (or reproduce the same predicates): only
-- paid and authorized items are eligible for laboratory work. Deferred and
-- pending-payment items remain visible to billing/reception, but not here.
--
-- IMPORTANT: lab_order_item_status is an enum defined by migration 37 as:
--   pending, sample_collected, completed, cancelled
-- There is NO 'processing' enum value. sample_collected is the in-progress
-- state and is therefore used below wherever an active/processing state is
-- required.
-- ----------------------------------------------------------------------------
create or replace view public.laboratory_work_queue as
select
  loi.id as item_id,
  loi.lab_order_id,
  loi.clinic_id,
  loi.item_type,
  loi.status as item_status,
  loi.billing_status,
  loi.service_charge_id,
  loi.lab_panel_id,
  loi.lab_test_catalog_id,
  loi.external_test_name,
  loi.created_at,
  lo.visit_id,
  lo.ordered_at,
  lo.ordered_by,
  v.patient_id,
  p.full_name as patient_name,
  p.patient_code
from public.lab_order_items loi
join public.lab_orders lo on lo.id = loi.lab_order_id
join public.visits v on v.id = lo.visit_id
join public.patients p on p.id = v.patient_id
where loi.billing_status in ('paid', 'authorized')
  and loi.status not in ('completed', 'cancelled');

-- ----------------------------------------------------------------------------
-- 3. Authorize an already-ordered investigation without creating a charge.
--
-- This is deliberately different from activation. It is useful for an
-- emergency/admission where clinical authorization already exists and the
-- encounter will carry the financial liability. The caller must therefore
-- provide the authorization explicitly. No payment row is fabricated.
-- ----------------------------------------------------------------------------
create or replace function public.authorize_lab_order_item(
  p_lab_order_item_id uuid,
  p_staff_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_role text;
begin
  select
    loi.id,
    loi.clinic_id,
    loi.billing_status,
    loi.service_charge_id,
    lo.visit_id,
    v.is_emergency,
    v.patient_id
  into v_item
  from lab_order_items loi
  join lab_orders lo on lo.id = loi.lab_order_id
  join visits v on v.id = lo.visit_id
  where loi.id = p_lab_order_item_id
  for update;

  if v_item.id is null then
    raise exception 'Laboratory item not found';
  end if;

  if not exists (
    select 1 from staff
    where id = p_staff_id
      and clinic_id = v_item.clinic_id
      and is_active = true
  ) then
    raise exception 'Authorizing staff member is not active in this clinic';
  end if;

  select coalesce(active_role, role)::text into v_role
  from staff
  where id = p_staff_id;

  if v_role not in ('admin','doctor','nurse','lab_technician','receptionist','billing_clerk') then
    raise exception 'Staff role is not authorized to authorize laboratory work';
  end if;

  if v_item.billing_status = 'paid' then
    return;
  end if;

  if v_item.billing_status = 'cancelled' then
    raise exception 'Cancelled laboratory item cannot be authorized';
  end if;

  -- Authorization must never manufacture a charge. For encounter-authorized
  -- work the charge should already exist from create_lab_order(...,
  -- charge_to_encounter). If it does not, this is a financial-integrity error.
  if v_item.service_charge_id is null then
    raise exception 'Cannot authorize laboratory item without its encounter charge';
  end if;

  update lab_order_items
  set billing_status = 'authorized'
  where id = p_lab_order_item_id
    and billing_status <> 'paid';

  insert into audit_log (
    clinic_id, staff_id, action, entity_type, entity_id, details
  ) values (
    v_item.clinic_id,
    p_staff_id,
    'laboratory.item_authorized',
    'lab_order_item',
    p_lab_order_item_id,
    jsonb_build_object(
      'reason', p_reason,
      'visit_id', v_item.visit_id,
      'patient_id', v_item.patient_id,
      'emergency', v_item.is_emergency,
      'service_charge_id', v_item.service_charge_id
    )
  );
end;
$$;

revoke all on function public.authorize_lab_order_item(uuid, uuid, text) from public;
grant execute on function public.authorize_lab_order_item(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Bulk activation for reception/billing.
--
-- Activation delegates to the existing atomic single-item helper from
-- migration 153. That helper is responsible for creating the financial
-- charge exactly once. This wrapper only validates the batch and returns the
-- activated item IDs; it never inserts service_charges itself.
-- ----------------------------------------------------------------------------
create or replace function public.activate_deferred_lab_order_items(
  p_lab_order_item_ids uuid[],
  p_staff_id uuid,
  p_billing_mode text default 'pay_now'
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_result uuid[] := '{}';
  v_clinic_id uuid;
  v_role text;
  v_status text;
begin
  if p_lab_order_item_ids is null or coalesce(array_length(p_lab_order_item_ids, 1), 0) = 0 then
    raise exception 'No laboratory items supplied for activation';
  end if;

  if p_billing_mode not in ('pay_now','charge_to_encounter') then
    raise exception 'Invalid activation billing mode';
  end if;

  select clinic_id, coalesce(active_role, role)::text
  into v_clinic_id, v_role
  from staff
  where id = p_staff_id and is_active = true;

  if v_clinic_id is null then
    raise exception 'Activation staff member not found or inactive';
  end if;

  if v_role not in ('admin','receptionist','billing_clerk','doctor','nurse') then
    raise exception 'Staff role is not authorized to activate laboratory billing';
  end if;

  foreach v_id in array p_lab_order_item_ids loop
    select loi.billing_status into v_status
    from lab_order_items loi
    where loi.id = v_id and loi.clinic_id = v_clinic_id
    for update;

    if v_status is null then
      raise exception 'Laboratory item % not found in this clinic', v_id;
    end if;

    if v_status = 'deferred' then
      perform public.activate_deferred_lab_order_item(v_id, p_staff_id, p_billing_mode);

      insert into audit_log (
        clinic_id, staff_id, action, entity_type, entity_id, details
      ) values (
        v_clinic_id,
        p_staff_id,
        'laboratory.item_activated',
        'lab_order_item',
        v_id,
        jsonb_build_object('billing_mode', p_billing_mode)
      );

      v_result := array_append(v_result, v_id);
    elsif v_status in ('paid','authorized') then
      -- Idempotent: already financially ready. Never create a duplicate charge.
      v_result := array_append(v_result, v_id);
    else
      raise exception 'Laboratory item % is not deferred and cannot be activated (status: %)', v_id, v_status;
    end if;
  end loop;

  return v_result;
end;
$$;

revoke all on function public.activate_deferred_lab_order_items(uuid[], uuid, text) from public;
grant execute on function public.activate_deferred_lab_order_items(uuid[], uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Audit material laboratory state transitions.
--
-- auth.uid() identifies the authenticated staff member making the mutation.
-- Existing dedicated RPCs also write richer audit records; this trigger is a
-- safety net so direct/legacy mutations cannot silently change financial
-- readiness without an audit event.
-- ----------------------------------------------------------------------------
create or replace function public.audit_lab_order_item_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_action text;
  v_details jsonb;
begin
  v_staff_id := auth.uid();

  if tg_op = 'INSERT' then
    v_action := 'laboratory.item_ordered';
    v_details := jsonb_build_object(
      'billing_status', new.billing_status,
      'service_charge_id', new.service_charge_id,
      'item_type', new.item_type,
      'lab_order_id', new.lab_order_id
    );
  elsif old.billing_status is distinct from new.billing_status then
    v_action := case new.billing_status
      when 'authorized' then 'laboratory.item_authorized'
      when 'paid' then 'laboratory.item_paid'
      when 'deferred' then 'laboratory.item_deferred'
      when 'cancelled' then 'laboratory.item_cancelled'
      else 'laboratory.item_billing_status_changed'
    end;
    v_details := jsonb_build_object(
      'from', old.billing_status,
      'to', new.billing_status,
      'service_charge_id', new.service_charge_id
    );
  elsif old.status is distinct from new.status and new.status = 'completed' then
    v_action := 'laboratory.item_performed';
    v_details := jsonb_build_object(
      'from_status', old.status,
      'to_status', new.status,
      'billing_status', new.billing_status
    );
  else
    return new;
  end if;

  insert into audit_log (
    clinic_id, staff_id, action, entity_type, entity_id, details
  ) values (
    new.clinic_id,
    v_staff_id,
    v_action,
    'lab_order_item',
    new.id,
    v_details
  );

  return new;
exception when others then
  -- Audit must never break a clinical transaction. Dedicated RPC audit rows
  -- remain authoritative where present; this trigger is supplementary.
  return new;
end;
$$;

drop trigger if exists trg_lab_order_item_financial_audit on public.lab_order_items;
create trigger trg_lab_order_item_financial_audit
after insert or update of billing_status, status on public.lab_order_items
for each row execute function public.audit_lab_order_item_transition();

-- ----------------------------------------------------------------------------
-- 6. Prevent a laboratory item from entering an active/finished clinical
-- state unless it was financially ready.
--
-- The existing enum has no 'processing' value. Its active/in-progress state
-- is 'sample_collected', so both sample collection and completion are gated.
-- ----------------------------------------------------------------------------
create or replace function public.guard_lab_item_financial_readiness()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('sample_collected','completed')
     and new.billing_status not in ('paid','authorized') then
    raise exception 'Laboratory item is not financially authorized: billing status %', new.billing_status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lab_item_financial_readiness on public.lab_order_items;
create trigger trg_lab_item_financial_readiness
before update of status on public.lab_order_items
for each row execute function public.guard_lab_item_financial_readiness();

-- ----------------------------------------------------------------------------
-- 7. Integrity helper for administrators/monitoring.
-- Returns items that should be investigated because their clinical and
-- financial states disagree.
-- ----------------------------------------------------------------------------
create or replace function public.lab_financial_integrity_exceptions(p_clinic_id uuid)
returns table (
  item_id uuid,
  lab_order_id uuid,
  item_status text,
  billing_status text,
  service_charge_id uuid,
  exception_code text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    loi.id,
    loi.lab_order_id,
    loi.status::text,
    loi.billing_status::text,
    loi.service_charge_id,
    case
      when loi.status in ('sample_collected','completed')
       and loi.billing_status not in ('paid','authorized')
        then 'CLINICAL_WORK_WITHOUT_FINANCIAL_AUTHORIZATION'
      when loi.billing_status = 'authorized'
       and loi.service_charge_id is null
        then 'AUTHORIZED_WITHOUT_CHARGE'
      when loi.billing_status in ('paid','authorized')
       and loi.service_charge_id is null
        then 'FINANCIALLY_READY_WITHOUT_CHARGE'
      else 'UNKNOWN'
    end
  from lab_order_items loi
  where loi.clinic_id = p_clinic_id
    and (
      (loi.status in ('sample_collected','completed') and loi.billing_status not in ('paid','authorized'))
      or (loi.billing_status in ('paid','authorized') and loi.service_charge_id is null)
    );
$$;

revoke all on function public.lab_financial_integrity_exceptions(uuid) from public;
grant execute on function public.lab_financial_integrity_exceptions(uuid) to authenticated;

comment on view public.laboratory_work_queue is
  'Authoritative laboratory work queue: only paid or explicitly authorized investigations, never deferred or pending-payment items.';

comment on function public.activate_deferred_lab_order_items(uuid[], uuid, text) is
  'Idempotently activates deferred laboratory items; financial charges are created exactly once by activate_deferred_lab_order_item.';

comment on function public.lab_financial_integrity_exceptions(uuid) is
  'Detects laboratory items whose clinical status and financial authorization disagree.';
