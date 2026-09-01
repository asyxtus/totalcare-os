-- ============================================================================
-- MIGRATION 159: FIX LAB SERVICE-CHARGE TRIGGER ALIAS
--
-- The migration-156 version of sync_lab_order_item_from_service_charge()
-- referenced sc.amount_xaf / sc.amount_paid_xaf without joining service_charges
-- as sc. Because the function is fired by an INSERT/UPDATE trigger on
-- service_charges, the new row is already available as NEW; use NEW directly.
--
-- This bug surfaced during pharmacy dispensing because dispensing creates a
-- service charge, which fires the trigger even when the charge is unrelated
-- to laboratory testing.
-- ============================================================================

create or replace function public.sync_lab_order_item_from_service_charge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_amount numeric;
  v_paid numeric;
begin
  -- The trigger is on service_charges, so NEW is the canonical charge row.
  -- Do not reference an undeclared service_charges alias (such as sc).
  select loi.id
    into v_item_id
  from public.lab_order_items loi
  where loi.service_charge_id = new.id
  limit 1;

  if v_item_id is null then
    return new;
  end if;

  v_amount := coalesce(new.amount_xaf, 0);
  v_paid := coalesce(new.amount_paid_xaf, 0);

  if new.status = 'paid' or (v_amount > 0 and v_paid >= v_amount) then
    update public.lab_order_items
    set billing_status = 'paid',
        authorization_status = 'paid'
    where id = v_item_id
      and billing_status not in ('authorized','deferred','cancelled','paid');

    insert into public.audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
    select loi.clinic_id, null, 'laboratory.item_paid', 'lab_order_item', loi.id,
           jsonb_build_object(
             'service_charge_id', new.id,
             'amount_paid_xaf', new.amount_paid_xaf
           )
    from public.lab_order_items loi
    where loi.id = v_item_id;
  end if;

  return new;
end;
$$;

-- Recreate the trigger deterministically so the corrected function is used.
drop trigger if exists trg_sync_lab_order_item_from_service_charge on public.service_charges;
create trigger trg_sync_lab_order_item_from_service_charge
after insert or update of status, amount_paid_xaf, patient_portion_xaf
on public.service_charges
for each row
execute function public.sync_lab_order_item_from_service_charge();
