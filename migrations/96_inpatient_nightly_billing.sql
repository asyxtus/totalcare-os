-- ============================================================================
-- INPATIENT DAILY BILLING: NIGHTLY ACCRUAL, NOT A LUMP SUM AT DISCHARGE
--
-- Two decisions from this session: nursing per-diem is one flat
-- clinic-wide rate (not per-ward), and both room + nursing charges post
-- every night while a patient is admitted, not as one total at
-- discharge like the previous implementation.
--
-- This changes the shape of the problem: instead of a single function
-- computing nights-stayed at discharge time, something has to run once
-- a day, for every currently-admitted patient across every clinic, and
-- post that night's charges — a cross-tenant system job, not a
-- clinician action. That's new to this codebase, and it's the reason
-- this migration is larger than it looks:
--   1. A ledger table (inpatient_daily_accruals) that is both the
--      idempotency guard (never double-charge the same admission on
--      the same date, even if the job is retried) and, incidentally, a
--      clean per-night billing history for any admission.
--   2. A SECURITY DEFINER function, because this is the first job in
--      the codebase that isn't scoped to one caller's clinic — it has
--      to see every clinic's admitted patients in one run. Locked down
--      hard: EXECUTE is revoked from every normal role. It's only
--      reachable via the service-role client, from a server-only cron
--      route — never from the browser, regardless of who's logged in.
--   3. discharge_patient() rewritten: the old "charge the whole stay
--      at once" logic is replaced with a fallback that only fires if
--      NO nightly accrual ever ran for that admission (e.g. someone
--      admitted and discharged the same day, before the nightly job
--      next runs) — one minimum night charged, matching the old
--      greatest(1, ...) floor, so a same-day stay is never free.
--      Also fixes a real bug found this session: the old lump charge
--      was categorized 'consultation', which was silently polluting
--      consultation revenue in the Executive Dashboard. Now 'admission'.
-- ============================================================================

-- ── Nursing per-diem: one flat rate for the whole clinic ──────────────
alter table clinics add column if not exists nursing_daily_rate_xaf numeric(10,2);

