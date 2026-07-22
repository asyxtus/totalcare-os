-- ============================================================================
-- APPOINTMENTS / SCHEDULING
--
-- The one piece of daily clinical flow that's been entirely missing:
-- every visit so far has assumed a patient who already walked in.
--
-- Deliberately NOT a parallel booking system. An appointment is just a
-- future-dated intent to visit — when the patient actually arrives, it
-- converts into a real visit through the EXACT SAME register_visit_with_charge
-- path that walk-in check-in already uses (see lib/actions/checkin.ts).
-- No separate charge/invoice logic to keep in sync with the real one.
--
-- Scope decisions, stated plainly rather than silently baked in:
--   - Four statuses only: scheduled, arrived, cancelled, no_show. No
--     separate "confirmed" step — booking IS the confirmation for v1.
--     "Completed" isn't tracked here either; once arrived, the actual
--     visit record is the source of truth for what happened.
--   - No double-booking prevention. A soft "this doctor already has an
--     appointment near this time" warning would be the natural next
--     refinement, but a hard block would get in the way of legitimate
--     urgent add-ons — deliberately not building that yet.
--   - Booking requires an existing patient record (search-select only).
--     Registering a brand-new patient stays in the Patients module; this
--     doesn't duplicate that flow.
-- ============================================================================

create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  doctor_id uuid references staff(id),
  service_price_id uuid references service_prices(id),
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30,
  reason text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'arrived', 'cancelled', 'no_show')),
  visit_id uuid references visits(id),
  cancelled_reason text,
  created_by uuid not null references staff(id),
  created_at timestamptz not null default now()
);

create index idx_appointments_clinic_date on appointments (clinic_id, scheduled_at);
create index idx_appointments_doctor_date on appointments (doctor_id, scheduled_at) where doctor_id is not null;

alter table appointments enable row level security;

-- Scheduling is a shared, whole-clinic view — reception books, doctors
-- and nurses need to see the day's list, admin oversees all of it. No
-- role restriction beyond "belongs to this clinic," matching how visits
-- and admissions are already scoped.
create policy appointments_select on appointments for select using (
  clinic_id = current_staff_clinic_id()
);
create policy appointments_insert on appointments for insert with check (
  clinic_id = current_staff_clinic_id()
);
create policy appointments_update on appointments for update using (
  clinic_id = current_staff_clinic_id()
) with check (
  clinic_id = current_staff_clinic_id()
);
