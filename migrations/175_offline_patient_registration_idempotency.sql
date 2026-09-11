-- 175_offline_patient_registration_idempotency.sql
-- Atomic, retry-safe patient registration for the offline outbox.
-- The idempotency row and patient/insurance writes live in the same transaction.

create table if not exists public.offline_mutation_idempotency (
  clinic_id uuid not null,
  operation_id uuid not null,
  operation_type text not null,
  staff_id uuid not null,
  status text not null check (status in ('duplicate_warning', 'completed')),
  patient_id uuid,
  response jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (clinic_id, operation_id)
);

create index if not exists offline_mutation_idempotency_staff_idx
  on public.offline_mutation_idempotency (clinic_id, staff_id, created_at desc);

alter table public.offline_mutation_idempotency enable row level security;

drop policy if exists offline_mutation_idempotency_staff_select
  on public.offline_mutation_idempotency;
create policy offline_mutation_idempotency_staff_select
  on public.offline_mutation_idempotency
  for select to authenticated
  using (
    exists (
      select 1 from public.staff s
      where s.id = offline_mutation_idempotency.staff_id
        and s.clinic_id = offline_mutation_idempotency.clinic_id
        and s.auth_user_id = auth.uid()
        and s.is_active = true
    )
  );

create or replace function public.register_patient_idempotent(
  p_operation_id uuid,
  p_clinic_id uuid,
  p_staff_id uuid,
  p_full_name text,
  p_sex text,
  p_date_of_birth date,
  p_estimated_age integer,
  p_national_id_number text,
  p_phone text,
  p_quartier text,
  p_city text,
  p_next_of_kin_name text,
  p_next_of_kin_phone text,
  p_allergies text,
  p_chronic_conditions text,
  p_payment_category text,
  p_insurer_id uuid default null,
  p_policy_number text default null,
  p_policyholder_name text default null,
  p_confirm_duplicate boolean default false
)
returns table (
  duplicate_found boolean,
  existing_patient_id uuid,
  existing_full_name text,
  existing_patient_code text,
  new_patient_id uuid,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_staff record;
  v_existing record;
  v_saved record;
  v_response jsonb;
  v_insurance_error text;
begin
  if p_operation_id is null then
    raise exception 'Operation ID is required';
  end if;

  select s.id, s.clinic_id
    into v_auth_staff
  from public.staff s
  where s.id = p_staff_id
    and s.clinic_id = p_clinic_id
    and s.auth_user_id = auth.uid()
    and s.is_active = true
  limit 1;

  if not found then
    raise exception 'Staff authorization failed';
  end if;

  -- Lock an existing operation so concurrent retries cannot both create a patient.
  select * into v_saved
  from public.offline_mutation_idempotency
  where clinic_id = p_clinic_id
    and operation_id = p_operation_id
  for update;

  if found then
    if v_saved.status = 'completed' then
      return query
      select
        coalesce((v_saved.response->>'duplicate_found')::boolean, false),
        nullif(v_saved.response->>'existing_patient_id', '')::uuid,
        nullif(v_saved.response->>'existing_full_name', ''),
        nullif(v_saved.response->>'existing_patient_code', ''),
        v_saved.patient_id,
        true;
      return;
    end if;

    if v_saved.status = 'duplicate_warning' and not p_confirm_duplicate then
      return query
      select
        true,
        nullif(v_saved.response->>'existing_patient_id', '')::uuid,
        v_saved.response->>'existing_full_name',
        v_saved.response->>'existing_patient_code',
        null::uuid,
        true;
      return;
    end if;
  else
    insert into public.offline_mutation_idempotency (
      clinic_id, operation_id, operation_type, staff_id, status, response
    ) values (
      p_clinic_id, p_operation_id, 'patient_registration', p_staff_id,
      'duplicate_warning', '{}'::jsonb
    );
  end if;

  if p_payment_category <> 'cash' then
    if p_insurer_id is null or nullif(trim(p_policy_number), '') is null then
      raise exception 'Insurer and policy number are required for non-cash registration';
    end if;

    if not exists (
      select 1 from public.insurers i
      where i.id = p_insurer_id
        and i.clinic_id = p_clinic_id
        and i.is_active = true
    ) then
      raise exception 'Invalid insurer';
    end if;
  end if;

  -- Preserve the existing duplicate-check business rules and return contract.
  select to_jsonb(r) into v_response
  from public.register_patient_with_duplicate_check(
    p_clinic_id => p_clinic_id,
    p_full_name => p_full_name,
    p_sex => p_sex,
    p_date_of_birth => p_date_of_birth,
    p_estimated_age => p_estimated_age,
    p_national_id_number => p_national_id_number,
    p_phone => p_phone,
    p_quartier => p_quartier,
    p_city => p_city,
    p_next_of_kin_name => p_next_of_kin_name,
    p_next_of_kin_phone => p_next_of_kin_phone,
    p_allergies => p_allergies,
    p_chronic_conditions => p_chronic_conditions,
    p_payment_category => p_payment_category,
    p_created_by => p_staff_id,
    p_confirm_duplicate => p_confirm_duplicate
  ) r;

  if coalesce((v_response->>'duplicate_found')::boolean, false) then
    update public.offline_mutation_idempotency
    set status = 'duplicate_warning',
        response = jsonb_build_object(
          'duplicate_found', true,
          'existing_patient_id', v_response->>'existing_patient_id',
          'existing_full_name', v_response->>'existing_full_name',
          'existing_patient_code', v_response->>'existing_patient_code'
        ),
        updated_at = now()
    where clinic_id = p_clinic_id and operation_id = p_operation_id;

    return query
    select
      true,
      nullif(v_response->>'existing_patient_id', '')::uuid,
      v_response->>'existing_full_name',
      v_response->>'existing_patient_code',
      null::uuid,
      false;
    return;
  end if;

  v_saved := null;
  if nullif(v_response->>'new_patient_id', '') is null then
    raise exception 'Patient registration did not return a patient ID';
  end if;

  if p_payment_category <> 'cash' then
    insert into public.patient_insurance (
      clinic_id, patient_id, insurer_id, policy_number,
      policyholder_name, created_by
    ) values (
      p_clinic_id,
      (v_response->>'new_patient_id')::uuid,
      p_insurer_id,
      trim(p_policy_number),
      nullif(trim(p_policyholder_name), ''),
      p_staff_id
    );
  end if;

  v_response := jsonb_build_object(
    'duplicate_found', false,
    'new_patient_id', v_response->>'new_patient_id'
  );

  update public.offline_mutation_idempotency
  set status = 'completed',
      patient_id = (v_response->>'new_patient_id')::uuid,
      response = v_response,
      updated_at = now()
  where clinic_id = p_clinic_id and operation_id = p_operation_id;

  return query
  select
    false,
    null::uuid,
    null::text,
    null::text,
    (v_response->>'new_patient_id')::uuid,
    false;
exception
  when unique_violation then
    -- Insurance uniqueness/other DB constraints must remain fatal; the client
    -- retries the same operation and the idempotency row prevents duplication.
    raise;
end;
$$;

revoke all on function public.register_patient_idempotent(
  uuid, uuid, uuid, text, text, date, integer, text, text, text, text,
  text, text, text, text, text, uuid, text, text, boolean
) from public;
grant execute on function public.register_patient_idempotent(
  uuid, uuid, uuid, text, text, date, integer, text, text, text, text,
  text, text, text, text, text, uuid, text, text, boolean
) to authenticated;
