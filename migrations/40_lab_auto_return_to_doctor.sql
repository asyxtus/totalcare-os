-- ============================================================================
-- PATCH: AUTO-RETURN TO DOCTOR WHEN LAB WORK IS DONE
-- Extends complete_lab_order_item (built in Lab Step 3) so that
-- completing the LAST remaining in-house item for a visit automatically
-- flips that visit from 'waiting_lab' back to 'waiting_consultation' —
-- no manual step, no button to forget. External items are explicitly
-- excluded from this check, since nothing in this system ever marks an
-- external item "done" — a visit with one pending external referral
-- would otherwise never return to the doctor at all.
-- ============================================================================

create or replace function complete_lab_order_item(
  p_lab_order_item_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
as $$
declare
  v_has_result boolean;
  v_has_attachment boolean;
  v_visit_id uuid;
  v_clinic_id uuid;
  v_visit_status visit_status;
  v_remaining_in_house_items int;
begin
  select exists(select 1 from lab_results where lab_order_item_id = p_lab_order_item_id) into v_has_result;
  select exists(select 1 from lab_result_attachments where lab_order_item_id = p_lab_order_item_id) into v_has_attachment;

  if not v_has_result and not v_has_attachment then
    raise exception 'Cannot complete: no result value or attachment has been recorded for this item';
  end if;

  update lab_order_items set status = 'completed' where id = p_lab_order_item_id;

  -- Find the visit this item belongs to, and check whether ANY other
  -- in-house item on that same visit (across all its lab orders) is
  -- still unresolved. External items are excluded from this count on
  -- purpose — see the header comment.
  select lo.visit_id, lo.clinic_id into v_visit_id, v_clinic_id
  from lab_order_items loi
  join lab_orders lo on lo.id = loi.lab_order_id
  where loi.id = p_lab_order_item_id;

  select status into v_visit_status from visits where id = v_visit_id;

  if v_visit_status = 'waiting_lab' then
    select count(*) into v_remaining_in_house_items
    from lab_order_items loi
    join lab_orders lo on lo.id = loi.lab_order_id
    where lo.visit_id = v_visit_id
      and loi.item_type <> 'external'
      and loi.status not in ('completed', 'cancelled');

    if v_remaining_in_house_items = 0 then
      update visits set status = 'waiting_consultation' where id = v_visit_id;

      insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
      values (v_clinic_id, p_staff_id, 'visit.returned_to_doctor_after_lab', 'visit', v_visit_id, '{}'::jsonb);
    end if;
  end if;
end;
$$;
