-- ============================================================================
-- MIGRATION 150: REPLACE CHECK-IN RPC WITHOUT PLPGSQL RECORD VARIABLES
--
-- This is a definitive replacement for the appointment-aware check-in RPC.
-- It removes both legacy overloads and uses scalar variables only, eliminating
-- any possibility of the PostgreSQL error:
--   record "v_entitlement" is not assigned yet
--
-- The application always supplies p_appointment_id, so the 6-argument RPC is
-- the canonical function. The default remains for compatibility with callers
-- that omit the appointment argument.
-- ============================================================================

drop function if exists public.register_visit_with_charge(uuid, uuid, text, uuid, uuid, uuid);
drop function if exists public.register_visit_with_charge(uuid, uuid, text, uuid, uuid);

create function public.register_visit_with_charge(
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
  v_patient_fee numeric(10,2);

  -- Appointment fields are scalar values; no RECORD variables are used.
  v_appointment_exists boolean := false;
  v_appointment_clinic_id uuid;
  v_appointment_patient_id uuid;
  v_appointment_status text;
  v_appointment_scheduled_at timestamptz;
  v_appointment_service_price_id uuid;
  v_appointment_entitlement_id uuid;

  -- Entitlement fields are scalar values; no RECORD variables are used.
  v_entitlement_exists boolean := false;
  v_entitlement_status text;
  v_entitlement_valid_from timestamptz;
  v_entitlement_valid_until timestamptz;
  v_entitlement_patient_fee numeric(12,2);
  v_entitlement_id uuid;
  v_has_entitlement boolean := false;
begin
  if not exists (
    select 1
    from staff s
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
    select
      a.clinic_id,
      a.patient_id,
      a.status,
      a.scheduled_at,
      a.service_price_id,
      a.fee_entitlement_id
    into
      v_appointment_clinic_id,
      v_appointment_patient_id,
      v_appointment_status,
      v_appointment_scheduled_at,
      v_appointment_service_price_id,
      v_appointment_entitlement_id
    from appointments a
    where a.id = p_appointment_id
    for update;

    v_appointment_exists := found;

    if not v_appointment_exists
       or v_appointment_clinic_id <> p_clinic_id
       or v_appointment_patient_id <> p_patient_id
       or v_appointment_status <> 'scheduled' then
      raise exception 'Appointment is invalid, cancelled, already used, or belongs to another patient/clinic';
    end if;

    if v_appointment_scheduled_at < now() - interval '24 hours' then
      raise exception 'This appointment is too old to be used for check-in';
    end if;

    if v_appointment_service_price_id is not null
       and v_appointment_service_price_id <> p_service_price_id then
      raise exception 'The selected consultation type does not match the appointment';
    end if;

    if v_appointment_entitlement_id is not null then
      select
        e.id,
        e.status,
        e.valid_from,
        e.valid_until,
        e.authorized_patient_fee_xaf
      into
        v_entitlement_id,
        v_entitlement_status,
        v_entitlement_valid_from,
        v_entitlement_valid_until,
        v_entitlement_patient_fee
      from appointment_fee_entitlements e
      where e.id = v_appointment_entitlement_id
        and e.clinic_id = p_clinic_id
        and e.patient_id = p_patient_id
      for update;

      v_entitlement_exists := found;

      if not v_entitlement_exists then
        raise exception 'Appointment has an invalid financial entitlement';
      end if;

      if v_entitlement_status <> 'active' then
        raise exception 'This appointment financial entitlement has already been used or cancelled';
      end if;

      if now() < v_entitlement_valid_from then
        raise exception 'This appointment financial entitlement is not active yet';
      end if;

      if now() > v_entitlement_valid_until then
        update appointment_fee_entitlements
        set status = 'expired'
        where id = v_entitlement_id;
        raise exception 'This appointment financial entitlement has expired';
      end if;

      v_patient_fee := least(
        v_amount,
        greatest(0, v_entitlement_patient_fee)
      );
      v_has_entitlement := true;
    end if;
  end if;

  begin
    insert into visits (
      clinic_id,
      patient_id,
      visit_reason,
      status,
      registered_by
    ) values (
      p_clinic_id,
      p_patient_id,
      p_visit_reason,
      'registered',
      p_registered_by
    )
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
    set status = 'arrived',
        visit_id = v_visit_id
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
    where id = v_entitlement_id
      and status = 'active';

    if not found then
      raise exception 'The appointment financial entitlement was redeemed by another transaction';
    end if;
  end if;

  insert into audit_log (
    clinic_id,
    staff_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    p_clinic_id,
    p_registered_by,
    'billing.consultation_charge_created',
    'service_charge',
    v_charge_id,
    jsonb_build_object(
      'visit_id', v_visit_id,
      'appointment_id', p_appointment_id,
      'entitlement_id', case when v_has_entitlement then v_entitlement_id else null end,
      'normal_fee_xaf', v_amount,
      'patient_fee_xaf', v_patient_fee,
      'discount_xaf', v_amount - v_patient_fee
    )
  );

  return query
  select v_visit_id, v_charge_id, v_patient_fee;
end;
$$;
