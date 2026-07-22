-- ============================================================================
-- PATCH: RESTRICT WHO CAN TRANSFER A PATIENT TO A DIFFERENT DOCTOR
-- Confirmed roles: receptionist, doctor, admin. Anyone else (nurse,
-- pharmacist, billing_clerk, lab_technician, auditor) is refused.
-- ============================================================================

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
  v_requester_role staff_role;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'waiting_consultation' then
    raise exception 'Can only transfer a patient who is waiting and not yet in consultation (currently: %)', v_visit.status;
  end if;

  select role into v_requester_role from staff
    where id = p_staff_id and clinic_id = v_visit.clinic_id and is_active = true;
  if v_requester_role is null then
    raise exception 'Requesting staff member not found or inactive in this clinic';
  end if;
  if v_requester_role not in ('receptionist', 'doctor', 'admin') then
    raise exception 'Only receptionists, doctors, or admins can transfer a patient, got %', v_requester_role;
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
