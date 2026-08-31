-- ============================================================================
-- MIGRATION 154: EMERGENCY LAB BILLING DEFAULT
--
-- Existing doctor workflow calls create_lab_order with four arguments.
-- Keep that call compatible while making emergency/admission-style encounters
-- immediately executable by the laboratory without requiring payment first.
-- Routine consultations retain the historical pay-now behaviour.
--
-- Explicit five-argument calls from future UI flows can still choose:
--   pay_now | charge_to_encounter | deferred
-- ============================================================================

create or replace function public.create_lab_order(
  p_clinic_id uuid,
  p_visit_id uuid,
  p_ordered_by uuid,
  p_items jsonb
)
returns table (lab_order_id uuid, service_charge_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_emergency boolean := false;
begin
  select coalesce(is_emergency, false)
    into v_is_emergency
  from visits
  where id = p_visit_id
    and clinic_id = p_clinic_id;

  return query
  select * from public.create_lab_order(
    p_clinic_id,
    p_visit_id,
    p_ordered_by,
    p_items,
    case when v_is_emergency then 'charge_to_encounter' else 'pay_now' end
  );
end;
$$;

revoke all on function public.create_lab_order(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.create_lab_order(uuid, uuid, uuid, jsonb) to authenticated;
