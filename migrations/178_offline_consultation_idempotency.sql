-- 178_offline_consultation_idempotency.sql
-- Atomic, retry-safe completion of the core clinical consultation note.
-- Offline consultation intentionally covers SOAP + diagnoses + consultation completion.
-- Prescriptions, laboratory orders, procedures and admissions remain separate online
-- workflows because they have independent billing/stock side effects.

create or replace function public.complete_consultation_idempotent(
  p_operation_id uuid,
  p_clinic_id uuid,
  p_staff_id uuid,
  p_visit_id uuid,
  p_consultation_id uuid,
  p_subjective_notes text default null,
  p_examination_notes text default null,
  p_treatment_plan text default null,
  p_diagnoses jsonb default '[]'::jsonb
)
returns table (
  saved boolean,
  completed boolean,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saved record;
  v_consultation record;
  v_visit record;
  v_diagnoses jsonb := coalesce(p_diagnoses, '[]'::jsonb);
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
      and s.role in ('doctor', 'admin')
  ) then
    raise exception 'Staff authorization failed';
  end if;

  select * into v_saved
  from public.offline_mutation_idempotency
  where clinic_id = p_clinic_id
    and operation_id = p_operation_id
  for update;

  if found then
    if v_saved.operation_type <> 'consultation-completion' then
      raise exception 'Operation ID is already used for another operation';
    end if;
    return query select true, true, true;
    return;
  end if;

  select v.* into v_visit
  from public.visits v
  where v.id = p_visit_id
    and v.clinic_id = p_clinic_id
  for update;

  if not found then
    raise exception 'Visit is invalid or belongs to another clinic';
  end if;

  if v_visit.status <> 'in_consultation' then
    raise exception 'Consultation is no longer active';
  end if;

  select c.* into v_consultation
  from public.consultations c
  where c.id = p_consultation_id
    and c.visit_id = p_visit_id
    and c.clinic_id = p_clinic_id
  for update;

  if not found then
    raise exception 'Consultation is invalid or belongs to another clinic';
  end if;

  if v_consultation.doctor_id <> p_staff_id and not exists (
    select 1 from public.staff s
    where s.id = p_staff_id and s.role = 'admin'
  ) then
    raise exception 'Consultation is assigned to another doctor';
  end if;

  if jsonb_typeof(v_diagnoses) <> 'array' then
    raise exception 'Invalid diagnoses data';
  end if;

  insert into public.offline_mutation_idempotency (
    clinic_id, operation_id, operation_type, staff_id, status, response
  ) values (
    p_clinic_id, p_operation_id, 'consultation-completion', p_staff_id,
    'completed', '{}'::jsonb
  );

  -- Reuse the existing server-side business rules for diagnosis/note storage
  -- and completion, keeping the whole offline replay atomic in this transaction.
  perform public.save_consultation_diagnoses(
    p_clinic_id,
    p_consultation_id,
    p_staff_id,
    nullif(trim(p_subjective_notes), ''),
    nullif(trim(p_examination_notes), ''),
    nullif(trim(p_treatment_plan), ''),
    v_diagnoses
  );

  perform public.complete_consultation(
    p_visit_id,
    p_consultation_id,
    p_staff_id,
    false,
    false,
    false
  );

  update public.offline_mutation_idempotency
  set response = jsonb_build_object('completed', true),
      updated_at = now()
  where clinic_id = p_clinic_id and operation_id = p_operation_id;

  return query select true, true, false;
end;
$$;

revoke all on function public.complete_consultation_idempotent(
  uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb
) from public;
grant execute on function public.complete_consultation_idempotent(
  uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb
) to authenticated;
