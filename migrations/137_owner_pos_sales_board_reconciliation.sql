-- ============================================================================
-- OWNER POS SALES BOARD + DAILY POS RECONCILIATION
--
-- Adds a small, auditable reconciliation record for POS-only daily takings.
-- Sales themselves remain immutable transaction records in pos_sales.
-- The reconciliation table stores only what was physically counted/verified
-- by the owner/admin; expected amounts are always derived from pos_sales.
-- ============================================================================

create table if not exists public.pos_daily_reconciliations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  reconciliation_date date not null,
  cash_counted_xaf numeric(12,2) not null default 0,
  momo_counted_xaf numeric(12,2) not null default 0,
  orange_money_counted_xaf numeric(12,2) not null default 0,
  notes text,
  reconciled_by uuid not null references public.staff(id),
  reconciled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_daily_reconciliations_amounts_nonnegative check (
    cash_counted_xaf >= 0
    and momo_counted_xaf >= 0
    and orange_money_counted_xaf >= 0
  ),
  constraint pos_daily_reconciliations_unique_day unique (clinic_id, reconciliation_date)
);

create index if not exists idx_pos_daily_reconciliations_clinic_date
  on public.pos_daily_reconciliations (clinic_id, reconciliation_date desc);

alter table public.pos_daily_reconciliations enable row level security;

drop policy if exists pos_daily_reconciliations_select on public.pos_daily_reconciliations;
create policy pos_daily_reconciliations_select
  on public.pos_daily_reconciliations
  for select
  using (
    clinic_id = current_staff_clinic_id()
    and current_staff_role() in ('admin', 'auditor')
  );

drop policy if exists pos_daily_reconciliations_insert on public.pos_daily_reconciliations;
create policy pos_daily_reconciliations_insert
  on public.pos_daily_reconciliations
  for insert
  with check (
    clinic_id = current_staff_clinic_id()
    and current_staff_role() = 'admin'
    and reconciled_by in (
      select id from public.staff
      where auth_user_id = auth.uid()
        and clinic_id = current_staff_clinic_id()
    )
  );

drop policy if exists pos_daily_reconciliations_update on public.pos_daily_reconciliations;
create policy pos_daily_reconciliations_update
  on public.pos_daily_reconciliations
  for update
  using (
    clinic_id = current_staff_clinic_id()
    and current_staff_role() = 'admin'
  )
  with check (
    clinic_id = current_staff_clinic_id()
    and current_staff_role() = 'admin'
    and reconciled_by in (
      select id from public.staff
      where auth_user_id = auth.uid()
        and clinic_id = current_staff_clinic_id()
    )
  );
