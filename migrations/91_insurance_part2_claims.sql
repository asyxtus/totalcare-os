-- ============================================================================
-- INSURANCE, PART 2: CLAIMS
-- Purely internal tracking, per the earlier scoping decision — no
-- external insurer API integration. Claims bundle a set of insurer
-- portions owed by one insurer into a trackable unit. When the insurer
-- actually pays, that payment is recorded through the REAL
-- create_payment() pipeline (same pattern as Deposit) using the
-- distinct 'insurance' payment method, so invoices/Cashier Queue/
-- Billing Revenue all see it as a genuine, correctly-labeled payment.
-- ============================================================================

create table insurance_claims (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  insurer_id uuid not null references insurers(id),
  claim_number text,
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'under_review', 'approved', 'partially_approved', 'denied', 'paid'
  )),
  total_claimed_xaf numeric(10,2) not null default 0,
  total_approved_xaf numeric(10,2),
  submitted_at timestamptz,
  submitted_by uuid references staff(id),
  notes text,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);

create table insurance_claim_items (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references insurance_claims(id) on delete cascade,
  service_charge_id uuid not null references service_charges(id),
  amount_xaf numeric(10,2) not null
);
create index idx_insurance_claim_items_claim on insurance_claim_items(claim_id);
create unique index idx_insurance_claim_items_charge_unique on insurance_claim_items(service_charge_id);

create or replace function generate_next_claim_number(p_clinic_id uuid)
returns text
language plpgsql
as $$
declare
  v_next_number int;
begin
  perform pg_advisory_xact_lock(hashtext(p_clinic_id::text || '_claim'));

  select coalesce(max(substring(claim_number from 6)::int), 0) + 1 into v_next_number
  from insurance_claims
  where clinic_id = p_clinic_id and claim_number ~ '^CLM-[0-9]+$';

  return 'CLM-' || lpad(v_next_number::text, 5, '0');
end;
$$;

create or replace function create_insurance_claim(
  p_clinic_id uuid,
  p_insurer_id uuid,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_claim_id uuid;
  v_claim_number text;
  v_total numeric(10,2);
begin
  if not exists (select 1 from insurers where id = p_insurer_id and clinic_id = p_clinic_id) then
    raise exception 'Insurer does not belong to this clinic';
  end if;

  select coalesce(sum(sc.insurer_portion_xaf), 0) into v_total
  from service_charges sc
  where sc.clinic_id = p_clinic_id
    and sc.insurer_id = p_insurer_id
    and sc.status <> 'void'
    and sc.id not in (select service_charge_id from insurance_claim_items);

  if v_total = 0 then
    raise exception 'No unclaimed charges found for this insurer';
  end if;

  v_claim_number := generate_next_claim_number(p_clinic_id);

  insert into insurance_claims (clinic_id, insurer_id, claim_number, total_claimed_xaf, created_by)
  values (p_clinic_id, p_insurer_id, v_claim_number, v_total, p_created_by)
  returning id into v_claim_id;

  insert into insurance_claim_items (claim_id, service_charge_id, amount_xaf)
  select v_claim_id, sc.id, sc.insurer_portion_xaf
  from service_charges sc
  where sc.clinic_id = p_clinic_id
    and sc.insurer_id = p_insurer_id
    and sc.status <> 'void'
    and sc.id not in (select service_charge_id from insurance_claim_items where claim_id <> v_claim_id);

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_created_by, 'insurance.claim_created', 'insurance_claim', v_claim_id,
    jsonb_build_object('claim_number', v_claim_number, 'total_xaf', v_total));

  return v_claim_id;
end;
$$;

create or replace function submit_insurance_claim(
  p_clinic_id uuid,
  p_claim_id uuid,
  p_submitted_by uuid
)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from insurance_claims where id = p_claim_id and clinic_id = p_clinic_id and status = 'draft') then
    raise exception 'Claim not found, not in this clinic, or not in draft status';
  end if;

  update insurance_claims
    set status = 'submitted', submitted_at = now(), submitted_by = p_submitted_by
    where id = p_claim_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_submitted_by, 'insurance.claim_submitted', 'insurance_claim', p_claim_id, '{}'::jsonb);
end;
$$;

create or replace function update_claim_status(
  p_clinic_id uuid,
  p_claim_id uuid,
  p_status text,
  p_updated_by uuid,
  p_total_approved_xaf numeric default null,
  p_notes text default null
)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from insurance_claims where id = p_claim_id and clinic_id = p_clinic_id) then
    raise exception 'Claim not found in this clinic';
  end if;
  if p_status not in ('under_review', 'approved', 'partially_approved', 'denied', 'paid') then
    raise exception 'Invalid claim status: %', p_status;
  end if;

  update insurance_claims set
    status = p_status,
    total_approved_xaf = coalesce(p_total_approved_xaf, total_approved_xaf),
    notes = coalesce(p_notes, notes)
  where id = p_claim_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_updated_by, 'insurance.claim_status_updated', 'insurance_claim', p_claim_id,
    jsonb_build_object('status', p_status, 'total_approved_xaf', p_total_approved_xaf));
end;
$$;

create or replace function record_claim_payment(
  p_clinic_id uuid,
  p_claim_id uuid,
  p_amount_received_xaf numeric,
  p_received_by uuid
)
returns void
language plpgsql
as $$
declare
  v_claim record;
  v_item record;
  v_ratio numeric;
  v_item_payment numeric(10,2);
  v_invoice_id uuid;
begin
  select * into v_claim from insurance_claims where id = p_claim_id and clinic_id = p_clinic_id;
  if v_claim.id is null then
    raise exception 'Claim not found in this clinic';
  end if;
  if p_amount_received_xaf <= 0 or p_amount_received_xaf > v_claim.total_claimed_xaf then
    raise exception 'Amount received must be positive and cannot exceed the claimed total of %', v_claim.total_claimed_xaf;
  end if;

  v_ratio := p_amount_received_xaf / v_claim.total_claimed_xaf;

  for v_item in
    select ici.service_charge_id, ici.amount_xaf, sc.status as charge_status
    from insurance_claim_items ici
    join service_charges sc on sc.id = ici.service_charge_id
    where ici.claim_id = p_claim_id
  loop
    if v_item.charge_status = 'void' then
      continue;
    end if;

    v_item_payment := round(v_item.amount_xaf * v_ratio, 2);
    if v_item_payment <= 0 then
      continue;
    end if;

    select ii.invoice_id into v_invoice_id
    from invoice_items ii
    where ii.service_charge_id = v_item.service_charge_id
    limit 1;

    if v_invoice_id is not null then
      perform create_payment(
        v_invoice_id, v_item_payment, p_received_by,
        jsonb_build_array(jsonb_build_object('method', 'insurance', 'amount', v_item_payment, 'provider_transaction_ref', v_claim.claim_number))
      );
    end if;
  end loop;

  update insurance_claims set status = 'paid', total_approved_xaf = p_amount_received_xaf
  where id = p_claim_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_received_by, 'insurance.claim_paid', 'insurance_claim', p_claim_id,
    jsonb_build_object('amount_received_xaf', p_amount_received_xaf));
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table insurance_claims enable row level security;
alter table insurance_claim_items enable row level security;

create policy insurance_claims_select on insurance_claims for select using (clinic_id = current_staff_clinic_id());
create policy insurance_claims_write on insurance_claims for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'billing_clerk')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'billing_clerk')
);

create policy insurance_claim_items_select on insurance_claim_items for select using (
  claim_id in (select id from insurance_claims where clinic_id = current_staff_clinic_id())
);
