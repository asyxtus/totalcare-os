-- ============================================================================
-- MIGRATION 145: DIRECT IMAGING CATALOGUE + ORDERS + FINANCIAL INTEGRATION
--
-- Phase 2 of the direct ancillary-services architecture.
--
-- Direct imaging follows the same encounter/financial pattern as migration 144:
--   patient -> visit(encounter_type=direct_imaging)
--           -> imaging_order -> imaging_order_items
--           -> service_charges(category=procedure) -> invoice -> cashier
--
-- No consultation is required and no consultation charge is created.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Catalogue
-- ----------------------------------------------------------------------------
create table if not exists public.imaging_catalog (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  code text not null,
  name_en text not null,
  name_fr text not null,
  modality text not null,
  price_xaf numeric(12,2) not null check (price_xaf >= 0),
  turnaround_minutes integer check (turnaround_minutes is null or turnaround_minutes > 0),
  preparation_instructions text,
  clinical_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, code)
);

create index if not exists idx_imaging_catalog_clinic_active
  on public.imaging_catalog(clinic_id, is_active, modality, name_en);

-- ----------------------------------------------------------------------------
-- 2. Orders and billable examination items
-- ----------------------------------------------------------------------------
create table if not exists public.imaging_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete restrict,
  ordered_by uuid not null references public.staff(id) on delete restrict,
  status text not null default 'ordered',
  clinical_indication text,
  notes text,
  ordered_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint imaging_orders_status_check
    check (status in ('ordered','paid','waiting','in_progress','completed','cancelled'))
);

create index if not exists idx_imaging_orders_clinic_status
  on public.imaging_orders(clinic_id, status, ordered_at desc);

create index if not exists idx_imaging_orders_visit
  on public.imaging_orders(visit_id);

create table if not exists public.imaging_order_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  imaging_order_id uuid not null references public.imaging_orders(id) on delete cascade,
  imaging_catalog_id uuid not null references public.imaging_catalog(id) on delete restrict,
  service_charge_id uuid references public.service_charges(id) on delete set null,
  status text not null default 'ordered',
  performed_by uuid references public.staff(id) on delete set null,
  performed_at timestamptz,
  report_text text,
  reported_by uuid references public.staff(id) on delete set null,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  constraint imaging_order_items_status_check
    check (status in ('ordered','paid','waiting','in_progress','completed','cancelled'))
);

create index if not exists idx_imaging_order_items_order
  on public.imaging_order_items(imaging_order_id);

create index if not exists idx_imaging_order_items_clinic_status
  on public.imaging_order_items(clinic_id, status, created_at desc);

create index if not exists idx_imaging_order_items_catalog
  on public.imaging_order_items(imaging_catalog_id);

-- Migration 144 introduced this shared encounter classification. Repeating the
-- definition with IF NOT EXISTS/drop-and-recreate keeps migration 145 safe when
-- deployed to a database where 144 has already been applied.
alter table public.visits
  add column if not exists encounter_type text not null default 'consultation';

alter table public.visits
  drop constraint if exists visits_encounter_type_check;

alter table public.visits
  add constraint visits_encounter_type_check
  check (encounter_type in ('consultation', 'direct_lab', 'direct_imaging', 'other_ancillary'));

create index if not exists idx_visits_clinic_encounter_type
  on public.visits(clinic_id, encounter_type, created_at desc);

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.touch_imaging_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_imaging_catalog_updated_at on public.imaging_catalog;
create trigger trg_imaging_catalog_updated_at
before update on public.imaging_catalog
for each row execute function public.touch_imaging_catalog_updated_at();

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
alter table public.imaging_catalog enable row level security;
alter table public.imaging_orders enable row level security;
alter table public.imaging_order_items enable row level security;

drop policy if exists imaging_catalog_select on public.imaging_catalog;
create policy imaging_catalog_select
  on public.imaging_catalog
  for select
  using (clinic_id = current_staff_clinic_id());

