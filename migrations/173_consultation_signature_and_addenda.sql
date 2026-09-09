-- ============================================================================
-- MIGRATION 173: CONSULTATION COMPLETION ≠ SOAP SIGNATURE
--
-- A completed consultation remains editable until the clinician signs it.
-- Once signed, the original SOAP is locked and later corrections are recorded
-- as addenda. This preserves the original clinical record and provides an
-- auditable correction path.
-- ============================================================================

alter table public.consultations
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by uuid references public.staff(id) on delete set null;

create index if not exists idx_consultations_unsigned_completed
  on public.consultations(visit_id, completed_at)
  where completed_at is not null and signed_at is null;

create table if not exists public.consultation_addenda (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  author_id uuid not null references public.staff(id) on delete restrict,
  section text not null default 'other'
    check (section in ('subjective','objective','assessment','plan','other')),
  reason text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_consultation_addenda_consultation
  on public.consultation_addenda(consultation_id, created_at desc);

alter table public.consultation_addenda enable row level security;

drop policy if exists consultation_addenda_select on public.consultation_addenda;
create policy consultation_addenda_select on public.consultation_addenda
for select to authenticated using (
  exists (
    select 1 from public.staff s
    where s.id = consultation_addenda.author_id
      and s.clinic_id = consultation_addenda.clinic_id
      and s.is_active = true
      and s.auth_user_id = auth.uid()
  )
  or exists (
    select 1 from public.staff s
    where s.clinic_id = consultation_addenda.clinic_id
      and s.is_active = true
      and s.auth_user_id = auth.uid()
      and s.role::text in ('admin','doctor','medical_director')
  )
);

drop policy if exists consultation_addenda_insert on public.consultation_addenda;
create policy consultation_addenda_insert on public.consultation_addenda
for insert to authenticated with check (
  exists (
    select 1 from public.staff s
    where s.id = consultation_addenda.author_id
      and s.clinic_id = consultation_addenda.clinic_id
      and s.is_active = true
      and s.auth_user_id = auth.uid()
      and s.role::text in ('doctor','admin','medical_director')
  )
);

grant select, insert on public.consultation_addenda to authenticated;

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
  select c.id, c.clinic_id, c.doctor_id, c.completed_at, c.signed_at
    into v_consultation
  from public.consultations c
  where c.id = p_consultation_id
  for update;

  if not found then
    raise exception 'Consultation not found';
  end if;

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
  select c.id, c.doctor_id, c.completed_at, c.signed_at
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
end;
$$;

grant execute on function public.sign_consultation(uuid,uuid) to authenticated;

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

  insert into public.consultation_addenda(clinic_id,visit_id,consultation_id,author_id,section,reason,content)
  values(v_consultation.clinic_id,v_consultation.visit_id,v_consultation.id,p_staff_id,v_section,trim(p_reason),trim(p_content))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_consultation_addendum(uuid,uuid,text,text,text) to authenticated;
