-- ============================================================================
-- DEPOSIT, STEP 2: LEDGER + FUNCTIONS
-- Design decision worth stating: applying a deposit to an invoice does
-- NOT bypass the real payment system. It calls the actual confirmed
-- create_payment() function underneath (with method='deposit'), so
-- invoices.amount_paid_xaf, service_charges' paid-down status, the
-- Cashier Queue, Patient Account balances, and Billing Revenue all see
-- it as a real payment automatically. This ledger table exists only to
-- track the deposit POOL itself (how much came in, how much has been
-- drawn down), not to duplicate payment status tracking that already
-- exists correctly elsewhere.
-- ============================================================================

create table patient_deposit_ledger (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id),
  entry_type text not null check (entry_type in ('deposit', 'application')),
  amount_xaf numeric(10,2) not null check (amount_xaf > 0),
  invoice_id uuid references invoices(id),
  payment_id uuid references payments(id),
  method text,
  staff_id uuid references staff(id),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_patient_deposit_ledger_patient on patient_deposit_ledger(patient_id);

alter table patient_deposit_ledger enable row level security;

create policy patient_deposit_ledger_select on patient_deposit_ledger for select
  using (clinic_id = current_staff_clinic_id());
create policy patient_deposit_ledger_insert on patient_deposit_ledger for insert with check (
  clinic_id = current_staff_clinic_id()
  and current_staff_role() in ('admin', 'receptionist', 'billing_clerk')
);

create or replace function record_patient_deposit(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_amount_xaf numeric,
  p_method text,
  p_received_by uuid,
  p_notes text default null
)
returns uuid
language plpgsql
as $$
declare
  v_ledger_id uuid;
begin
  if not exists (select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id) then
    raise exception 'Patient does not belong to this clinic';
  end if;
  if p_amount_xaf <= 0 then
    raise exception 'Deposit amount must be positive';
  end if;
  if p_method not in ('cash', 'momo', 'orange_money') then
    raise exception 'Invalid deposit funding method: %', p_method;
  end if;

  insert into patient_deposit_ledger (clinic_id, patient_id, entry_type, amount_xaf, method, staff_id, notes)
  values (p_clinic_id, p_patient_id, 'deposit', p_amount_xaf, p_method, p_received_by, p_notes)
  returning id into v_ledger_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_received_by, 'billing.deposit_recorded', 'patient', p_patient_id,
    jsonb_build_object('amount_xaf', p_amount_xaf, 'method', p_method));

  return v_ledger_id;
end;
$$;

create or replace function get_patient_deposit_balance(p_clinic_id uuid, p_patient_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(
    sum(case when entry_type = 'deposit' then amount_xaf else -amount_xaf end), 0
  )
  from patient_deposit_ledger
  where clinic_id = p_clinic_id and patient_id = p_patient_id
$$;

create or replace function apply_deposit_to_invoice(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_invoice_id uuid,
  p_amount_xaf numeric,
  p_applied_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_available numeric;
  v_payment_id uuid;
begin
  if not exists (select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id) then
    raise exception 'Patient does not belong to this clinic';
  end if;
  if not exists (select 1 from invoices where id = p_invoice_id and clinic_id = p_clinic_id and patient_id = p_patient_id) then
    raise exception 'Invoice does not belong to this patient in this clinic';
  end if;
  if p_amount_xaf <= 0 then
    raise exception 'Amount must be positive';
  end if;

  v_available := get_patient_deposit_balance(p_clinic_id, p_patient_id);
  if p_amount_xaf > v_available then
    raise exception 'Cannot apply % FCFA — only % FCFA available in deposit', p_amount_xaf, v_available;
  end if;

  v_payment_id := create_payment(
    p_invoice_id, p_amount_xaf, p_applied_by,
    jsonb_build_array(jsonb_build_object('method', 'deposit', 'amount', p_amount_xaf, 'provider_transaction_ref', null))
  );

  insert into patient_deposit_ledger (clinic_id, patient_id, entry_type, amount_xaf, invoice_id, payment_id, staff_id)
  values (p_clinic_id, p_patient_id, 'application', p_amount_xaf, p_invoice_id, v_payment_id, p_applied_by);

  return v_payment_id;
end;
$$;
