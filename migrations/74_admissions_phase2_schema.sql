-- ============================================================================
-- ADMISSIONS PHASE 2, PART 1: WARD PRICING, TRANSFERS, CARE NOTES
-- ============================================================================

alter table wards add column code text;
alter table wards add column ward_type text;
alter table wards add column capacity int;
alter table wards add column daily_rate_xaf numeric(10,2);

alter table beds add column bed_type text;

create table admission_transfers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  admission_id uuid not null references admissions(id) on delete cascade,
  from_ward_id uuid references wards(id),
  from_bed_id uuid references beds(id),
  to_ward_id uuid not null references wards(id),
  to_bed_id uuid not null references beds(id),
  reason text not null,
  transferred_by uuid references staff(id),
  transferred_at timestamptz not null default now()
);
create index idx_admission_transfers_admission on admission_transfers(admission_id);

create table inpatient_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  admission_id uuid not null references admissions(id) on delete cascade,
  recorded_by uuid references staff(id),
  note text not null,
  recorded_at timestamptz not null default now()
);
create index idx_inpatient_notes_admission on inpatient_notes(admission_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table admission_transfers enable row level security;
alter table inpatient_notes enable row level security;

create policy admission_transfers_select on admission_transfers for select
  using (clinic_id = current_staff_clinic_id());
create policy admission_transfers_insert on admission_transfers for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'nurse', 'doctor')
);

create policy inpatient_notes_select on inpatient_notes for select
  using (clinic_id = current_staff_clinic_id());
create policy inpatient_notes_insert on inpatient_notes for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'nurse', 'doctor')
);
