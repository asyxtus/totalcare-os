-- 164_advance_encounter_status.sql
-- Controlled, idempotent encounter status advancement.
-- The journey resolver remains read-only; module completion workflows may call this function.

create or replace function public.advance_encounter_status(p_visit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit record;
  v_lab_count integer := 0;
  v_lab_completed integer := 0;
  v_prescription_count integer := 0;
  v_remaining_quantity integer := 0;
  v_outstanding numeric := 0;
  v_old_status text;
  v_new_status text;
begin
  select id, status::text as status, clinic_id, patient_id
    into v_visit
  from public.visits
  where id = p_visit_id
  for update;

  if not found then
    raise exception 'Encounter % not found', p_visit_id;
  end if;

  v_old_status := v_visit.status;
  v_new_status := v_old_status;

  -- Terminal encounters are idempotent.
  if v_old_status in ('discharged', 'cancelled') then
    return public.get_encounter_journey(p_visit_id);
  end if;

  -- Laboratory completion.
  select count(*), count(*) filter (where loi.status::text = 'completed')
    into v_lab_count, v_lab_completed
  from public.lab_orders lo
  join public.lab_order_items loi on loi.lab_order_id = lo.id
  where lo.visit_id = p_visit_id;

  -- Pharmacy completion.
  select count(*),
         coalesce(sum(greatest(pi.quantity_prescribed - coalesce(pi.quantity_dispensed, 0), 0)), 0)
    into v_prescription_count, v_remaining_quantity
  from public.prescriptions p
  join public.prescription_items pi on pi.prescription_id = p.id
  where p.visit_id = p_visit_id
    and p.status <> 'cancelled';

  -- All non-void service charges contribute to the encounter balance.
  select coalesce(sum(greatest(sc.amount_xaf - coalesce(sc.amount_paid_xaf, 0), 0)), 0)
    into v_outstanding
  from public.service_charges sc
  where sc.visit_id = p_visit_id
    and sc.status <> 'void';

  if v_old_status = 'waiting_lab' and v_lab_count > 0 and v_lab_completed = v_lab_count then
    if v_prescription_count > 0 and v_remaining_quantity > 0 then
      v_new_status := 'waiting_pharmacy';
    elsif v_outstanding > 0 then
      v_new_status := 'billing';
    else
      v_new_status := 'discharged';
    end if;

  elsif v_old_status = 'waiting_pharmacy' and v_remaining_quantity = 0 then
    if v_outstanding > 0 then
      v_new_status := 'billing';
    else
      v_new_status := 'discharged';
    end if;

  elsif v_old_status = 'billing' and v_outstanding <= 0 then
    v_new_status := 'discharged';
  end if;

  if v_new_status <> v_old_status then
    update public.visits
    set status = v_new_status::visit_status,
        updated_at = now()
    where id = p_visit_id;
  end if;

  return public.get_encounter_journey(p_visit_id);
end;
$$;

comment on function public.advance_encounter_status(uuid) is
'Idempotently advances an encounter after module completion using actual lab, pharmacy and billing work. The journey resolver itself remains read-only.';
