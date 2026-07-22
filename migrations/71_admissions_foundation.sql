-- ============================================================================
-- ADMISSIONS MODULE, PHASE 1: WARDS, BEDS, CORE ADMISSION WORKFLOW
-- The first module this session built with genuinely zero prior
-- backend — Pharmacy and Billing had months-old functions waiting for
-- a UI; this has nothing. Designed from scratch, same standard as
-- everywhere else: RLS-scoped, multi-tenant-safe, audit-logged.
-- ============================================================================

create table wards (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  is_active boolean not null default true
);

create type bed_status as enum ('available', 'occupied', 'reserved', 'maintenance');

create table beds (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  ward_id uuid not null references wards(id) on delete cascade,
  bed_number text not null,
  status bed_status not null default 'available',
  is_active boolean not null default true,
  unique (ward_id, bed_number)
);

create type admission_status as enum ('awaiting_bed', 'admitted', 'discharged', 'cancelled');

create table admissions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  admission_number text,
  patient_id uuid not null references patients(id),
  visit_id uuid not null references visits(id),
  source text not null default 'doctor',
  status admission_status not null default 'awaiting_bed',
  admission_reason text,
  recommended_by uuid references staff(id),
  recommended_at timestamptz not null default now(),
  ward_id uuid references wards(id),
  bed_id uuid references beds(id),
  bed_assigned_by uuid references staff(id),
  bed_assigned_at timestamptz,
  discharge_summary text,
  discharged_by uuid references staff(id),
  discharged_at timestamptz
);
create index idx_admissions_visit on admissions(visit_id);

create or replace function generate_next_admission_number(p_clinic_id uuid)
returns text
language plpgsql
as $$
declare
  v_next_number int;
begin
  perform pg_advisory_xact_lock(hashtext(p_clinic_id::text || '_admission'));

  select coalesce(max(substring(admission_number from 5)::int), 0) + 1 into v_next_number
  from admissions
  where clinic_id = p_clinic_id and admission_number ~ '^ADM-[0-9]+$';

  return 'ADM-' || lpad(v_next_number::text, 5, '0');
end;
$$;

create or replace function recommend_admission(
  p_clinic_id uuid,
  p_visit_id uuid,
  p_recommended_by uuid,
  p_admission_reason text
)
returns uuid
language plpgsql
as $$
declare
  v_patient_id uuid;
  v_admission_id uuid;
  v_admission_number text;
begin
  select patient_id into v_patient_id from visits where id = p_visit_id and clinic_id = p_clinic_id;
  if v_patient_id is null then
    raise exception 'Visit % not found for this clinic', p_visit_id;
  end if;

  v_admission_number := generate_next_admission_number(p_clinic_id);

  insert into admissions (
    clinic_id, admission_number, patient_id, visit_id, source, recommended_by, admission_reason
  ) values (
    p_clinic_id, v_admission_number, v_patient_id, p_visit_id, 'doctor', p_recommended_by, p_admission_reason
  )
  returning id into v_admission_id;

  update visits set status = 'admitted' where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_recommended_by, 'admission.recommended', 'admission', v_admission_id,
    jsonb_build_object('admission_number', v_admission_number, 'reason', p_admission_reason));

  return v_admission_id;
end;
$$;

create or replace function assign_bed(
  p_clinic_id uuid,
  p_admission_id uuid,
  p_ward_id uuid,
  p_bed_id uuid,
  p_assigned_by uuid
)
returns void
language plpgsql
as $$
declare
  v_bed_status bed_status;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id) then
    raise exception 'Admission does not belong to this clinic';
  end if;

  select status into v_bed_status from beds
    where id = p_bed_id and ward_id = p_ward_id and clinic_id = p_clinic_id
    for update;

  if v_bed_status is null then
    raise exception 'Bed not found in this ward for this clinic';
  end if;
  if v_bed_status <> 'available' then
    raise exception 'Bed is not available (current status: %)', v_bed_status;
  end if;

  update beds set status = 'occupied' where id = p_bed_id;

  update admissions set
    status = 'admitted',
    ward_id = p_ward_id,
    bed_id = p_bed_id,
    bed_assigned_by = p_assigned_by,
    bed_assigned_at = now()
  where id = p_admission_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_assigned_by, 'admission.bed_assigned', 'admission', p_admission_id,
    jsonb_build_object('ward_id', p_ward_id, 'bed_id', p_bed_id));
end;
$$;

create or replace function bed_occupancy_summary(p_clinic_id uuid)
returns table (
  total_beds bigint,
  available_beds bigint,
  occupied_beds bigint,
  reserved_beds bigint,
  occupancy_pct numeric
)
language sql
stable
as $$
  select
    count(*) filter (where is_active),
    count(*) filter (where status = 'available' and is_active),
    count(*) filter (where status = 'occupied' and is_active),
    count(*) filter (where status = 'reserved' and is_active),
    case when count(*) filter (where is_active) > 0
      then round(100.0 * count(*) filter (where status = 'occupied' and is_active) / count(*) filter (where is_active), 0)
      else 0
    end
  from beds
  where clinic_id = p_clinic_id
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table wards enable row level security;
alter table beds enable row level security;
alter table admissions enable row level security;

create policy wards_select on wards for select using (clinic_id = current_staff_clinic_id());
create policy wards_write on wards for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'nurse')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'nurse')
);

create policy beds_select on beds for select using (clinic_id = current_staff_clinic_id());
create policy beds_write on beds for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'nurse')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'nurse')
);

create policy admissions_select on admissions for select using (clinic_id = current_staff_clinic_id());
create policy admissions_insert on admissions for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'doctor')
);
create policy admissions_update on admissions for update using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'nurse', 'doctor')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'nurse', 'doctor')
);
