-- ============================================================================
-- MIGRATION 149: FOLLOW-UP CHECK-IN STABILITY
--
-- Replaces the stale appointment-aware registration RPC. The previous version
-- could dereference v_entitlement when no entitlement existed, producing:
--   record "v_entitlement" is not assigned yet
--
-- This migration is intentionally rerunnable. CREATE OR REPLACE avoids a
-- dependency problem caused by dropping an RPC that may already be referenced.
-- ============================================================================

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

    -- Only inspect the entitlement after a real entitlement row has been
    -- selected. Ordinary appointments may legitimately have none.
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

      v_patient_fee := least(
        v_amount,
        greatest(0, v_entitlement.authorized_patient_fee_xaf)
      );
      v_has_entitlement := true;
    end if;
  end if;

  begin
    insert into visits (
      clinic_id, patient_id, visit_reason, status, registered_by
    ) values (
      p_clinic_id, p_patient_id, p_visit_reason, 'registered', p_registered_by
    ) returning id into v_visit_id;
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

  insert into audit_log (
    clinic_id, staff_id, action, entity_type, entity_id, details
  ) values (
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
