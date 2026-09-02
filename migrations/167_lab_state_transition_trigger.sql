-- ============================================================================
-- MIGRATION 167: AUTOMATIC LAB STATE / ENCOUNTER RECONCILIATION
--
-- The database is the final source of truth for laboratory state transitions.
-- Any change to a lab item's clinical status or billing status reconciles the
-- associated encounter. This covers UI actions, RPCs, payment flows and
-- future callers without duplicating transition logic in every module.
-- ============================================================================

create or replace function public.reconcile_encounter_after_lab_item_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit_id uuid;
begin
  select lo.visit_id
    into v_visit_id
  from public.lab_orders lo
  where lo.id = new.lab_order_id;

  if v_visit_id is not null then
    perform public.advance_encounter_status(v_visit_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reconcile_encounter_after_lab_item_change on public.lab_order_items;

create trigger trg_reconcile_encounter_after_lab_item_change
after update of status, billing_status, service_charge_id
on public.lab_order_items
for each row
when (
  old.status is distinct from new.status
  or old.billing_status is distinct from new.billing_status
  or old.service_charge_id is distinct from new.service_charge_id
)
execute function public.reconcile_encounter_after_lab_item_change();

comment on function public.reconcile_encounter_after_lab_item_change() is
'Reconciles the encounter whenever a laboratory item becomes deferred, authorized, paid, sample-collected, completed, cancelled, or otherwise changes financial/clinical state.';
