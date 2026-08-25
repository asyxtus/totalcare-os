-- ============================================================================
-- MIGRATION 147: SECURE CONSULTATION FOLLOW-UP APPOINTMENTS + FEE ENTITLEMENTS
--
-- Design:
--   A normal appointment is not a financial benefit.
--   A free/reduced follow-up is only created from a COMPLETED consultation
--   by the clinician who owns that consultation.
--
-- Flow:
--   completed consultation
--        -> doctor selects follow-up date/time
--        -> database matches the clinic's follow-up pricing policy
--        -> appointment + immutable financial entitlement are created
--        -> future check-in validates the entitlement server-side
--        -> consultation charge uses the authorized patient fee
--        -> entitlement is redeemed exactly once
--
-- Reception may still create ordinary appointments, but cannot manufacture
-- a follow-up discount by choosing an appointment type.
-- ============================================================================

create table if not exists consultation_followup_policies (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  min_days_after_consultation integer not null default 0 check (min_days_after_consultation >= 0),
  max_days_after_consultation integer not null check (max_days_after_consultation >= min_days_after_consultation),
  patient_fee_xaf numeric(12,2) not null check (patient_fee_xaf >= 0),
  is_active boolean not null default true,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, name)
);

create index if not exists idx_followup_policies_clinic_window
  on consultation_followup_policies (clinic_id, is_active, min_days_after_consultation, max_days_after_consultation);

create table if not exists appointment_fee_entitlements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete restrict,
  appointment_id uuid unique,
  source_visit_id uuid not null references visits(id) on delete restrict,
  source_consultation_id uuid not null references consultations(id) on delete restrict,
  policy_id uuid references consultation_followup_policies(id) on delete restrict,
  normal_fee_xaf numeric(12,2) not null check (normal_fee_xaf >= 0),
  authorized_patient_fee_xaf numeric(12,2) not null check (authorized_patient_fee_xaf >= 0),
  authorized_discount_xaf numeric(12,2) not null check (authorized_discount_xaf >= 0),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  status text not null default 'active'
    check (status in ('active','redeemed','expired','cancelled','revoked')),
  redeemed_visit_id uuid references visits(id) on delete set null,
  redeemed_by uuid references staff(id) on delete set null,
  redeemed_at timestamptz,
  created_by uuid not null references staff(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (valid_until >= valid_from),
  check (authorized_patient_fee_xaf <= normal_fee_xaf),
  check (authorized_discount_xaf = normal_fee_xaf - authorized_patient_fee_xaf)
);

create index if not exists idx_fee_entitlements_patient_status
  on appointment_fee_entitlements (clinic_id, patient_id, status, valid_from, valid_until);
create index if not exists idx_fee_entitlements_source_encounter
  on appointment_fee_entitlements (source_visit_id, source_consultation_id);

-- Link appointments to the clinical source and entitlement without making
-- either field mandatory for ordinary/new-patient appointments.
alter table appointments
  add column if not exists source_visit_id uuid references visits(id) on delete set null;
alter table appointments
  add column if not exists source_consultation_id uuid references consultations(id) on delete set null;
alter table appointments
  add column if not exists fee_entitlement_id uuid references appointment_fee_entitlements(id) on delete set null;

create index if not exists idx_appointments_source_visit
  on appointments (source_visit_id) where source_visit_id is not null;
create index if not exists idx_appointments_fee_entitlement
  on appointments (fee_entitlement_id) where fee_entitlement_id is not null;

-- Only one live appointment may consume an entitlement.
create unique index if not exists idx_one_active_appointment_per_entitlement
  on appointments (fee_entitlement_id)
  where fee_entitlement_id is not null and status in ('scheduled','arrived');

alter table consultation_followup_policies enable row level security;
alter table appointment_fee_entitlements enable row level security;

create policy consultation_followup_policies_select
  on consultation_followup_policies for select
  using (clinic_id = current_staff_clinic_id());

