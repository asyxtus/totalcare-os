-- ============================================================================
-- MIGRATION 148: HARDEN CONSULTATION FOLLOW-UP ENTITLEMENTS
--
-- 1. The scheduling RPC must be called by the clinician represented by
--    p_doctor_id. Passing another doctor's ID is not sufficient authorization.
-- 2. A scheduled follow-up entitlement remains redeemable for 24 hours after
--    the appointment time, allowing reasonable late arrival/check-in while
--    remaining tightly scoped to the scheduled appointment.
-- ============================================================================

create or replace function public.schedule_followup_from_consultation(
  p_visit_id uuid,
  p_consultation_id uuid,
  p_doctor_id uuid,
  p_followup_date date,
  p_followup_time time,
  p_reason text default null
)
returns table (appointment_id uuid, entitlement_id uuid, normal_fee_xaf numeric, patient_fee_xaf numeric, discount_xaf numeric)
language plpgsql security definer set search_path = public
as $$
declare
  v_visit record;
  v_consultation record;
  v_charge record;
  v_policy record;
  v_appointment_id uuid;
  v_entitlement_id uuid;
  v_scheduled_at timestamptz;
  v_normal_fee numeric(12,2);
  v_patient_fee numeric(12,2);
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then raise exception 'Visit % not found', p_visit_id; end if;
  if v_visit.clinic_id <> current_staff_clinic_id() then raise exception 'Visit does not belong to the current clinic'; end if;

  -- SECURITY: the authenticated staff member must be the clinician passed to
  -- this RPC. A receptionist/admin cannot impersonate another doctor by
  -- supplying that doctor's staff ID from the browser.
  if not exists (
    select 1
    from staff s
    where s.id = p_doctor_id
      and s.auth_user_id = auth.uid()
      and s.clinic_id = v_visit.clinic_id
      and s.is_active = true
      and coalesce(s.active_role, s.role) in ('doctor', 'admin')
  ) then
    raise exception 'Only the authenticated clinician may schedule this follow-up';
  end if;

  select * into v_consultation
  from consultations
  where id = p_consultation_id and visit_id = p_visit_id and clinic_id = v_visit.clinic_id
  for update;
  if v_consultation.id is null then raise exception 'Consultation % not found for this visit', p_consultation_id; end if;
  if v_consultation.completed_at is null then raise exception 'The consultation must be completed before scheduling a follow-up'; end if;
  if v_consultation.doctor_id is not null and v_consultation.doctor_id <> p_doctor_id then
    raise exception 'Only the clinician responsible for this consultation can schedule its follow-up';
  end if;

  if p_followup_date is null or p_followup_time is null then raise exception 'Follow-up date and time are required'; end if;
  v_scheduled_at := ((p_followup_date::text || ' ' || p_followup_time::text)::timestamp at time zone 'Africa/Douala');
  if v_scheduled_at <= now() then raise exception 'Follow-up appointment must be in the future'; end if;

  select sc.id, sc.service_price_id, sc.amount_xaf
    into v_charge
  from service_charges sc
  where sc.visit_id = p_visit_id and sc.clinic_id = v_visit.clinic_id
    and sc.category = 'consultation' and sc.status <> 'void'
  order by sc.created_at asc limit 1;
  if v_charge.id is null then raise exception 'Source consultation charge was not found'; end if;

  v_normal_fee := coalesce(v_charge.amount_xaf, 0);
  select * into v_policy
  from resolve_consultation_followup_policy(v_visit.clinic_id, p_followup_date, v_consultation.completed_at)
  limit 1;
  v_patient_fee := v_normal_fee;
  if v_policy.policy_id is not null then
    v_patient_fee := least(v_normal_fee, greatest(0, v_policy.patient_fee_xaf));
  end if;

  insert into appointments (
    clinic_id, patient_id, doctor_id, service_price_id, scheduled_at, duration_minutes,
    reason, status, created_by, source_visit_id, source_consultation_id
  ) values (
    v_visit.clinic_id, v_visit.patient_id, p_doctor_id, v_charge.service_price_id,
    v_scheduled_at, 30, coalesce(nullif(trim(p_reason), ''), 'Clinical follow-up'),
    'scheduled', p_doctor_id, p_visit_id, p_consultation_id
  ) returning id into v_appointment_id;

  if v_policy.policy_id is not null and v_patient_fee < v_normal_fee then
    insert into appointment_fee_entitlements (
      clinic_id, patient_id, appointment_id, source_visit_id, source_consultation_id,
      policy_id, normal_fee_xaf, authorized_patient_fee_xaf, authorized_discount_xaf,
      valid_from, valid_until, status, created_by
    ) values (
      v_visit.clinic_id, v_visit.patient_id, v_appointment_id, p_visit_id, p_consultation_id,
      v_policy.policy_id, v_normal_fee, v_patient_fee, v_normal_fee - v_patient_fee,
      v_scheduled_at, v_scheduled_at + interval '24 hours', 'active', p_doctor_id
    ) returning id into v_entitlement_id;

    update appointments set fee_entitlement_id = v_entitlement_id where id = v_appointment_id;
  end if;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    v_visit.clinic_id, p_doctor_id, 'appointment.followup_scheduled', 'appointment', v_appointment_id,
    jsonb_build_object(
      'source_visit_id', p_visit_id,
      'source_consultation_id', p_consultation_id,
      'policy_id', v_policy.policy_id,
      'normal_fee_xaf', v_normal_fee,
      'authorized_patient_fee_xaf', v_patient_fee,
      'authorized_discount_xaf', v_normal_fee - v_patient_fee,
      'scheduled_at', v_scheduled_at,
      'entitlement_id', v_entitlement_id,
      'entitlement_valid_until', case when v_entitlement_id is not null then v_scheduled_at + interval '24 hours' else null end
    )
  );

  return query select v_appointment_id, v_entitlement_id, v_normal_fee, v_patient_fee, v_normal_fee - v_patient_fee;
end;
$$;

-- Existing entitlements created by migration 147 were only valid for 30
-- minutes. Extend still-active future entitlements so legitimate late check-in
-- does not unexpectedly lose the follow-up benefit.
update appointment_fee_entitlements
set valid_until = valid_from + interval '24 hours'
where status = 'active'
  and valid_until = valid_from + interval '30 minutes';
