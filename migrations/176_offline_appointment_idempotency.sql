-- 176_offline_appointment_idempotency.sql
-- Atomic, retry-safe appointment booking for the offline outbox.

create or replace function public.book_appointment_idempotent(
  p_operation_id uuid,
  p_clinic_id uuid,
  p_staff_id uuid,
  p_patient_id uuid,
  p_doctor_id uuid default null,
  p_service_price_id uuid default null,
  p_scheduled_at timestamptz default null,
  p_duration_minutes integer default 30,
  p_reason text default null
)
returns table (
  appointment_id uuid,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_clinic uuid;
  v_saved record;
  v_appointment_id uuid;
  v_duration integer;
begin
  if p_operation_id is null then
    raise exception 'Operation ID is required';
  end if;

  select s.clinic_id into v_staff_clinic
  from public.staff s
  where s.id = p_staff_id
    and s.clinic_id = p_clinic_id
    and s.auth_user_id = auth.uid()
    and s.is_active = true
  limit 1;

  if not found then
    raise exception 'Staff authorization failed';
  end if;

  -- The insert is intentionally before the appointment write. If two tabs
  -- retry the same operation concurrently, the unique key makes the second
  -- insert wait for the first transaction and then observe its completed row.
  insert into public.offline_mutation_idempotency (
    clinic_id, operation_id, operation_type, staff_id, status, response
  ) values (
    p_clinic_id, p_operation_id, 'appointment_booking', p_staff_id,
    'completed', '{}'::jsonb
  ) on conflict (clinic_id, operation_id) do nothing;

  select * into v_saved
  from public.offline_mutation_idempotency
  where clinic_id = p_clinic_id
    and operation_id = p_operation_id
  for update;

  if v_saved.operation_type <> 'appointment_booking' then
    raise exception 'Operation ID is already used for another operation';
  end if;

  if v_saved.patient_id is not null then
    return query select v_saved.patient_id, true;
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = p_patient_id and p.clinic_id = p_clinic_id
  ) then
    raise exception 'Patient does not belong to this clinic';
  end if;

  if p_doctor_id is not null and not exists (
    select 1 from public.staff s
    where s.id = p_doctor_id and s.clinic_id = p_clinic_id and s.is_active = true
  ) then
    raise exception 'Invalid doctor';
  end if;

  if p_service_price_id is not null and not exists (
    select 1 from public.service_prices sp
    where sp.id = p_service_price_id and sp.clinic_id = p_clinic_id and sp.is_active = true
  ) then
    raise exception 'Invalid consultation type';
  end if;

  if p_scheduled_at is null then
    raise exception 'Date and time are required';
  end if;

  v_duration := case when coalesce(p_duration_minutes, 0) > 0 then p_duration_minutes else 30 end;

  insert into public.appointments (
    clinic_id, patient_id, doctor_id, service_price_id, scheduled_at,
    duration_minutes, reason, created_by
  ) values (
    p_clinic_id, p_patient_id, p_doctor_id, p_service_price_id, p_scheduled_at,
    v_duration, nullif(trim(p_reason), ''), p_staff_id
  ) returning id into v_appointment_id;

  update public.offline_mutation_idempotency
  set patient_id = v_appointment_id,
      response = jsonb_build_object('appointment_id', v_appointment_id),
      updated_at = now()
  where clinic_id = p_clinic_id and operation_id = p_operation_id;

  return query select v_appointment_id, false;
end;
$$;

revoke all on function public.book_appointment_idempotent(
  uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, integer, text
) from public;
grant execute on function public.book_appointment_idempotent(
  uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, integer, text
) to authenticated;
