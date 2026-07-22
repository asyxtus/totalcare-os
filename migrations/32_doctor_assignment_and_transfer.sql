-- ============================================================================
-- DOCTOR ASSIGNMENT + TRANSFER
-- Reception can now assign a specific doctor at check-in time, not just
-- leave every patient in a shared pool. Once assigned, only that doctor
-- can start the consultation — unless the patient is transferred to a
-- different doctor first, which is only possible before consultation
-- actually begins (status = 'waiting_consultation'). An unassigned
-- patient still works exactly as before: any available doctor can pick
-- them up from the shared queue.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. register_visit_with_charge gains an optional doctor assignment
-- ----------------------------------------------------------------------------
create or replace function register_visit_with_charge(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_visit_reason text,
  p_service_price_id uuid,
  p_registered_by uuid,
  p_assigned_doctor_id uuid default null
)
returns table (visit_id uuid, service_charge_id uuid, amount_xaf numeric)
language plpgsql
as $$
declare
  v_visit_id uuid;
  v_charge_id uuid;
  v_amount numeric(10,2);
  v_service_name text;
begin
  select price_xaf, service_name into v_amount, v_service_name
  from service_prices where id = p_service_price_id and clinic_id = p_clinic_id;

  if v_amount is null then
    raise exception 'Service price % not found for this clinic', p_service_price_id;
  end if;

  if p_assigned_doctor_id is not null and not exists (
    select 1 from staff where id = p_assigned_doctor_id and clinic_id = p_clinic_id
      and role = 'doctor' and is_active = true
  ) then
    raise exception 'Selected doctor not found or inactive in this clinic';
  end if;

  begin
    insert into visits (clinic_id, patient_id, visit_reason, status, registered_by, assigned_doctor_id)
    values (p_clinic_id, p_patient_id, p_visit_reason, 'registered', p_registered_by, p_assigned_doctor_id)
    returning id into v_visit_id;
  exception
    when unique_violation then
      raise exception 'This patient already has an active visit in progress — check the queue rather than starting a new one';
  end;

  v_charge_id := create_service_charge(
    p_clinic_id, p_patient_id, v_visit_id, p_service_price_id,
    'consultation', v_service_name, v_amount, p_registered_by
  );

  return query select v_visit_id, v_charge_id, v_amount;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. start_consultation now respects a pre-existing assignment — if
-- reception assigned this patient to Dr. X, only Dr. X (or admin) can
-- actually start seeing them. An unassigned patient works as before:
-- whoever clicks first claims it.
-- ----------------------------------------------------------------------------
create or replace function start_consultation(
  p_visit_id uuid,
  p_doctor_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_visit record;
  v_consultation_id uuid;
  v_doctor_role staff_role;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'waiting_consultation' then
    raise exception 'Visit is not waiting for consultation (currently: %)', v_visit.status;
  end if;

  if v_visit.assigned_doctor_id is not null and v_visit.assigned_doctor_id <> p_doctor_id then
    select role into v_doctor_role from staff where id = p_doctor_id and clinic_id = v_visit.clinic_id;
    if v_doctor_role <> 'admin' then
      raise exception 'This patient is assigned to a different doctor';
    end if;
  end if;

  update visits set status = 'in_consultation', assigned_doctor_id = p_doctor_id where id = p_visit_id;

  insert into consultations (clinic_id, visit_id, doctor_id, started_at)
  values (v_visit.clinic_id, p_visit_id, p_doctor_id, now())
  returning id into v_consultation_id;

  return v_consultation_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. transfer_patient_to_doctor — reassign a WAITING (not yet consulted)
-- patient to a different doctor. Deliberately refuses once the visit is
-- already in_consultation — that's a mid-consultation handoff, a
-- different and harder problem, out of scope here.
-- ----------------------------------------------------------------------------
create or replace function transfer_patient_to_doctor(
  p_visit_id uuid,
  p_new_doctor_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
as $$
declare
  v_visit record;
  v_new_doctor_role staff_role;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'waiting_consultation' then
    raise exception 'Can only transfer a patient who is waiting and not yet in consultation (currently: %)', v_visit.status;
  end if;

  select role into v_new_doctor_role from staff
    where id = p_new_doctor_id and clinic_id = v_visit.clinic_id and is_active = true;
  if v_new_doctor_role is null then
    raise exception 'Selected doctor not found or inactive in this clinic';
  end if;
  if v_new_doctor_role <> 'doctor' then
    raise exception 'Can only transfer to a doctor, got %', v_new_doctor_role;
  end if;

  update visits set assigned_doctor_id = p_new_doctor_id where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_visit.clinic_id, p_staff_id, 'visit.transferred_to_doctor', 'visit', p_visit_id,
    jsonb_build_object('new_doctor_id', p_new_doctor_id, 'previous_doctor_id', v_visit.assigned_doctor_id));
end;
$$;
