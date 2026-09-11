-- 177_offline_triage_idempotency.sql
-- Atomic, retry-safe triage capture for the offline outbox.
-- Vitals + nursing assessment + priority + safe completion live in one transaction.

create or replace function public.save_triage_idempotent(
  p_operation_id uuid,
  p_clinic_id uuid,
  p_staff_id uuid,
  p_visit_id uuid,
  p_systolic_bp numeric default null,
  p_diastolic_bp numeric default null,
  p_pulse numeric default null,
  p_temperature numeric default null,
  p_spo2 numeric default null,
  p_respiratory_rate numeric default null,
  p_weight_kg numeric default null,
  p_height_cm numeric default null,
  p_chief_complaint text default null,
  p_medical_history text default null,
  p_social_history text default null,
  p_triage_priority text default 'routine',
  p_priority_note text default null
)
returns table (
  saved boolean,
  completed boolean,
  requires_review boolean,
  flags jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saved record;
  v_flags jsonb := '[]'::jsonb;
  v_has_critical boolean := false;
  v_completed boolean := false;
begin
  if p_operation_id is null then
    raise exception 'Operation ID is required';
  end if;

  if not exists (
    select 1 from public.staff s
    where s.id = p_staff_id
      and s.clinic_id = p_clinic_id
      and s.auth_user_id = auth.uid()
      and s.is_active = true
      and s.role in ('nurse', 'admin')
  ) then
    raise exception 'Staff authorization failed';
  end if;

  select * into v_saved
  from public.offline_mutation_idempotency
  where clinic_id = p_clinic_id
    and operation_id = p_operation_id
  for update;

  if found then
    if v_saved.operation_type <> 'triage_capture' then
      raise exception 'Operation ID is already used for another operation';
    end if;

    return query
    select
      true,
      coalesce((v_saved.response->>'completed')::boolean, false),
      coalesce((v_saved.response->>'requires_review')::boolean, false),
      coalesce(v_saved.response->'flags', '[]'::jsonb),
      true;
    return;
  end if;

  if not exists (
    select 1 from public.visits v
    where v.id = p_visit_id
      and v.clinic_id = p_clinic_id
      and v.status = 'triage'
  ) then
    raise exception 'Visit is invalid, already triaged, or belongs to another clinic';
  end if;

  if p_triage_priority not in ('routine', 'urgent', 'critical') then
    raise exception 'Invalid triage priority';
  end if;

  -- Reject malformed measurements before writing anything. The ranges are
  -- deliberately broad enough to accept genuinely abnormal clinical values,
  -- while excluding impossible/garbled input that should never be retried.
  if p_systolic_bp is not null and (p_systolic_bp < 30 or p_systolic_bp > 350) then raise exception 'Invalid systolic blood pressure'; end if;
  if p_diastolic_bp is not null and (p_diastolic_bp < 20 or p_diastolic_bp > 250) then raise exception 'Invalid diastolic blood pressure'; end if;
  if p_pulse is not null and (p_pulse < 10 or p_pulse > 300) then raise exception 'Invalid pulse'; end if;
  if p_temperature is not null and (p_temperature < 20 or p_temperature > 50) then raise exception 'Invalid temperature'; end if;
  if p_spo2 is not null and (p_spo2 < 1 or p_spo2 > 100) then raise exception 'Invalid oxygen saturation'; end if;
  if p_respiratory_rate is not null and (p_respiratory_rate < 1 or p_respiratory_rate > 150) then raise exception 'Invalid respiratory rate'; end if;
  if p_weight_kg is not null and (p_weight_kg <= 0 or p_weight_kg > 1000) then raise exception 'Invalid weight'; end if;
  if p_height_cm is not null and (p_height_cm <= 0 or p_height_cm > 300) then raise exception 'Invalid height'; end if;

  insert into public.offline_mutation_idempotency (
    clinic_id, operation_id, operation_type, staff_id, status, response
  ) values (
    p_clinic_id, p_operation_id, 'triage_capture', p_staff_id,
    'completed', '{}'::jsonb
  );

  insert into public.vitals (
    clinic_id, visit_id, recorded_by, systolic_bp, diastolic_bp, pulse,
    temperature, spo2, respiratory_rate, weight_kg, height_cm
  ) values (
    p_clinic_id, p_visit_id, p_staff_id, p_systolic_bp, p_diastolic_bp,
    p_pulse, p_temperature, p_spo2, p_respiratory_rate, p_weight_kg, p_height_cm
  ) returning flags into v_flags;

  v_flags := coalesce(v_flags, '[]'::jsonb);
  v_has_critical := exists (
    select 1
    from jsonb_array_elements(v_flags) f
    where f->>'severity' = 'critical'
  );

  update public.visits
  set triage_priority = p_triage_priority,
      priority_note = nullif(trim(p_priority_note), ''),
      priority_flagged_by = p_staff_id,
      priority_flagged_at = now()
  where id = p_visit_id and clinic_id = p_clinic_id;

  insert into public.triage_assessments (
    clinic_id, visit_id, recorded_by, chief_complaint, medical_history, social_history
  ) values (
    p_clinic_id, p_visit_id, p_staff_id,
    nullif(trim(p_chief_complaint), ''),
    nullif(trim(p_medical_history), ''),
    nullif(trim(p_social_history), '')
  );

  -- Critical values remain in the triage queue so the nurse can review them
  -- before the visit advances. Non-critical captures complete automatically.
  if not v_has_critical then
    perform public.complete_triage(p_visit_id, p_staff_id);
    v_completed := true;
  end if;

  update public.offline_mutation_idempotency
  set response = jsonb_build_object(
        'completed', v_completed,
        'requires_review', v_has_critical,
        'flags', v_flags
      ),
      updated_at = now()
  where clinic_id = p_clinic_id and operation_id = p_operation_id;

  return query
  select true, v_completed, v_has_critical, v_flags, false;
end;
$$;

revoke all on function public.save_triage_idempotent(
  uuid, uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, text, text, text, text, text
) from public;
grant execute on function public.save_triage_idempotent(
  uuid, uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, text, text, text, text, text
) to authenticated;
