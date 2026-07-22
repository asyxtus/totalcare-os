-- ============================================================================
-- ADMISSIONS REPORTS
-- Genuinely missing from the original scoping, not a deliberate
-- deferral like Map was. Built from data that already exists.
-- ============================================================================

create or replace function admission_reports_summary(p_clinic_id uuid, p_days int default 30)
returns table (
  total_admissions bigint,
  avg_length_of_stay_days numeric,
  routine_discharges bigint,
  transfer_out_discharges bigint,
  ama_discharges bigint,
  deceased_discharges bigint
)
language sql
stable
as $$
  select
    count(*) filter (where recommended_at >= current_date - p_days),
    round(avg(extract(epoch from (discharged_at - bed_assigned_at)) / 86400) filter (
      where discharged_at is not null and bed_assigned_at is not null and discharged_at >= current_date - p_days
    ), 1),
    count(*) filter (where discharge_type = 'routine' and discharged_at >= current_date - p_days),
    count(*) filter (where discharge_type = 'transfer_out' and discharged_at >= current_date - p_days),
    count(*) filter (where discharge_type = 'against_medical_advice' and discharged_at >= current_date - p_days),
    count(*) filter (where discharge_type = 'deceased' and discharged_at >= current_date - p_days)
  from admissions
  where clinic_id = p_clinic_id
$$;

create or replace function admissions_daily_count(p_clinic_id uuid, p_days int default 30)
returns table (
  report_date date,
  admission_count bigint
)
language sql
stable
as $$
  select
    d.report_date,
    coalesce(a.cnt, 0)
  from (
    select generate_series(current_date - (p_days - 1), current_date, '1 day')::date as report_date
  ) d
  left join (
    select date(timezone('Africa/Douala', recommended_at)) as day, count(*) as cnt
    from admissions
    where clinic_id = p_clinic_id
    group by date(timezone('Africa/Douala', recommended_at))
  ) a on a.day = d.report_date
  order by d.report_date desc
$$;
