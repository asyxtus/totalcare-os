-- ============================================================================
-- MIGRATION 148: FIX APPOINTMENT ENTITLEMENT GUARD
--
-- 147 introduced appointment-aware registration. This patch initializes the
-- entitlement record explicitly so ordinary walk-in registrations never try
-- to read an unassigned RECORD variable.
--
-- IMPORTANT: Some installations may have attempted to run this migration
-- directly before 147 was successfully applied. The prerequisite DDL below is
-- therefore idempotent. If 147 already ran, these statements are no-ops.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Ensure the 147 entitlement schema exists before the registration function
-- can reference it. This makes 148 safe to rerun after a partial migration.
-- ---------------------------------------------------------------------------
create table if not exists public.appointment_fee_entitlements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  appointment_id uuid unique,
  source_visit_id uuid not null references public.visits(id) on delete restrict,
  source_consultation_id uuid not null references public.consultations(id) on delete restrict,
  policy_id uuid references public.consultation_followup_policies(id) on delete restrict,
  normal_fee_xaf numeric(12,2) not null check (normal_fee_xaf >= 0),
  authorized_patient_fee_xaf numeric(12,2) not null check (authorized_patient_fee_xaf >= 0),
  authorized_discount_xaf numeric(12,2) not null check (authorized_discount_xaf >= 0),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  status text not null default 'active'
    check (status in ('active','redeemed','expired','cancelled','revoked')),
  redeemed_visit_id uuid references public.visits(id) on delete set null,
  redeemed_by uuid references public.staff(id) on delete set null,
  redeemed_at timestamptz,
  created_by uuid not null references public.staff(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (valid_until >= valid_from),
  check (authorized_patient_fee_xaf <= normal_fee_xaf),
  check (authorized_discount_xaf = normal_fee_xaf - authorized_patient_fee_xaf)
);

alter table public.appointments
  add column if not exists fee_entitlement_id uuid
    references public.appointment_fee_entitlements(id) on delete set null;

alter table public.appointments
  add column if not exists source_visit_id uuid
    references public.visits(id) on delete set null;

alter table public.appointments
  add column if not exists source_consultation_id uuid
    references public.consultations(id) on delete set null;

create index if not exists idx_fee_entitlements_patient_status
  on public.appointment_fee_entitlements (clinic_id, patient_id, status, valid_from, valid_until);

create index if not exists idx_fee_entitlements_source_encounter
  on public.appointment_fee_entitlements (source_visit_id, source_consultation_id);

create index if not exists idx_appointments_fee_entitlement
  on public.appointments (fee_entitlement_id)
  where fee_entitlement_id is not null;

create index if not exists idx_appointments_source_visit
  on public.appointments (source_visit_id)
  where source_visit_id is not null;

alter table public.appointment_fee_entitlements enable row level security;

-- ---------------------------------------------------------------------------
-- Replace the appointment-aware registration RPC.
-- ---------------------------------------------------------------------------
drop function if exists public.register_visit_with_charge(uuid, uuid, text, uuid, uuid, uuid);

create function public.register_visit_with_charge(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_visit_reason text,
  p_service_price_id uuid,
  p_registered_by uuid,
  p_appointment_id uuid default null
)
returns table (visit_id uuid, service_charge_id uuid, amount_xaf numeric)
language plpgsql security definer set search_path = public
as $$
declare
  v_visit_id uuid;
  v_charge_id uuid;
  v_amount numeric(10,2);
  v_service_name text;
  v_appointment record;
  v_entitlement record;
  v_patient_fee numeric(10,2);
  v_has_entitlement boolean := false;
begin
  if not exists (
    select 1 from staff s
    where s.id = p_registered_by
      and s.clinic_id = p_clinic_id
      and s.is_active = true
  ) then
    raise exception 'Registering staff member is not active in this clinic';
  end if;

  select sp.price_xaf, sp.service_name
    into v_amount, v_service_name
  from service_prices sp
  where sp.id = p_service_price_id
    and sp.clinic_id = p_clinic_id
    and sp.is_active = true;

  if v_amount is null then
    raise exception 'Service price % not found or inactive for this clinic', p_service_price_id;
  end if;
  v_patient_fee := v_amount;

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

    if v_appointment.service_price_id is not null
       and v_appointment.service_price_id <> p_service_price_id then
      raise exception 'The selected consultation type does not match the appointment';
    end if;

    if v_appointment.fee_entitlement_id is not null then
      select e.* into v_entitlement
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
        update appointment_fee_entitlements
        set status = 'expired'
        where id = v_entitlement.id;
        raise exception 'This appointment financial entitlement has expired';
      end if;

      v_patient_fee := least(v_amount, greatest(0, v_entitlement.authorized_patient_fee_xaf));
      v_has_entitlement := true;
    end if;
  end if;

  begin
    insert into visits (clinic_id, patient_id, visit_reason, status, registered_by)
    values (p_clinic_id, p_patient_id, p_visit_reason, 'registered', p_registered_by)
    returning id into v_visit_id;
  exception when unique_violation then
    raise exception 'This patient already has an active visit in progress — check the queue rather than starting a new one';
  end;

  v_charge_id := create_service_charge(
    p_clinic_id,
    p_patient_id,
    v_visit_id,
    p_service_price_id,
    'consultation',
    v_service_name,
    v_patient_fee,
    p_registered_by
  );

  if p_appointment_id is not null then
    update appointments
    set status = 'arrived', visit_id = v_visit_id
    where id = p_appointment_id
      and status = 'scheduled';
    if not found then
      raise exception 'The appointment could not be marked as arrived';
    end if;
  end if;

  if v_has_entitlement then
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
      'entitlement_id', case when v_has_entitlement then v_entitlement.id else null end,
      'normal_fee_xaf', v_amount,
      'patient_fee_xaf', v_patient_fee,
      'discount_xaf', v_amount - v_patient_fee
    )
  );

  return query select v_visit_id, v_charge_id, v_patient_fee;
end;
$$;
