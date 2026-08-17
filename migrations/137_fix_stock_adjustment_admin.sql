-- ============================================================================
-- 137: Fix stock adjustment authorization and execution
--
-- Admins and pharmacists must be able to correct physical stock counts.
-- The previous adjustment path could fail because record_stock_movement()
-- ultimately writes to stock_movements under the caller's RLS context.
--
-- This function performs its own clinic + role validation, then executes the
-- stock movement as SECURITY DEFINER. It never trusts a client-supplied clinic
-- or staff identity without verifying both against the staff table.
-- ============================================================================

create or replace function public.record_stock_adjustment(
  p_clinic_id uuid,
  p_batch_id uuid,
  p_quantity integer,
  p_direction text,
  p_reason text,
  p_staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_staff_clinic_id uuid;
  v_staff_role text;
  v_batch_clinic_id uuid;
  v_current_qty integer;
  v_movement_type stock_movement_type;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_direction not in ('increase', 'decrease') then
    raise exception 'Invalid adjustment direction: %', p_direction;
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required for stock adjustment';
  end if;

  -- Verify the staff member really belongs to the requested clinic and is active.
  select s.clinic_id, coalesce(s.active_role, s.role)::text
    into v_staff_clinic_id, v_staff_role
  from staff s
  where s.id = p_staff_id
    and s.is_active = true;

  if v_staff_clinic_id is null then
    raise exception 'Staff member is not active or does not exist';
  end if;

  if v_staff_clinic_id <> p_clinic_id then
    raise exception 'Staff member does not belong to this clinic';
  end if;

  if v_staff_role not in ('admin', 'pharmacist') then
    raise exception 'Only an admin or pharmacist can adjust stock';
  end if;

  -- Lock the batch while calculating the current quantity so two adjustments
  -- cannot race against each other.
  select p.clinic_id, batch_quantity_on_hand(b.id)
    into v_batch_clinic_id, v_current_qty
  from batches b
  join products p on p.id = b.product_id
  where b.id = p_batch_id
  for update of b;

  if v_batch_clinic_id is null then
    raise exception 'Batch not found';
  end if;

  if v_batch_clinic_id <> p_clinic_id then
    raise exception 'Batch does not belong to this clinic';
  end if;

  if p_direction = 'decrease' then
    if p_quantity > coalesce(v_current_qty, 0) then
      raise exception 'Cannot decrease stock by %: only % units are currently available',
        p_quantity, coalesce(v_current_qty, 0);
    end if;
    v_movement_type := 'adjustment';
  else
    v_movement_type := 'adjustment_increase';
  end if;

  -- SECURITY DEFINER lets the audited server-side operation write the stock
  -- ledger without weakening the table's RLS policies for ordinary clients.
  perform record_stock_movement(
    p_batch_id,
    v_movement_type,
    p_quantity,
    'stock_adjustment',
    p_batch_id,
    trim(p_reason),
    p_staff_id,
    null
  );

  -- Keep an explicit audit record in addition to the immutable stock ledger.
  insert into audit_log (
    clinic_id,
    staff_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    p_clinic_id,
    p_staff_id,
    case when p_direction = 'increase'
      then 'pharmacy.stock_adjustment_increase'
      else 'pharmacy.stock_adjustment_decrease'
    end,
    'batch',
    p_batch_id,
    jsonb_build_object(
      'quantity', p_quantity,
      'direction', p_direction,
      'reason', trim(p_reason),
      'previous_quantity', coalesce(v_current_qty, 0),
      'new_quantity', case when p_direction = 'increase'
        then coalesce(v_current_qty, 0) + p_quantity
        else coalesce(v_current_qty, 0) - p_quantity
      end
    )
  );
end;
$function$;

revoke all on function public.record_stock_adjustment(uuid, uuid, integer, text, text, uuid) from public;
grant execute on function public.record_stock_adjustment(uuid, uuid, integer, text, text, uuid) to authenticated;
