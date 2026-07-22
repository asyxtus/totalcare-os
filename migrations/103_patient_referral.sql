-- ============================================================================
-- PATIENT REFERRAL
--
-- "Refer to specialist" has been a greyed-out placeholder in the
-- consultation form since the beginning. This migration makes it real.
--
-- Design decisions:
--   - Referrals live on the consultation that generated them, not as a
--     separate workflow. The doctor fills in referral details while
--     completing the consultation — same flow, one extra section.
--   - A referral can go to an external specialist, an external facility,
--     or both. Free text, not a registry — Cameroon doesn't have a
--     centralized specialist directory to query, and forcing one would
--     block doctors from referring to people they already know.
--   - Urgency: routine / urgent / emergency — determines how the
--     referral letter is styled and whether it carries a time flag.
--   - The referral letter is printable immediately from the patient
--     record, same as prescriptions and lab reports.
-- ============================================================================

create table external_referrals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  visit_id uuid not null references visits(id),
  consultation_id uuid references consultations(id),
  patient_id uuid not null references patients(id),
  referred_by uuid not null references staff(id),

  -- Where the patient is being referred
  specialist_name text,           -- e.g. "Dr. Mbarga Jean"
  specialty text not null,        -- e.g. "Cardiologie", "Neurologie"
  facility_name text,             -- e.g. "CHU Yaoundé", "Clinique des Spécialistes"
  facility_address text,

  -- Clinical context
  urgency text not null default 'routine'
    check (urgency in ('routine', 'urgent', 'emergency')),
  reason text not null,           -- clinical reason for referral
  clinical_summary text,          -- brief summary for the receiving specialist
  specific_request text,          -- what the doctor wants from the specialist

  created_at timestamptz not null default now()
);

create index idx_external_referrals_visit on external_referrals(visit_id);
create index idx_external_referrals_patient on external_referrals(patient_id);

alter table external_referrals enable row level security;

create policy referrals_select on external_referrals for select using (
  clinic_id = current_staff_clinic_id()
);
create policy referrals_insert on external_referrals for insert with check (
  clinic_id = current_staff_clinic_id()
);
