-- ============================================================================
-- CLINICAL CORE PATCH: NURSE TRIAGE ASSESSMENT
-- Closes the gap identified in the architecture review: chief complaint
-- and history were only ever captured by the DOCTOR (too late in the
-- flow) with no field at all for medical or social history. This gives
-- the nurse their own documentation, distinct from:
--   - vitals (numeric readings only)
--   - consultations (the doctor's own record, which now has the nurse's
--     assessment available to read, not just numbers)
-- ============================================================================

create table triage_assessments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  recorded_by uuid references staff(id),
  chief_complaint text,
  medical_history text,      -- e.g. prior conditions, surgeries, existing diagnoses
  social_history text,       -- e.g. smoking, alcohol, occupation, living situation
  created_at timestamptz not null default now()
);
create index idx_triage_assessments_visit on triage_assessments(visit_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Same role pattern as vitals: clinical staff can write, everyone in the
-- clinic can read (a receptionist doesn't need this, but read access
-- costs nothing and simplifies the policy versus role-by-role tuning).
-- ============================================================================
alter table triage_assessments enable row level security;

create policy triage_assessments_select on triage_assessments for select
  using (clinic_id = current_staff_clinic_id());

create policy triage_assessments_write on triage_assessments for insert with check (
  clinic_id = current_staff_clinic_id()
  and current_staff_role() in ('admin','doctor','nurse')
);

-- ============================================================================
-- NEXT: automatic charging + payment gate (Section 5 of the architecture doc)
-- ============================================================================
