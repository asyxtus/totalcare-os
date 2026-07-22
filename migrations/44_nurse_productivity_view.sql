-- ============================================================================
-- NURSE PRODUCTIVITY — same pattern as doctor_productivity_daily and
-- lab_tech_productivity_daily. Uses triage_assessments.recorded_by as
-- the productivity signal, since that's the per-encounter record a
-- nurse actually creates (mirrors lab_results.recorded_by for lab techs).
-- ============================================================================

create view nurse_productivity_daily as
select
  ta.clinic_id,
  ta.recorded_by as nurse_id,
  s.full_name as nurse_name,
  date(timezone('Africa/Douala', ta.created_at)) as work_date,
  count(*) as triages_completed
from triage_assessments ta
join staff s on s.id = ta.recorded_by
group by ta.clinic_id, ta.recorded_by, s.full_name, date(timezone('Africa/Douala', ta.created_at));
