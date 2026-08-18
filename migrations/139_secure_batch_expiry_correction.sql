-- ============================================================================
-- MIGRATION 139: SECURE BATCH EXPIRY DATE CORRECTION
--
-- Purpose:
--   Correct an expiry date that was entered incorrectly during stock receipt
--   without changing quantity, stock movements, or batch status.
--
-- Security:
--   - Caller must be an active staff member in the batch's clinic.
--   - Only staff whose active_role/role is `admin` may make the correction.
--   - A non-empty reason is mandatory.
--   - The batch must belong to the same clinic as the staff member.
--   - Every correction is written to audit_log with old/new expiry dates.
--
-- This function intentionally does NOT create a stock movement because an
-- expiry-date correction is metadata correction, not a stock quantity change.
-- ============================================================================

create or replace function public.correct_batch_expiry_date(
  p_batch_id uuid,
  p_new_expiry_date date,
  p_corrected_by uuid,
  p_reason text
)
returns date
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_product_id uuid;
  v_product_name text;
  v_batch_number text;
  v_old_expiry_date date;
  v_batch_status text;
  v_staff_role staff_role;
  v_reason text;
begin
  -- ========================================================================
  -- BASIC INPUT VALIDATION
  -- ========================================================================

  if p_batch_id is null then
    raise exception using message = 'Batch ID is required';
  end if;

  if p_corrected_by is null then
    raise exception using message = 'The correcting staff member is required';
  end if;

  if p_new_expiry_date is null then
    raise exception using message = 'A new expiry date is required';
  end if;

  v_reason := trim(coalesce(p_reason, ''));

  if v_reason = '' then
    raise exception using message =
      'A reason is required when correcting a batch expiry date';
  end if;

  -- Prevent obviously invalid dates from being entered.
  if p_new_expiry_date < date '2000-01-01' then
    raise exception using message = 'The new expiry date is not valid';
  end if;

  -- ========================================================================
  -- LOAD BATCH AND CLINIC OWNERSHIP
  -- ========================================================================

  select
    b.clinic_id,
    b.product_id,
    p.name,
    b.batch_number,
    b.expiry_date,
    b.status::text
  into
    v_clinic_id,
    v_product_id,
    v_product_name,
    v_batch_number,
    v_old_expiry_date,
    v_batch_status
  from batches b
  join products p on p.id = b.product_id
  where b.id = p_batch_id
  for update of b;

  if v_clinic_id is null then
    raise exception using message =
      'Batch not found';
  end if;

  -- ========================================================================
  -- AUTHORIZE THE CHANGE
  -- ========================================================================

  select coalesce(active_role, role)
    into v_staff_role
  from staff
  where id = p_corrected_by
    and clinic_id = v_clinic_id
    and is_active = true;

  if v_staff_role is null then
    raise exception using message =
      'The correcting staff member is not active in this clinic';
  end if;

  if v_staff_role <> 'admin' then
    raise exception using message =
      'Only an admin can correct a batch expiry date';
  end if;

  -- ========================================================================
  -- NO-OP PROTECTION
  -- ========================================================================

  if v_old_expiry_date = p_new_expiry_date then
    raise exception using message =
      'The new expiry date is the same as the current expiry date';
  end if;

  -- ========================================================================
  -- APPLY METADATA CORRECTION
  -- ========================================================================

  update batches
  set expiry_date = p_new_expiry_date
  where id = p_batch_id;

  -- ========================================================================
  -- AUDIT TRAIL
  -- ========================================================================

  insert into audit_log (
    clinic_id,
    staff_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    v_clinic_id,
    p_corrected_by,
    'pharmacy.batch_expiry_corrected',
    'batch',
    p_batch_id,
    jsonb_build_object(
      'batch_id', p_batch_id,
      'batch_number', v_batch_number,
      'product_id', v_product_id,
      'product_name', v_product_name,
      'old_expiry_date', v_old_expiry_date,
      'new_expiry_date', p_new_expiry_date,
      'batch_status', v_batch_status,
      'reason', v_reason
    )
  );

  return p_new_expiry_date;
end;
$$;

comment on function public.correct_batch_expiry_date(uuid, date, uuid, text)
is 'Admin-only correction of a pharmacy batch expiry date with mandatory reason and audit trail; does not alter stock quantity or stock movements.';