drop policy if exists imaging_catalog_admin_write on public.imaging_catalog;
create policy imaging_catalog_admin_write
  on public.imaging_catalog
  for all
  using (clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin')
  with check (clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin');

drop policy if exists imaging_orders_select on public.imaging_orders;
create policy imaging_orders_select
  on public.imaging_orders
  for select
  using (clinic_id = current_staff_clinic_id());

drop policy if exists imaging_orders_staff_update on public.imaging_orders;
create policy imaging_orders_staff_update
  on public.imaging_orders
  for update
  using (clinic_id = current_staff_clinic_id())
  with check (clinic_id = current_staff_clinic_id());

drop policy if exists imaging_order_items_select on public.imaging_order_items;
create policy imaging_order_items_select
  on public.imaging_order_items
  for select
  using (clinic_id = current_staff_clinic_id());

drop policy if exists imaging_order_items_staff_update on public.imaging_order_items;
create policy imaging_order_items_staff_update
  on public.imaging_order_items
  for update
  using (clinic_id = current_staff_clinic_id())
  with check (clinic_id = current_staff_clinic_id());

-- Creation is only through the SECURITY DEFINER functions below.
revoke insert on public.imaging_orders from authenticated;
revoke insert on public.imaging_order_items from authenticated;

-- ----------------------------------------------------------------------------
-- 5. Admin catalogue functions
-- ----------------------------------------------------------------------------
create or replace function public.create_imaging_catalog_item(
  p_clinic_id uuid,
  p_created_by uuid,
  p_code text,
  p_name_en text,
  p_name_fr text,
  p_modality text,
  p_price_xaf numeric,
  p_turnaround_minutes integer default null,
  p_preparation_instructions text default null,
  p_clinical_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role staff_role;
  v_id uuid;
begin
  select coalesce(active_role, role) into v_role
  from staff
  where id = p_created_by and clinic_id = p_clinic_id and is_active = true;

  if v_role is null then
    raise exception 'Staff member not found or inactive in this clinic';
  end if;
  if v_role <> 'admin' then
    raise exception 'Only an admin can create an imaging catalogue item';
  end if;
  if nullif(trim(p_code), '') is null then
    raise exception 'Imaging service code is required';
  end if;
  if nullif(trim(p_name_en), '') is null then
    raise exception 'English imaging service name is required';
  end if;
  if nullif(trim(p_name_fr), '') is null then
    raise exception 'French imaging service name is required';
  end if;
  if nullif(trim(p_modality), '') is null then
    raise exception 'Imaging modality is required';
  end if;
  if p_price_xaf is null or p_price_xaf < 0 then
    raise exception 'Imaging price must be zero or greater';
  end if;

  insert into imaging_catalog (
    clinic_id, code, name_en, name_fr, modality, price_xaf,
    turnaround_minutes, preparation_instructions, clinical_notes
  ) values (
    p_clinic_id, upper(trim(p_code)), trim(p_name_en), trim(p_name_fr),
    trim(p_modality), p_price_xaf, p_turnaround_minutes,
    nullif(trim(p_preparation_instructions), ''),
    nullif(trim(p_clinical_notes), '')
  )
  returning id into v_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    p_clinic_id, p_created_by, 'pricing.imaging_created', 'imaging_catalog', v_id,
    jsonb_build_object(
      'code', upper(trim(p_code)), 'name_en', trim(p_name_en),
      'name_fr', trim(p_name_fr), 'modality', trim(p_modality),
      'price_xaf', p_price_xaf
    )
  );

  return v_id;
end;
$$;

revoke all on function public.create_imaging_catalog_item(uuid,uuid,text,text,text,text,numeric,integer,text,text) from public;
grant execute on function public.create_imaging_catalog_item(uuid,uuid,text,text,text,text,numeric,integer,text,text) to authenticated;

create or replace function public.update_imaging_catalog_price(
  p_id uuid,
  p_updated_by uuid,
  p_price_xaf numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_role staff_role;
  v_old_price numeric(12,2);
begin
  select clinic_id, price_xaf into v_clinic_id, v_old_price
  from imaging_catalog where id = p_id for update;

  if v_clinic_id is null then
    raise exception 'Imaging catalogue item not found';
  end if;

  select coalesce(active_role, role) into v_role
  from staff
  where id = p_updated_by and clinic_id = v_clinic_id and is_active = true;

  if v_role <> 'admin' then
    raise exception 'Only an admin can change imaging prices';
  end if;
  if p_price_xaf is null or p_price_xaf < 0 then
    raise exception 'Imaging price must be zero or greater';
  end if;

  update imaging_catalog set price_xaf = p_price_xaf where id = p_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    v_clinic_id, p_updated_by, 'pricing.imaging_price_updated', 'imaging_catalog', p_id,
    jsonb_build_object('old_price_xaf', v_old_price, 'new_price_xaf', p_price_xaf)
  );
end;
$$;

revoke all on function public.update_imaging_catalog_price(uuid,uuid,numeric) from public;
grant execute on function public.update_imaging_catalog_price(uuid,uuid,numeric) to authenticated;

create or replace function public.toggle_imaging_catalog_active(
  p_id uuid,
  p_updated_by uuid,
  p_make_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_role staff_role;
begin
  select clinic_id into v_clinic_id from imaging_catalog where id = p_id for update;
  if v_clinic_id is null then
    raise exception 'Imaging catalogue item not found';
  end if;

  select coalesce(active_role, role) into v_role
  from staff
  where id = p_updated_by and clinic_id = v_clinic_id and is_active = true;

  if v_role <> 'admin' then
    raise exception 'Only an admin can change imaging catalogue status';
  end if;

  update imaging_catalog set is_active = p_make_active where id = p_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    v_clinic_id, p_updated_by,
    case when p_make_active then 'pricing.imaging_reactivated' else 'pricing.imaging_deactivated' end,
    'imaging_catalog', p_id, '{}'::jsonb
  );
end;
$$;

revoke all on function public.toggle_imaging_catalog_active(uuid,uuid,boolean) from public;
grant execute on function public.toggle_imaging_catalog_active(uuid,uuid,boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Direct imaging registration
-- ----------------------------------------------------------------------------
create or replace function public.create_direct_imaging_visit(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_registered_by uuid,
  p_items jsonb,
  p_clinical_indication text default null,
  p_reason text default null
)
returns table (
  visit_id uuid,
  imaging_order_id uuid,
  invoice_id uuid,
  service_charge_ids uuid[],
  total_amount_xaf numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role staff_role;
  v_existing_visit uuid;
  v_visit_id uuid;
  v_order_id uuid;
  v_charge_ids uuid[] := array[]::uuid[];
  v_invoice_id uuid;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_catalog_id uuid;
  v_price numeric(12,2);
  v_name text;
  v_charge_id uuid;
  v_catalog_clinic uuid;
begin
  select coalesce(active_role, role) into v_role
  from staff
  where id = p_registered_by and clinic_id = p_clinic_id and is_active = true;

  if v_role is null then
    raise exception 'Staff member not found or inactive in this clinic';
  end if;
  if v_role not in ('admin', 'receptionist', 'billing_clerk', 'doctor') then
    raise exception 'Staff role % cannot register a direct imaging visit', v_role;
  end if;

  if not exists (select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id) then
    raise exception 'Patient does not belong to this clinic';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one imaging service is required';
  end if;

  select id into v_existing_visit
  from visits
  where patient_id = p_patient_id
    and clinic_id = p_clinic_id
    and status not in ('discharged', 'cancelled')
  order by created_at desc
  limit 1
  for update;

  if v_existing_visit is not null then
    raise exception 'Patient already has an active visit (%). Use the existing visit instead of opening a second visit.', v_existing_visit;
  end if;

  -- Validate the complete cart before creating the encounter or any financial row.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_id := nullif(v_item->>'imaging_catalog_id', '')::uuid;
    if v_catalog_id is null then
      raise exception 'Every imaging item must contain imaging_catalog_id';
    end if;

    select clinic_id, price_xaf, name_en
      into v_catalog_clinic, v_price, v_name
    from imaging_catalog
    where id = v_catalog_id
      and clinic_id = p_clinic_id
      and is_active = true;

    if v_catalog_clinic is null then
      raise exception 'Imaging service % is not active or not configured for this clinic', v_catalog_id;
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'Imaging service % has an invalid price', v_catalog_id;
    end if;
  end loop;

  insert into visits (
    clinic_id, patient_id, visit_reason, status, registered_by, encounter_type
  ) values (
    p_clinic_id, p_patient_id,
    coalesce(nullif(trim(p_reason), ''), 'Direct imaging services'),
    'waiting_lab', p_registered_by, 'direct_imaging'
  ) returning id into v_visit_id;

  insert into imaging_orders (
    clinic_id, visit_id, ordered_by, status, clinical_indication, notes
  ) values (
    p_clinic_id, v_visit_id, p_registered_by, 'ordered',
    nullif(trim(p_clinical_indication), ''),
    'Direct imaging visit — no consultation'
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_id := (v_item->>'imaging_catalog_id')::uuid;

    select price_xaf, name_en into v_price, v_name
    from imaging_catalog
    where id = v_catalog_id and clinic_id = p_clinic_id and is_active = true;

    v_charge_id := create_service_charge(
      p_clinic_id, p_patient_id, v_visit_id, null,
      'procedure', v_name, v_price, p_registered_by
    );

    v_charge_ids := array_append(v_charge_ids, v_charge_id);
    v_total := v_total + v_price;

    insert into imaging_order_items (
      clinic_id, imaging_order_id, imaging_catalog_id, service_charge_id, status
    ) values (
      p_clinic_id, v_order_id, v_catalog_id, v_charge_id, 'ordered'
    );
  end loop;

  v_invoice_id := open_invoice_for_charges(v_charge_ids, p_registered_by);

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    p_clinic_id, p_registered_by, 'imaging.direct_visit_created', 'visit', v_visit_id,
    jsonb_build_object(
      'imaging_order_id', v_order_id,
      'invoice_id', v_invoice_id,
      'service_charge_ids', v_charge_ids,
      'total_amount_xaf', v_total,
      'clinical_indication', p_clinical_indication,
      'reason', p_reason
    )
  );

  return query select v_visit_id, v_order_id, v_invoice_id, v_charge_ids, v_total;
end;
$$;

revoke all on function public.create_direct_imaging_visit(uuid,uuid,uuid,jsonb,text,text) from public;
grant execute on function public.create_direct_imaging_visit(uuid,uuid,uuid,jsonb,text,text) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. Payment state + examination completion
-- ----------------------------------------------------------------------------
create or replace function public.set_imaging_order_paid(
  p_imaging_order_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_role staff_role;
  v_has_unpaid boolean;
begin
  select clinic_id into v_clinic_id
  from imaging_orders where id = p_imaging_order_id for update;
  if v_clinic_id is null then
    raise exception 'Imaging order not found';
  end if;

  select coalesce(active_role, role) into v_role
  from staff
  where id = p_staff_id and clinic_id = v_clinic_id and is_active = true;

  if v_role is null then
    raise exception 'Staff member not found or inactive in this clinic';
  end if;
  if v_role not in ('admin','receptionist','billing_clerk','doctor') then
    raise exception 'Staff role % cannot mark imaging as paid', v_role;
  end if;

  select exists (
    select 1
    from imaging_order_items ioi
    join service_charges sc on sc.id = ioi.service_charge_id
    where ioi.imaging_order_id = p_imaging_order_id
      and sc.status in ('pending','partial')
      and coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf > 0
  ) into v_has_unpaid;

  if v_has_unpaid then
    raise exception 'Imaging cannot be marked paid while one or more charges remain unpaid';
  end if;

  update imaging_orders
  set status = case when status = 'completed' then status else 'paid' end
  where id = p_imaging_order_id;

  update imaging_order_items
  set status = case when status = 'completed' then status else 'paid' end
  where imaging_order_id = p_imaging_order_id
    and status not in ('completed','cancelled');
end;
$$;

revoke all on function public.set_imaging_order_paid(uuid,uuid) from public;
grant execute on function public.set_imaging_order_paid(uuid,uuid) to authenticated;

create or replace function public.complete_imaging_order_item(
  p_imaging_order_item_id uuid,
  p_staff_id uuid,
  p_report_text text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_role staff_role;
  v_remaining integer;
  v_visit_status visit_status;
  v_encounter_type text;
begin
  select
    ioi.id, ioi.clinic_id, ioi.imaging_order_id,
    io.visit_id, ioi.status, io.status as order_status
  into v_item
  from imaging_order_items ioi
  join imaging_orders io on io.id = ioi.imaging_order_id
  where ioi.id = p_imaging_order_item_id
  for update of ioi;

  if v_item.id is null then
    raise exception 'Imaging order item % not found', p_imaging_order_item_id;
  end if;

  select coalesce(active_role, role) into v_role
  from staff
  where id = p_staff_id and clinic_id = v_item.clinic_id and is_active = true;

  if v_role is null then
    raise exception 'Staff member not found or inactive in this clinic';
  end if;
  if v_role not in ('admin','doctor','lab_technician') then
    raise exception 'Staff role % cannot complete an imaging examination', v_role;
  end if;
  if v_item.status = 'cancelled' then
    raise exception 'Cannot complete a cancelled imaging item';
  end if;
  if nullif(trim(coalesce(p_report_text, '')), '') is null then
    raise exception 'An imaging report is required before completing the examination';
  end if;

  update imaging_order_items
  set status = 'completed',
      performed_by = coalesce(performed_by, p_staff_id),
      performed_at = coalesce(performed_at, now()),
      report_text = trim(p_report_text),
      reported_by = p_staff_id,
      reported_at = now()
  where id = p_imaging_order_item_id;

  select count(*) into v_remaining
  from imaging_order_items
  where imaging_order_id = v_item.imaging_order_id
    and status not in ('completed','cancelled');

  if v_remaining = 0 then
    update imaging_orders
    set status = 'completed', completed_at = now()
    where id = v_item.imaging_order_id;

    select status, encounter_type into v_visit_status, v_encounter_type
    from visits where id = v_item.visit_id;

    if v_visit_status = 'waiting_lab' and v_encounter_type = 'direct_imaging' then
      update visits set status = 'discharged' where id = v_item.visit_id;

      insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
      values (
        v_item.clinic_id, p_staff_id, 'visit.direct_imaging_completed',
        'visit', v_item.visit_id,
        jsonb_build_object('imaging_order_id', v_item.imaging_order_id)
      );
    end if;
  end if;
end;
$$;

revoke all on function public.complete_imaging_order_item(uuid,uuid,text) from public;
grant execute on function public.complete_imaging_order_item(uuid,uuid,text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. Reporting view: work queue + financial state
-- ----------------------------------------------------------------------------
create or replace view public.imaging_work_queue as
select
  ioi.id as item_id,
  io.id as imaging_order_id,
  io.clinic_id,
  io.visit_id,
  v.patient_id,
  p.full_name as patient_name,
  ic.id as imaging_catalog_id,
  ic.code,
  ic.name_en,
  ic.name_fr,
  ic.modality,
  ic.price_xaf,
  io.status as order_status,
  ioi.status as item_status,
  io.ordered_at,
  ioi.performed_at,
  ioi.reported_at,
  ioi.report_text,
  sc.id as service_charge_id,
  sc.amount_xaf as charge_amount_xaf,
  greatest(
    coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf,
    0
  ) as charge_balance_xaf,
  sc.status as charge_status
from imaging_order_items ioi
join imaging_orders io on io.id = ioi.imaging_order_id
join visits v on v.id = io.visit_id
join patients p on p.id = v.patient_id
join imaging_catalog ic on ic.id = ioi.imaging_catalog_id
left join service_charges sc on sc.id = ioi.service_charge_id;

comment on table public.imaging_catalog is
  'Clinic-scoped imaging/radiology catalogue with price and operational metadata.';
comment on table public.imaging_orders is
  'Imaging orders linked to a visit/encounter; supports direct imaging without consultation.';
comment on table public.imaging_order_items is
  'Billable imaging examination items linked to service charges and reports.';
