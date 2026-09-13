-- 180_offline_lab_order_idempotency.sql
-- Retry-safe laboratory ordering for prepared offline consultations.
-- Clinical ordering is separated from specimen collection/results.
-- The server re-validates clinic, staff authorization, visit state, catalog
-- availability, and emergency billing rules when the order synchronizes.

create or replace function public.create_lab_order_idempotent(
  p_operation_id uuid,
  p_clinic_id uuid,
  p_staff_id uuid,
  p_visit_id uuid,
  p_items jsonb,
  p_billing_mode text default 'pay_now'
)
returns table (
  saved boolean,
  lab_order_id uuid,
  service_charge_ids uuid[],
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saved record;
  v_visit record;
  v_staff record;
  v_order_id uuid;
  v_charge_ids uuid[];
  v_effective_mode text;
  v_result record;
begin
  if p_operation_id is null then
    raise exception 'Operation ID is required';
  end if;

  if p_billing_mode not in ('pay_now','charge_to_encounter','deferred') then
    raise exception 'Invalid laboratory billing mode';
  end if;

  select * into v_staff
  from public.staff s
  where s.id = p_staff_id
    and s.clinic_id = p_clinic_id
    and s.auth_user_id = auth.uid()
    and s.is_active = true;

  if not found or v_staff.role not in ('doctor','admin') then
    raise exception 'Staff authorization failed';
  end if;

  select * into v_saved
  from public.offline_mutation_idempotency
  where clinic_id = p_clinic_id
    and operation_id = p_operation_id
  for update;

  if found then
    if v_saved.operation_type <> 'lab-order' then
      raise exception 'Operation ID is already used for another operation';
    end if;
    return query select
      true,
      (v_saved.response->>'lab_order_id')::uuid,
      coalesce(array(
        select value::uuid from jsonb_array_elements_text(coalesce(v_saved.response->'service_charge_ids','[]'::jsonb))
      ), array[]::uuid[]),
      true;
    return;
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one laboratory investigation is required';
  end if;

  select v.* into v_visit
  from public.visits v
  where v.id = p_visit_id
    and v.clinic_id = p_clinic_id
  for update;

  if not found then
    raise exception 'Visit is invalid or belongs to another clinic';
  end if;

  -- Emergency visits must be executable without waiting for payment.
  v_effective_mode := case
    when coalesce(v_visit.is_emergency, false) then 'charge_to_encounter'
    else p_billing_mode
  end;

  select * into v_result
  from public.create_lab_order(
    p_clinic_id,
    p_visit_id,
    p_staff_id,
    p_items,
    v_effective_mode
  );

  v_order_id := v_result.lab_order_id;
  v_charge_ids := coalesce(v_result.service_charge_ids, array[]::uuid[]);

  insert into public.offline_mutation_idempotency (
    clinic_id, operation_id, operation_type, staff_id, status, response
  ) values (
    p_clinic_id,
    p_operation_id,
    'lab-order',
    p_staff_id,
    'completed',
    jsonb_build_object(
      'lab_order_id', v_order_id,
      'service_charge_ids', to_jsonb(v_charge_ids),
      'billing_mode', v_effective_mode
    )
  );

  return query select true, v_order_id, v_charge_ids, false;
end;
$$;

revoke all on function public.create_lab_order_idempotent(uuid, uuid, uuid, uuid, jsonb, text) from public;
grant execute on function public.create_lab_order_idempotent(uuid, uuid, uuid, uuid, jsonb, text) to authenticated;
