-- ============================================================================
-- MIGRATION 166: STATE-AWARE LABORATORY / ENCOUNTER RECONCILIATION
--
-- Laboratory billing state and clinical execution state are separate.
-- A deferred item is still part of the clinical order, but it is NOT active
-- laboratory work until it is activated and becomes authorized or paid.
--
-- This migration makes encounter advancement aware of that distinction and
-- allows a deferred investigation activated after discharge to reopen the
-- encounter into waiting_lab.
-- ============================================================================

create or replace function public.advance_encounter_status(p_visit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit record;
  v_old_status text;
  v_new_status text;
  v_lab_count integer := 0;
  v_lab_completed integer := 0;
  v_prescription_count integer := 0;
  v_remaining_quantity integer := 0;
  v_outstanding numeric := 0;
  v_role text;
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

  -- Only financially authorized/paid, non-cancelled laboratory items are
  -- active laboratory work. Deferred and pending-payment items do not block
  -- the encounter from moving forward.
  select count(*), count(*) filter (where loi.status::text = 'completed')
    into v_lab_count, v_lab_completed
  from public.lab_orders lo
  join public.lab_order_items loi on loi.lab_order_id = lo.id
  where lo.visit_id = p_visit_id
    and loi.status::text <> 'cancelled'
    and loi.billing_status::text in ('authorized', 'paid');

  select count(*),
         coalesce(sum(greatest(pi.quantity_prescribed - coalesce(pi.quantity_dispensed, 0), 0)), 0)
    into v_prescription_count, v_remaining_quantity
  from public.prescriptions p
  join public.prescription_items pi on pi.prescription_id = p.id
  where p.visit_id = p_visit_id
    and p.status <> 'cancelled';

  select coalesce(sum(greatest(sc.amount_xaf - coalesce(sc.amount_paid_xaf, 0), 0)), 0)
    into v_outstanding
  from public.service_charges sc
  where sc.visit_id = p_visit_id
    and sc.status <> 'void';

  -- A deferred investigation may be activated after the original encounter
  -- was discharged. Re-open the encounter because there is now real active
  -- laboratory work to perform.
  if v_old_status = 'discharged' and v_lab_count > v_lab_completed then
    v_new_status := 'waiting_lab';

  elsif v_old_status = 'waiting_lab' then
    if v_lab_count > v_lab_completed then
      v_new_status := 'waiting_lab';
    elsif v_lab_count = 0 or v_lab_completed = v_lab_count then
      if v_prescription_count > 0 and v_remaining_quantity > 0 then
        v_new_status := 'waiting_pharmacy';
      elsif v_outstanding > 0 then
        v_new_status := 'billing';
      else
        v_new_status := 'discharged';
      end if;
    end if;

  elsif v_old_status = 'waiting_pharmacy' then
    if v_remaining_quantity = 0 then
      if v_outstanding > 0 then
        v_new_status := 'billing';
      else
        v_new_status := 'discharged';
      end if;
    end if;

  elsif v_old_status = 'billing' then
    if v_outstanding <= 0 then
      v_new_status := 'discharged';
    end if;
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
'Idempotently reconciles encounter status with active laboratory work, pharmacy work and outstanding billing. Deferred lab items do not block progression; activating a deferred item after discharge reopens the encounter to waiting_lab.';

-- Reconcile existing encounters without creating charges or duplicate orders.
-- This is deliberately limited to encounters whose status can be affected by
-- the lab state model.
do $$
declare
  r record;
begin
  for r in
    select distinct v.id
    from public.visits v
    join public.lab_orders lo on lo.visit_id = v.id
    join public.lab_order_items loi on loi.lab_order_id = lo.id
    where v.status::text in ('waiting_lab','discharged')
      and loi.billing_status::text in ('authorized','paid')
      and loi.status::text <> 'cancelled'
  loop
    perform public.advance_encounter_status(r.id);
  end loop;
end;
$$;
