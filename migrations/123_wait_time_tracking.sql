-- ============================================================================
-- WAIT-TIME TRACKING
--
-- The number patients complain about and owners staff by: how long people
-- wait at each stage (registration → triage → doctor → pharmacy → out).
--
-- Approach: a trigger logs every visit status change into visit_status_events
-- with a timestamp. Time-in-stage = time between consecutive events. Analytics
-- RPCs then aggregate: average wait per stage, per doctor, for a date range.
--
-- The trigger captures ALL status changes automatically — no need to touch
-- the dozens of functions that update visits.status.
-- ============================================================================

-- ── Event log table ─────────────────────────────────────────────────────────
create table if not exists visit_status_events (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null,
  visit_id     uuid not null references visits(id) on delete cascade,
  from_status  text,
  to_status    text not null,
  changed_at   timestamptz not null default now(),
  assigned_doctor_id uuid
);

create index if not exists idx_vse_clinic_date on visit_status_events (clinic_id, changed_at);
create index if not exists idx_vse_visit on visit_status_events (visit_id, changed_at);

-- ── Trigger: log every status transition ────────────────────────────────────
create or replace function log_visit_status_change()
returns trigger
language plpgsql
as $$
begin
  -- On INSERT: log the initial status
  if TG_OP = 'INSERT' then
    insert into visit_status_events (clinic_id, visit_id, from_status, to_status, assigned_doctor_id)
    values (NEW.clinic_id, NEW.id, null, NEW.status::text, NEW.assigned_doctor_id);
    return NEW;
  end if;

  -- On UPDATE: only log if status actually changed
  if TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
    insert into visit_status_events (clinic_id, visit_id, from_status, to_status, assigned_doctor_id)
    values (NEW.clinic_id, NEW.id, OLD.status::text, NEW.status::text, NEW.assigned_doctor_id);
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_log_visit_status on visits;
create trigger trg_log_visit_status
  after insert or update on visits
  for each row execute function log_visit_status_change();

-- ── Backfill: seed the log with current visits' registration event ──────────
-- We can't reconstruct past transitions, but we can at least record that each
-- existing visit was registered, so historical visits aren't entirely blank.
insert into visit_status_events (clinic_id, visit_id, from_status, to_status, changed_at)
select v.clinic_id, v.id, null, 'registered', v.created_at
from visits v
where not exists (
  select 1 from visit_status_events e where e.visit_id = v.id
);

-- ── Analytics: average time-in-stage across a date range ────────────────────
-- Returns, for each stage the visit sat in, the average minutes spent there
-- before moving to the next stage. Only counts stages that were exited (i.e.
-- we know how long they lasted).
create or replace function wait_time_by_stage(
  p_clinic_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  stage           text,
  avg_minutes     numeric,
  median_minutes  numeric,
  max_minutes     numeric,
  visit_count     bigint
)
language sql
stable
as $$
  with bounds as (
    select
      coalesce(p_from, (timezone('Africa/Douala', now()))::date) as d_from,
      coalesce(p_to,   (timezone('Africa/Douala', now()))::date) as d_to
  ),
  -- Pair each event with the next event for the same visit
  durations as (
    select
      e.to_status as stage,
      extract(epoch from (
        lead(e.changed_at) over (partition by e.visit_id order by e.changed_at) - e.changed_at
      )) / 60.0 as minutes
    from visit_status_events e, bounds
    where e.clinic_id = p_clinic_id
      and date(timezone('Africa/Douala', e.changed_at)) between bounds.d_from and bounds.d_to
  )
  select
    stage,
    round(avg(minutes)::numeric, 1),
    round((percentile_cont(0.5) within group (order by minutes))::numeric, 1),
    round(max(minutes)::numeric, 1),
    count(*)
  from durations
  where minutes is not null and minutes >= 0
  group by stage
  order by avg(minutes) desc
$$;

-- ── Analytics: total visit turnaround per doctor ────────────────────────────
-- Average time from registration to consultation-complete, grouped by the
-- doctor who saw the patient.
create or replace function wait_time_by_doctor(
  p_clinic_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  doctor_id       uuid,
  doctor_name     text,
  avg_wait_to_doctor_min numeric,
  avg_consult_min numeric,
  patients_seen   bigint
)
language sql
stable
as $$
  with bounds as (
    select
      coalesce(p_from, (timezone('Africa/Douala', now()))::date) as d_from,
      coalesce(p_to,   (timezone('Africa/Douala', now()))::date) as d_to
  ),
  -- For each visit, find key timestamps
  visit_times as (
    select
      e.visit_id,
      e.assigned_doctor_id,
      min(e.changed_at) filter (where e.to_status = 'registered') as registered_at,
      min(e.changed_at) filter (where e.to_status = 'in_consultation') as consult_start,
      min(e.changed_at) filter (where e.to_status in ('billing', 'waiting_pharmacy', 'discharged', 'admitted')) as consult_end
    from visit_status_events e, bounds
    where e.clinic_id = p_clinic_id
      and date(timezone('Africa/Douala', e.changed_at)) between bounds.d_from and bounds.d_to
    group by e.visit_id, e.assigned_doctor_id
  )
  select
    vt.assigned_doctor_id,
    s.full_name,
    round(avg(extract(epoch from (vt.consult_start - vt.registered_at)) / 60.0)::numeric, 1),
    round(avg(extract(epoch from (vt.consult_end - vt.consult_start)) / 60.0)::numeric, 1),
    count(*) filter (where vt.consult_start is not null)
  from visit_times vt
  join staff s on s.id = vt.assigned_doctor_id
  where vt.assigned_doctor_id is not null
    and vt.consult_start is not null
  group by vt.assigned_doctor_id, s.full_name
  order by count(*) desc
$$;
