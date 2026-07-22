-- ============================================================================
-- CRITICAL RESULTS ACKNOWLEDGMENT
-- Real gap found: the "auto-return to doctor" mechanism only fires when
-- a visit's status is 'waiting_lab' — the outpatient flow. An admitted
-- patient's visit stays 'admitted' the whole time, so that trigger
-- never runs, and a critical lab value has no active notification at
-- all — only a doctor manually re-checking the Care panel's Labs tab.
-- Built broadly (not just for admissions) since the same gap can catch
-- an outpatient result too, if it comes back after the doctor has
-- already moved on.
-- ============================================================================

alter table lab_results add column if not exists acknowledged_by uuid references staff(id);
alter table lab_results add column if not exists acknowledged_at timestamptz;

create or replace function acknowledge_critical_result(
  p_clinic_id uuid,
  p_result_id uuid,
  p_acknowledged_by uuid
)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from lab_results where id = p_result_id and clinic_id = p_clinic_id) then
    raise exception 'Result does not belong to this clinic';
  end if;

  update lab_results set acknowledged_by = p_acknowledged_by, acknowledged_at = now()
  where id = p_result_id;
end;
$$;

create or replace function critical_results_pending_review(p_clinic_id uuid)
returns table (
  result_id uuid,
  patient_id uuid,
  patient_name text,
  test_name text,
  result_display text,
  verified_at timestamptz,
  is_admitted boolean,
  admission_id uuid
)
language sql
stable
as $$
  select
    lr.id,
    p.id,
    p.full_name,
    coalesce(lp.name_fr, ltc.name_fr, loi.external_test_name, 'Test'),
    coalesce(lr.numeric_value::text, lr.qualitative_value),
    lr.verified_at,
    (a.id is not null),
    a.id
  from lab_results lr
  join lab_order_items loi on loi.id = lr.lab_order_item_id
  join lab_orders lo on lo.id = loi.lab_order_id
  join visits v on v.id = lo.visit_id
  join patients p on p.id = v.patient_id
  left join lab_panels lp on lp.id = loi.lab_panel_id
  left join lab_test_catalog ltc on ltc.id = loi.lab_test_catalog_id
  left join admissions a on a.visit_id = v.id and a.status = 'admitted'
  where lr.clinic_id = p_clinic_id
    and lr.is_critical = true
    and lr.acknowledged_at is null
    and lr.verified_at is not null
  order by lr.verified_at asc
$$;
