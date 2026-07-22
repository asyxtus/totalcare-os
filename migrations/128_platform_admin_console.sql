-- ============================================================================
-- PLATFORM ADMIN CONSOLE — clinic status + cross-clinic summary stats
--
-- Adds the ability to suspend a clinic (e.g. non-payment, offboarding)
-- without deleting its data, and a summary function so the platform admin
-- dashboard can show patient/staff/revenue counts per clinic and platform-
-- wide totals in two round trips instead of N+1 queries per clinic.
-- ============================================================================

alter table clinics add column if not exists is_active boolean not null default true;

-- clinics predates most of this schema (see the defensive fallback already
-- in listClinicsForPlatformAdminAction) — ensure created_at actually exists
-- before the summary function below references it, rather than assuming.
alter table clinics add column if not exists created_at timestamptz default now();

-- Per-clinic summary row: patient count, active staff count, and revenue
-- collected in the last 30 days. Called via the admin (service-role)
-- client from the platform-admin console, which already bypasses RLS —
-- this is a plain aggregating function, not SECURITY DEFINER, since the
-- access gate is the platform admin secret at the application layer, not
-- a database role distinction.
create or replace function platform_clinic_summary()
returns table (
  clinic_id     uuid,
  clinic_name   text,
  is_active     boolean,
  created_at    timestamptz,
  patient_count bigint,
  staff_count   bigint,
  revenue_30d_xaf numeric
)
language sql
stable
as $$
  select
    c.id,
    c.name,
    c.is_active,
    c.created_at,
    (select count(*) from patients p where p.clinic_id = c.id) as patient_count,
    (select count(*) from staff s where s.clinic_id = c.id and s.is_active = true) as staff_count,
    coalesce((
      select sum(pay.total_amount_xaf)
      from payments pay
      where pay.clinic_id = c.id
        and pay.status = 'completed'
        and pay.created_at >= now() - interval '30 days'
    ), 0) as revenue_30d_xaf
  from clinics c
  order by c.created_at desc nulls last
$$;