-- ── Nightly accrual ledger ─────────────────────────────────────────────
create table if not exists inpatient_daily_accruals (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references admissions(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  accrual_date date not null,
  room_charge_id uuid references service_charges(id),
  nursing_charge_id uuid references service_charges(id),
  created_at timestamptz not null default now(),
  unique (admission_id, accrual_date)
);

alter table inpatient_daily_accruals enable row level security;

create policy inpatient_daily_accruals_select on inpatient_daily_accruals for select using (
  clinic_id = current_staff_clinic_id()
);
-- No client-facing write policy: rows are only ever written by
-- accrue_nightly_inpatient_charges() below, which runs as the function
-- owner (security definer) regardless of RLS.

-- ── The nightly job ─────────────────────────────────────────────────────
-- p_run_by is optional and mainly for manual/testing invocation. In
-- normal cron operation it's left null, and each clinic's earliest
-- active admin is resolved automatically as the charge's created_by —
-- there's no single "system user" concept in this schema, and every
-- create_service_charge() call site so far always passes a real staff
-- id, so this keeps that contract intact rather than assuming NULL is
-- accepted somewhere it might not be.
create or replace function accrue_nightly_inpatient_charges(p_run_by uuid default null)
returns table(admission_id uuid, clinic_id uuid, room_charge_id uuid, nursing_charge_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admission record;
  v_ward record;
  v_clinic record;
  v_accrual_id uuid;
  v_room_charge_id uuid;
  v_nursing_charge_id uuid;
  v_run_by uuid;
  v_today date := current_date;
begin
  for v_admission in
    select * from admissions where status = 'admitted'
  loop
    v_room_charge_id := null;
    v_nursing_charge_id := null;

    -- Idempotency: the unique constraint is the real guard (safe even
    -- against a concurrent/retried run); the ON CONFLICT just makes
    -- "already accrued today" a cheap no-op instead of an error.
    insert into inpatient_daily_accruals (admission_id, clinic_id, accrual_date)
    values (v_admission.id, v_admission.clinic_id, v_today)
    on conflict (admission_id, accrual_date) do nothing
    returning id into v_accrual_id;

    if v_accrual_id is null then
      continue; -- already billed for tonight
    end if;

    v_run_by := p_run_by;
    if v_run_by is null then
      select id into v_run_by from staff
        where staff.clinic_id = v_admission.clinic_id and role = 'admin' and is_active = true
        order by created_at asc limit 1;
    end if;

    if v_run_by is null then
      -- No active admin to attribute the charge to (shouldn't happen —
      -- the Admin module blocks deactivating a clinic's last admin —
      -- but skip rather than fail the whole run for every other clinic).
      raise warning 'No active admin found for clinic % — skipping nightly accrual for admission %', v_admission.clinic_id, v_admission.id;
      continue;
    end if;

    if v_admission.ward_id is not null then
      select * into v_ward from wards where id = v_admission.ward_id;
      if v_ward.daily_rate_xaf is not null and v_ward.daily_rate_xaf > 0 then
        v_room_charge_id := create_service_charge(
          v_admission.clinic_id, v_admission.patient_id, v_admission.visit_id, null, 'admission',
          'Frais de chambre — ' || v_ward.name || ' (' || to_char(v_today, 'DD/MM/YYYY') || ')',
          v_ward.daily_rate_xaf, v_run_by
        );
        perform open_invoice_for_charge(v_room_charge_id, v_run_by);
      end if;
    end if;

    select * into v_clinic from clinics where id = v_admission.clinic_id;
    if v_clinic.nursing_daily_rate_xaf is not null and v_clinic.nursing_daily_rate_xaf > 0 then
      v_nursing_charge_id := create_service_charge(
        v_admission.clinic_id, v_admission.patient_id, v_admission.visit_id, null, 'admission',
        'Soins infirmiers — forfait journalier (' || to_char(v_today, 'DD/MM/YYYY') || ')',
        v_clinic.nursing_daily_rate_xaf, v_run_by
      );
      perform open_invoice_for_charge(v_nursing_charge_id, v_run_by);
    end if;

    update inpatient_daily_accruals
      set room_charge_id = v_room_charge_id, nursing_charge_id = v_nursing_charge_id
      where id = v_accrual_id;

    admission_id := v_admission.id;
    clinic_id := v_admission.clinic_id;
    room_charge_id := v_room_charge_id;
    nursing_charge_id := v_nursing_charge_id;
    return next;
  end loop;
end;
$$;

-- Locked down hard: this must only ever be reachable via the
-- service-role client from the cron route, never from a logged-in
-- staff session regardless of role.
revoke all on function accrue_nightly_inpatient_charges(uuid) from public, anon, authenticated;

-- ── discharge_patient(): drop the lump-sum charge, add a same-day
-- minimum-night fallback, fix the charge category ─────────────────────
create or replace function discharge_patient(
  p_clinic_id uuid,
  p_admission_id uuid,
  p_discharged_by uuid,
  p_discharge_summary text,
  p_discharge_type text default 'routine',
  p_outcome text default null
)
returns void
language plpgsql
as $$
declare
  v_admission record;
  v_ward record;
  v_clinic record;
  v_already_accrued boolean;
  v_room_charge_id uuid;
  v_nursing_charge_id uuid;
begin
  select * into v_admission from admissions
    where id = p_admission_id and clinic_id = p_clinic_id
    for update;

  if v_admission.id is null then
    raise exception 'Admission does not belong to this clinic';
  end if;
  if v_admission.status <> 'admitted' then
    raise exception 'Only an admitted patient can be discharged (current status: %)', v_admission.status;
  end if;
  if p_discharge_summary is null or trim(p_discharge_summary) = '' then
    raise exception 'A discharge summary is required';
  end if;
  if p_discharge_type not in ('routine', 'transfer_out', 'against_medical_advice', 'deceased') then
    raise exception 'Invalid discharge type: %', p_discharge_type;
  end if;

  if v_admission.bed_id is not null then
    update beds set status = 'available' where id = v_admission.bed_id;
  end if;

  -- Nightly accrual (accrue_nightly_inpatient_charges) already bills
  -- room + nursing for every night this admission was open at the time
  -- the cron ran. This only needs to cover the gap: an admission that
  -- never saw a single nightly run (admitted and discharged same day,
  -- before the next scheduled run) still owes a minimum one night —
  -- matching the floor the old lump-sum logic used — rather than being
  -- billed nothing for a real bed-day.
  select exists(select 1 from inpatient_daily_accruals where admission_id = p_admission_id)
    into v_already_accrued;

  if not v_already_accrued then
    if v_admission.ward_id is not null then
      select * into v_ward from wards where id = v_admission.ward_id;
      if v_ward.daily_rate_xaf is not null and v_ward.daily_rate_xaf > 0 then
        v_room_charge_id := create_service_charge(
          p_clinic_id, v_admission.patient_id, v_admission.visit_id, null, 'admission',
          'Frais de chambre — ' || v_ward.name || ' (séjour < 1 nuit, minimum facturé)',
          v_ward.daily_rate_xaf, p_discharged_by
        );
        perform open_invoice_for_charge(v_room_charge_id, p_discharged_by);
      end if;
    end if;

    select * into v_clinic from clinics where id = p_clinic_id;
    if v_clinic.nursing_daily_rate_xaf is not null and v_clinic.nursing_daily_rate_xaf > 0 then
      v_nursing_charge_id := create_service_charge(
        p_clinic_id, v_admission.patient_id, v_admission.visit_id, null, 'admission',
        'Soins infirmiers — forfait journalier (séjour < 1 nuit, minimum facturé)',
        v_clinic.nursing_daily_rate_xaf, p_discharged_by
      );
      perform open_invoice_for_charge(v_nursing_charge_id, p_discharged_by);
    end if;

    insert into inpatient_daily_accruals (admission_id, clinic_id, accrual_date, room_charge_id, nursing_charge_id)
    values (p_admission_id, p_clinic_id, current_date, v_room_charge_id, v_nursing_charge_id)
    on conflict (admission_id, accrual_date) do nothing;
  end if;

  update admissions set
    status = 'discharged',
    discharge_summary = p_discharge_summary,
    discharge_type = p_discharge_type,
    discharge_outcome = p_outcome,
    discharged_by = p_discharged_by,
    discharged_at = now()
  where id = p_admission_id;

  update visits set status = 'discharged' where id = v_admission.visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_discharged_by, 'admission.discharged', 'admission', p_admission_id,
    jsonb_build_object('discharge_summary', p_discharge_summary, 'discharge_type', p_discharge_type, 'outcome', p_outcome));
end;
$$;

-- ── Defense-in-depth: admin-only UPDATE on the two rate-bearing tables.
-- Writes actually happen through the service-role client in
-- lib/actions/pricingAdmin.ts (same model as Staff and Services/Lab
-- pricing), so this is a backstop, not the only thing enforcing it. ───
create policy wards_admin_update_rate on wards for update using (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
);

create policy clinics_admin_update_nursing_rate on clinics for update using (
  id = current_staff_clinic_id() and current_staff_role() = 'admin'
) with check (
  id = current_staff_clinic_id() and current_staff_role() = 'admin'
);