create policy consultation_followup_policies_admin_write
  on consultation_followup_policies for all
  using (
    clinic_id = current_staff_clinic_id()
    and current_staff_role() = 'admin'
  )
  with check (
    clinic_id = current_staff_clinic_id()
    and current_staff_role() = 'admin'
  );

create policy appointment_fee_entitlements_select
  on appointment_fee_entitlements for select
  using (clinic_id = current_staff_clinic_id());

-- No direct client INSERT/UPDATE policy is deliberately provided for
-- entitlements. Creation/redemption happens through SECURITY DEFINER RPCs
-- that enforce the clinical and financial invariants.

-- ---------------------------------------------------------------------------
-- Helper: find the policy that applies to a proposed follow-up date.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_consultation_followup_policy(
  p_clinic_id uuid,
  p_followup_date date,
  p_source_completed_at timestamptz
)
returns table (
  policy_id uuid,
  policy_name text,
  patient_fee_xaf numeric
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_days integer;
begin
  if p_followup_date is null or p_source_completed_at is null then
    return;
  end if;

  v_days := p_followup_date - (p_source_completed_at at time zone 'Africa/Douala')::date;

  return query
  select p.id, p.name, p.patient_fee_xaf
  from consultation_followup_policies p
  where p.clinic_id = p_clinic_id
    and p.is_active = true
    and v_days between p.min_days_after_consultation and p.max_days_after_consultation
  order by p.max_days_after_consultation asc, p.min_days_after_consultation desc, p.created_at asc
  limit 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Secure completion function.
--
-- The original function had six arguments. We remove that exact signature
-- and recreate it with two trailing optional follow-up arguments. Existing
-- six-argument callers continue to work because the final arguments default
-- to NULL, while the doctor workflow can now supply the follow-up date/time.
-- ---------------------------------------------------------------------------
drop function if exists public.complete_consultation(uuid, uuid, uuid, boolean, boolean, boolean);

authorize function public.complete_consultation(
  p_visit_id uuid,
  p_consultation_id uuid,
  p_staff_id uuid,
  p_has_prescription boolean,
  p_has_lab_order boolean default false,
  p_has_admission boolean default false,
  p_followup_date date default null,
  p_followup_time time default null,
  p_followup_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit record;
  v_consultation record;
  v_charge record;
  v_policy record;
  v_appointment_id uuid;
  v_entitlement_id uuid;
  v_scheduled_at timestamptz;
  v_days integer;
  v_patient_fee numeric(12,2);
  v_normal_fee numeric(12,2);
begin
  select * into v_visit
  from visits
  where id = p_visit_id
  for update;

  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'in_consultation' then
    raise exception 'Visit is not currently in consultation (status: %)', v_visit.status;
  end if;
  if v_visit.clinic_id <> current_staff_clinic_id() then
    raise exception 'Visit does not belong to the current clinic';
  end if;

  select * into v_consultation
  from consultations
  where id = p_consultation_id
    and visit_id = p_visit_id
    and clinic_id = v_visit.clinic_id
  for update;

  if v_consultation.id is null then
    raise exception 'Consultation % not found for this visit', p_consultation_id;
  end if;
  if v_consultation.doctor_id is not null and v_consultation.doctor_id <> p_staff_id then
    raise exception 'Only the clinician responsible for this consultation can schedule its follow-up';
  end if;
  if not exists (
    select 1 from staff
    where id = p_staff_id
      and clinic_id = v_visit.clinic_id
      and is_active = true
      and coalesce(active_role, role) in ('doctor','admin')
  ) then
    raise exception 'The completing clinician is not active in this clinic';
  end if;

  -- A follow-up is optional. If supplied, both date and time are required.
  if p_followup_date is not null or p_followup_time is not null then
    if p_followup_date is null or p_followup_time is null then
      raise exception 'Follow-up date and time must be supplied together';
    end if;
    v_scheduled_at := ((p_followup_date::text || ' ' || p_followup_time::text)::timestamp at time zone 'Africa/Douala');
    if v_scheduled_at <= now() then
      raise exception 'Follow-up appointment must be in the future';
    end if;
  end if;

  update consultations
  set completed_at = now()
  where id = p_consultation_id;

  -- Create the follow-up only after the consultation has been completed,
  -- inside the same database transaction. If anything fails, neither the
  -- completion nor the appointment/entitlement is committed.
  if v_scheduled_at is not null then
    select sc.id, sc.service_price_id, sc.amount_xaf
      into v_charge
    from service_charges sc
    where sc.visit_id = p_visit_id
      and sc.clinic_id = v_visit.clinic_id
      and sc.category = 'consultation'
      and sc.status <> 'void'
    order by sc.created_at asc
    limit 1;

    if v_charge.id is null then
      raise exception 'Cannot schedule follow-up: source consultation charge was not found';
    end if;

    v_normal_fee := coalesce(v_charge.amount_xaf, 0);

    select * into v_policy
    from resolve_consultation_followup_policy(
      v_visit.clinic_id,
      p_followup_date,
      now()
    )
    limit 1;

    -- No matching policy means this is still a valid ordinary follow-up
    -- appointment, but it receives no special financial entitlement.
    if v_policy.policy_id is not null then
      v_patient_fee := least(v_normal_fee, greatest(0, v_policy.patient_fee_xaf));
    else
      v_patient_fee := v_normal_fee;
    end if;

    insert into appointments (
      clinic_id,
      patient_id,
      doctor_id,
      service_price_id,
      scheduled_at,
      duration_minutes,
      reason,
      status,
      created_by,
      source_visit_id,
      source_consultation_id
    ) values (
      v_visit.clinic_id,
      v_visit.patient_id,
      p_staff_id,
      v_charge.service_price_id,
      v_scheduled_at,
      30,
      coalesce(nullif(trim(p_followup_reason), ''), 'Clinical follow-up'),
      'scheduled',
      p_staff_id,
      p_visit_id,
      p_consultation_id
    )
    returning id into v_appointment_id;

    if v_policy.policy_id is not null and v_patient_fee < v_normal_fee then
      insert into appointment_fee_entitlements (
        clinic_id,
        patient_id,
        appointment_id,
        source_visit_id,
        source_consultation_id,
        policy_id,
        normal_fee_xaf,
        authorized_patient_fee_xaf,
        authorized_discount_xaf,
        valid_from,
        valid_until,
        status,
        created_by
      ) values (
        v_visit.clinic_id,
        v_visit.patient_id,
        v_appointment_id,
        p_visit_id,
        p_consultation_id,
        v_policy.policy_id,
        v_normal_fee,
        v_patient_fee,
        v_normal_fee - v_patient_fee,
        v_scheduled_at,
        v_scheduled_at + interval '30 minutes',
        'active',
        p_staff_id
      )
      returning id into v_entitlement_id;

      update appointments
      set fee_entitlement_id = v_entitlement_id
      where id = v_appointment_id;
    end if;

    insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
    values (
      v_visit.clinic_id,
      p_staff_id,
      'appointment.followup_scheduled',
      'appointment',
      v_appointment_id,
      jsonb_build_object(
        'source_visit_id', p_visit_id,
        'source_consultation_id', p_consultation_id,
        'policy_id', v_policy.policy_id,
        'normal_fee_xaf', v_normal_fee,
        'authorized_patient_fee_xaf', v_patient_fee,
        'authorized_discount_xaf', v_normal_fee - v_patient_fee,
        'scheduled_at', v_scheduled_at,
        'entitlement_id', v_entitlement_id
      )
    );
  end if;

  if not p_has_admission then
    update visits set status = case
      when p_has_lab_order then 'waiting_lab'
      when p_has_prescription then 'waiting_pharmacy'
      else 'discharged'
    end::visit_status
    where id = p_visit_id;
  end if;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    v_visit.clinic_id,
    p_staff_id,
    'visit.consultation_completed',
    'visit',
    p_visit_id,
    jsonb_build_object(
      'has_prescription', p_has_prescription,
      'has_lab_order', p_has_lab_order,
      'has_admission', p_has_admission,
      'followup_scheduled', v_scheduled_at is not null,
      'followup_appointment_id', v_appointment_id,
      'followup_entitlement_id', v_entitlement_id
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Secure check-in registration.
--
-- This replaces the existing five-argument registration function with an
-- appointment-aware version. The appointment is never trusted merely because
-- the client supplied its ID: patient, clinic, status, and entitlement are
-- checked in the database. The charge amount is determined server-side.
-- ---------------------------------------------------------------------------
drop function if exists public.register_visit_with_charge(uuid, uuid, text, uuid, uuid);

create or replace function public.register_visit_with_charge(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_visit_reason text,
  p_service_price_id uuid,
  p_registered_by uuid,
  p_appointment_id uuid default null
)
returns table (visit_id uuid, service_charge_id uuid, amount_xaf numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit_id uuid;
  v_charge_id uuid;
  v_amount numeric(10,2);
  v_service_name text;
  v_service_price_id uuid;
  v_appointment record;
  v_entitlement record;
  v_patient_fee numeric(10,2);
  v_normal_fee numeric(10,2);
  v_policy_expired boolean := false;
begin
  if not exists (
    select 1 from staff
    where id = p_registered_by
      and clinic_id = p_clinic_id
      and is_active = true
  ) then
    raise exception 'Registering staff member is not active in this clinic';
  end if;

  select sp.id, sp.price_xaf, sp.service_name
    into v_service_price_id, v_amount, v_service_name
  from service_prices sp
  where sp.id = p_service_price_id
    and sp.clinic_id = p_clinic_id
    and sp.is_active = true;

  if v_service_price_id is null then
    raise exception 'Service price % not found or inactive for this clinic', p_service_price_id;
  end if;

  v_normal_fee := v_amount;
  v_service_price_id := p_service_price_id;

  if p_appointment_id is not null then
    select a.* into v_appointment
    from appointments a
    where a.id = p_appointment_id
      and a.clinic_id = p_clinic_id
      and a.patient_id = p_patient_id
      and a.status = 'scheduled'
    for update;

    if v_appointment.id is null then
      raise exception 'Appointment is invalid, cancelled, already used, or belongs to another patient/clinic';
    end if;

    if v_appointment.scheduled_at < now() - interval '24 hours' then
      raise exception 'This appointment is too old to be used for check-in';
    end if;

    if v_appointment.service_price_id is not null and v_appointment.service_price_id <> p_service_price_id then
      raise exception 'The selected consultation type does not match the appointment';
    end if;

    if v_appointment.fee_entitlement_id is not null then
      select * into v_entitlement
      from appointment_fee_entitlements e
      where e.id = v_appointment.fee_entitlement_id
        and e.clinic_id = p_clinic_id
        and e.patient_id = p_patient_id
      for update;

      if v_entitlement.id is null then
        raise exception 'Appointment has an invalid financial entitlement';
      end if;
      if v_entitlement.status <> 'active' then
        raise exception 'This appointment financial entitlement has already been used or cancelled';
      end if;
      if now() < v_entitlement.valid_from then
        raise exception 'This appointment financial entitlement is not active yet';
      end if;
      if now() > v_entitlement.valid_until then
        update appointment_fee_entitlements set status = 'expired' where id = v_entitlement.id;
        raise exception 'This appointment financial entitlement has expired';
      end if;

      v_patient_fee := least(v_normal_fee, greatest(0, v_entitlement.authorized_patient_fee_xaf));
    else
      v_patient_fee := v_normal_fee;
    end if;
  else
    v_patient_fee := v_normal_fee;
  end if;

  begin
    insert into visits (clinic_id, patient_id, visit_reason, status, registered_by)
    values (p_clinic_id, p_patient_id, p_visit_reason, 'registered', p_registered_by)
    returning id into v_visit_id;
  exception
    when unique_violation then
      raise exception 'This patient already has an active visit in progress — check the queue rather than starting a new one';
  end;

  v_charge_id := create_service_charge(
    p_clinic_id,
    p_patient_id,
    v_visit_id,
    v_service_price_id,
    'consultation',
    v_service_name,
    v_patient_fee,
    p_registered_by
  );

  if p_appointment_id is not null and v_entitlement.id is not null then
    update appointment_fee_entitlements
    set status = 'redeemed',
        redeemed_visit_id = v_visit_id,
        redeemed_by = p_registered_by,
        redeemed_at = now()
    where id = v_entitlement.id
      and status = 'active';

    if not found then
      raise exception 'The appointment financial entitlement was redeemed by another transaction';
    end if;

    update appointments
    set status = 'arrived', visit_id = v_visit_id
    where id = p_appointment_id
      and status = 'scheduled';

    if not found then
      raise exception 'The appointment could not be marked as arrived';
    end if;
  elsif p_appointment_id is not null then
    update appointments
    set status = 'arrived', visit_id = v_visit_id
    where id = p_appointment_id
      and status = 'scheduled';

    if not found then
      raise exception 'The appointment could not be marked as arrived';
    end if;
  end if;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    p_clinic_id,
    p_registered_by,
    'billing.consultation_charge_created',
    'service_charge',
    v_charge_id,
    jsonb_build_object(
      'visit_id', v_visit_id,
      'appointment_id', p_appointment_id,
      'entitlement_id', v_entitlement.id,
      'normal_fee_xaf', v_normal_fee,
      'authorized_patient_fee_xaf', v_patient_fee,
      'discount_xaf', v_normal_fee - v_patient_fee
    )
  );

  return query select v_visit_id, v_charge_id, v_patient_fee;
end;
$$;

-- ---------------------------------------------------------------------------
-- Convenience read RPC for the doctor UI. It exposes only the current
-- clinic's policy options and never accepts a client-supplied discount.
-- ---------------------------------------------------------------------------
create or replace function public.get_consultation_followup_policies()
returns table (
  id uuid,
  name text,
  min_days_after_consultation integer,
  max_days_after_consultation integer,
  patient_fee_xaf numeric,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.min_days_after_consultation,
         p.max_days_after_consultation, p.patient_fee_xaf, p.is_active
  from consultation_followup_policies p
  where p.clinic_id = current_staff_clinic_id()
  order by p.max_days_after_consultation, p.min_days_after_consultation, p.name;
$$;

-- ---------------------------------------------------------------------------
-- Audit/report view for owners/admins: every discounted follow-up can be
-- traced to its source encounter and clinician.
-- ---------------------------------------------------------------------------
create or replace view public.consultation_followup_financial_audit as
select
  e.id as entitlement_id,
  e.clinic_id,
  e.patient_id,
  pt.full_name as patient_name,
  e.source_visit_id,
  e.source_consultation_id,
  e.appointment_id,
  a.scheduled_at,
  e.policy_id,
  p.name as policy_name,
  e.normal_fee_xaf,
  e.authorized_patient_fee_xaf,
  e.authorized_discount_xaf,
  e.status,
  e.redeemed_visit_id,
  e.redeemed_by,
  rb.full_name as redeemed_by_name,
  e.redeemed_at,
  e.created_by,
  cb.full_name as created_by_name,
  e.created_at
from appointment_fee_entitlements e
join patients pt on pt.id = e.patient_id
left join appointments a on a.id = e.appointment_id
left join consultation_followup_policies p on p.id = e.policy_id
left join staff rb on rb.id = e.redeemed_by
left join staff cb on cb.id = e.created_by;

comment on table appointment_fee_entitlements is
  'Immutable financial authorization generated from a completed clinical consultation; not created by reception.';
comment on table consultation_followup_policies is
  'Clinic-configured follow-up fee rules. These determine patient liability; the cashier never chooses the discount.';
