-- ============================================================================
-- MIGRATION 174: HARDEN SOAP IMMUTABILITY + CLINICAL AUDIT TRAIL
--
-- Rules:
--   1. Unsigned completed SOAP notes remain editable by the consulting doctor.
--   2. Signing makes the original SOAP immutable.
--   3. Post-signature corrections are append-only addenda.
--   4. Every signature/addendum records actor + timestamp.
--   5. Addenda are never allowed to modify the original SOAP.
-- ============================================================================

create table if not exists public.consultation_documentation_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  actor_id uuid not null references public.staff(id) on delete restrict,
  event_type text not null check (event_type in ('signed','addendum_created')),
  addendum_id uuid null references public.consultation_addenda(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_consultation_doc_events_consultation
  on public.consultation_documentation_events(consultation_id, created_at desc);

alter table public.consultation_documentation_events enable row level security;

drop policy if exists consultation_doc_events_select on public.consultation_documentation_events;
create policy consultation_doc_events_select on public.consultation_documentation_events
for select to authenticated using (
  exists (
    select 1 from public.staff s
    where s.clinic_id = consultation_documentation_events.clinic_id
      and s.is_active = true
      and s.auth_user_id = auth.uid()
      and s.role::text in ('admin','doctor','medical_director')
  )
);

grant select on public.consultation_documentation_events to authenticated;

-- Replace the unsigned SOAP updater with an explicitly immutable boundary.
create or replace function public.update_unsigned_consultation_soap(
  p_consultation_id uuid,
  p_staff_id uuid,
  p_subjective_notes text,
  p_examination_notes text,
  p_diagnosis text,
  p_treatment_plan text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consultation record;
begin
  select c.id, c.doctor_id, c.completed_at, c.signed_at
    into v_consultation
  from public.consultations c
  where c.id = p_consultation_id
  for update;

  if not found then raise exception 'Consultation not found'; end if;
  if v_consultation.doctor_id <> p_staff_id then
    raise exception 'Only the consulting doctor can edit this clinical note';
  end if;
  if v_consultation.completed_at is null then
    raise exception 'Consultation is not completed yet; edit it from the active consultation';
  end if;
  if v_consultation.signed_at is not null then
    raise exception 'This clinical note is signed and locked; use an addendum instead';
  end if;

  update public.consultations
  set subjective_notes = nullif(trim(p_subjective_notes), ''),
      examination_notes = nullif(trim(p_examination_notes), ''),
      diagnosis = nullif(trim(p_diagnosis), ''),
      treatment_plan = nullif(trim(p_treatment_plan), '')
  where id = p_consultation_id;
end;
$$;

grant execute on function public.update_unsigned_consultation_soap(uuid,uuid,text,text,text,text) to authenticated;

-- Signing is a one-way transition and creates a clinical event.
create or replace function public.sign_consultation(
  p_consultation_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consultation record;
begin
  select c.id, c.clinic_id, c.visit_id, c.doctor_id, c.completed_at, c.signed_at
    into v_consultation
  from public.consultations c
  where c.id = p_consultation_id
  for update;

  if not found then raise exception 'Consultation not found'; end if;
  if v_consultation.doctor_id <> p_staff_id then raise exception 'Only the consulting doctor can sign this clinical note'; end if;
  if v_consultation.completed_at is null then raise exception 'Complete the consultation before signing the clinical note'; end if;
  if v_consultation.signed_at is not null then raise exception 'This clinical note is already signed'; end if;

  update public.consultations
  set signed_at = now(), signed_by = p_staff_id
  where id = p_consultation_id;

  insert into public.consultation_documentation_events
    (clinic_id, visit_id, consultation_id, actor_id, event_type)
  values
    (v_consultation.clinic_id, v_consultation.visit_id, v_consultation.id, p_staff_id, 'signed');
end;
$$;

grant execute on function public.sign_consultation(uuid,uuid) to authenticated;

-- Addenda are append-only and must follow a signed original.
create or replace function public.create_consultation_addendum(
  p_consultation_id uuid,
  p_staff_id uuid,
  p_section text,
  p_reason text,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consultation record;
  v_id uuid;
  v_section text;
begin
  select c.id, c.clinic_id, c.visit_id, c.doctor_id, c.signed_at
    into v_consultation
  from public.consultations c
  where c.id = p_consultation_id;

  if not found then raise exception 'Consultation not found'; end if;
  if v_consultation.doctor_id <> p_staff_id then raise exception 'Only the consulting doctor can create this addendum'; end if;
  if v_consultation.signed_at is null then raise exception 'The clinical note is not signed; edit the unsigned note instead'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'A reason is required for a clinical note addendum'; end if;
  if nullif(trim(coalesce(p_content,'')), '') is null then raise exception 'Addendum content is required'; end if;

  v_section := lower(trim(coalesce(p_section,'other')));
  if v_section not in ('subjective','objective','assessment','plan','other') then v_section := 'other'; end if;

  insert into public.consultation_addenda
    (clinic_id,visit_id,consultation_id,author_id,section,reason,content)
  values
    (v_consultation.clinic_id,v_consultation.visit_id,v_consultation.id,p_staff_id,v_section,trim(p_reason),trim(p_content))
  returning id into v_id;

  insert into public.consultation_documentation_events
    (clinic_id, visit_id, consultation_id, actor_id, event_type, addendum_id)
  values
    (v_consultation.clinic_id, v_consultation.visit_id, v_consultation.id, p_staff_id, 'addendum_created', v_id);

  return v_id;
end;
$$;

grant execute on function public.create_consultation_addendum(uuid,uuid,text,text,text) to authenticated;

-- Prevent direct client-side UPDATE/DELETE of the clinical audit events.
drop policy if exists consultation_doc_events_insert on public.consultation_documentation_events;
drop policy if exists consultation_doc_events_update on public.consultation_documentation_events;
drop policy if exists consultation_doc_events_delete on public.consultation_documentation_events;
