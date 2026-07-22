-- ============================================================================
-- INSURANCE, PART 1: INSURERS, PATIENT COVERAGE, CHARGE SPLITTING
-- One unified "insurers" table covers private insurance, employer
-- schemes, and CNPS — all three are architecturally the same thing (a
-- third party covering a flat % of charges), just different identities.
-- Confirmed payment_category already has all four enum values at the
-- DB level, so no enum migration needed at all.
--
-- Charge splitting applied via a BEFORE INSERT trigger on
-- service_charges (modifies NEW directly, so no separate UPDATE
-- statement is needed — avoiding any risk of the exact RLS
-- update-policy gap found earlier this session on dispensing_records),
-- not by modifying any of the five existing functions that create
-- charges. A trigger fires uniformly regardless of source, with zero
-- risk of missing a pathway and zero changes to any existing function.
-- ============================================================================

create table insurers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  payer_type text not null check (payer_type in ('private_insurance', 'employer_scheme', 'cnps')),
  coverage_percentage numeric(5,2) not null check (coverage_percentage > 0 and coverage_percentage <= 100),
  contact_name text,
  phone text,
  email text,
  address text,
  is_active boolean not null default true
);

create table patient_insurance (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id),
  insurer_id uuid not null references insurers(id),
  policy_number text not null,
  policyholder_name text,
  relationship text not null default 'self',
  coverage_start_date date not null default current_date,
  coverage_end_date date,
  is_active boolean not null default true,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);
create index idx_patient_insurance_patient on patient_insurance(patient_id);

-- One active coverage per patient at a time.
create unique index idx_patient_insurance_one_active
  on patient_insurance(patient_id) where is_active;

alter table service_charges add column if not exists insurer_id uuid references insurers(id);
alter table service_charges add column if not exists insurer_portion_xaf numeric(10,2);
alter table service_charges add column if not exists patient_portion_xaf numeric(10,2);

create or replace function apply_insurance_split()
returns trigger
language plpgsql
as $$
declare
  v_coverage record;
begin
  select pi.insurer_id, i.coverage_percentage
    into v_coverage
  from patient_insurance pi
  join insurers i on i.id = pi.insurer_id and i.is_active
  where pi.patient_id = NEW.patient_id
    and pi.is_active
    and pi.coverage_start_date <= coalesce(NEW.service_date, current_date)
    and (pi.coverage_end_date is null or pi.coverage_end_date >= coalesce(NEW.service_date, current_date))
  limit 1;

  if v_coverage.insurer_id is not null then
    NEW.insurer_id := v_coverage.insurer_id;
    NEW.insurer_portion_xaf := round(NEW.amount_xaf * v_coverage.coverage_percentage / 100, 2);
    NEW.patient_portion_xaf := NEW.amount_xaf - NEW.insurer_portion_xaf;
  end if;

  return NEW;
end;
$$;

create trigger trg_apply_insurance_split
  before insert on service_charges
  for each row
  execute function apply_insurance_split();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table insurers enable row level security;
alter table patient_insurance enable row level security;

create policy insurers_select on insurers for select using (clinic_id = current_staff_clinic_id());
create policy insurers_write on insurers for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'receptionist', 'billing_clerk')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'receptionist', 'billing_clerk')
);

create policy patient_insurance_select on patient_insurance for select using (clinic_id = current_staff_clinic_id());
create policy patient_insurance_write on patient_insurance for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'receptionist', 'billing_clerk')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'receptionist', 'billing_clerk')
);
