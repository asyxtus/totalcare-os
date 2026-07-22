-- ============================================================================
-- ADD CHARGE — role-gated manual charge for legitimate fees that don't
-- fit consultation/lab/pharmacy (medical certificates, photocopies,
-- ambulance runs). Confirmed category is plain text, not an enum, so
-- 'other' is safe to introduce with zero migration risk. Restricted to
-- admin/receptionist/billing_clerk — this bypasses the normal "charge
-- comes from a real clinical/pharmacy event" pattern, so it needs its
-- own guardrails: role gate, mandatory description, full audit trail.
-- ============================================================================

create or replace function add_manual_charge(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_description text,
  p_amount_xaf numeric,
  p_created_by uuid,
  p_visit_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_charge_id uuid;
  v_invoice_id uuid;
  v_creator_role staff_role;
begin
  select role into v_creator_role from staff
    where id = p_created_by and clinic_id = p_clinic_id and is_active = true;
  if v_creator_role is null then
    raise exception 'Staff member not found or inactive in this clinic';
  end if;
  if v_creator_role not in ('admin', 'receptionist', 'billing_clerk') then
    raise exception 'Only admin, receptionist, or billing staff can add a manual charge, got %', v_creator_role;
  end if;

  if not exists (select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id) then
    raise exception 'Patient does not belong to this clinic';
  end if;

  if p_description is null or trim(p_description) = '' then
    raise exception 'A description is required for a manual charge';
  end if;
  if p_amount_xaf is null or p_amount_xaf <= 0 then
    raise exception 'Amount must be positive';
  end if;

  if p_visit_id is not null and not exists (
    select 1 from visits where id = p_visit_id and clinic_id = p_clinic_id and patient_id = p_patient_id
  ) then
    raise exception 'Visit does not belong to this patient in this clinic';
  end if;

  v_charge_id := create_service_charge(
    p_clinic_id, p_patient_id, p_visit_id, null, 'other', p_description, p_amount_xaf, p_created_by
  );

  v_invoice_id := open_invoice_for_charge(v_charge_id, p_created_by);

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_created_by, 'billing.manual_charge_added', 'service_charge', v_charge_id,
    jsonb_build_object('description', p_description, 'amount_xaf', p_amount_xaf, 'visit_id', p_visit_id));

  return v_charge_id;
end;
$$;
