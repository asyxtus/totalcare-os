-- ============================================================================
-- INPATIENT CARE PANEL — FULL BUILD: ROUNDS, MAR, CARE, VITALS, LABS
-- Two real integration decisions worth stating plainly:
-- 1. Inpatient prescribing reuses the REAL prescriptions/prescription_items
--    tables (confirmed from actual working code in consultation.ts, not
--    guessed) — an inpatient prescription is tied to the admission's own
--    visit_id, so it automatically appears in the existing Dispensing
--    queue. No parallel prescribing system, one real pipeline.
-- 2. In-stay lab ordering reuses the EXISTING create_lab_order() function
--    as-is — it already just needs a visit_id, which every admission has.
--    No new lab-ordering backend needed at all.
-- ============================================================================

alter table inpatient_notes add column if not exists round_type text default 'doctor_round';

alter table prescription_items add column if not exists route text;
alter table prescription_items add column if not exists instructions text;

create table vital_signs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  admission_id uuid not null references admissions(id) on delete cascade,
  recorded_by uuid references staff(id),
  recorded_at timestamptz not null default now(),
  blood_pressure_systolic int,
  blood_pressure_diastolic int,
  heart_rate int,
  temperature_celsius numeric(4,1),
  respiratory_rate int,
  oxygen_saturation int,
  notes text
);
create index idx_vital_signs_admission on vital_signs(admission_id);

create table medication_administrations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  prescription_item_id uuid not null references prescription_items(id) on delete cascade,
  admission_id uuid not null references admissions(id) on delete cascade,
  administered_by uuid references staff(id),
  administered_at timestamptz not null default now(),
  status text not null default 'administered' check (status in ('administered', 'refused', 'missed')),
  notes text
);
create index idx_med_admin_admission on medication_administrations(admission_id);
create index idx_med_admin_item on medication_administrations(prescription_item_id);

create table care_tasks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  admission_id uuid not null references admissions(id) on delete cascade,
  task_description text not null,
  completed_by uuid references staff(id),
  completed_at timestamptz not null default now()
);
create index idx_care_tasks_admission on care_tasks(admission_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table vital_signs enable row level security;
alter table medication_administrations enable row level security;
alter table care_tasks enable row level security;

create policy vital_signs_select on vital_signs for select using (clinic_id = current_staff_clinic_id());
create policy vital_signs_insert on vital_signs for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'nurse', 'doctor')
);

create policy med_admin_select on medication_administrations for select using (clinic_id = current_staff_clinic_id());
create policy med_admin_insert on medication_administrations for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'nurse', 'doctor')
);

create policy care_tasks_select on care_tasks for select using (clinic_id = current_staff_clinic_id());
create policy care_tasks_insert on care_tasks for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'nurse', 'doctor')
);
