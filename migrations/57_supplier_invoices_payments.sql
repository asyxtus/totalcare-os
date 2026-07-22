-- ============================================================================
-- SUPPLIER INVOICES + PAYMENTS
-- Simpler than the patient-side billing (single payment per transaction,
-- no split-payment complexity needed here) — this tracks what the clinic
-- owes suppliers and when it's actually been paid.
-- ============================================================================

create type supplier_invoice_status as enum ('unpaid', 'partial', 'paid');

create table supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  purchase_order_id uuid references purchase_orders(id),
  invoice_number text,          -- the supplier's own invoice reference
  invoice_date date not null default current_date,
  due_date date,
  total_amount_xaf numeric(10,2) not null,
  amount_paid_xaf numeric(10,2) not null default 0,
  status supplier_invoice_status not null default 'unpaid',
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);

create table supplier_payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  supplier_invoice_id uuid not null references supplier_invoices(id),
  amount_xaf numeric(10,2) not null check (amount_xaf > 0),
  payment_method text,          -- free text: cash, MoMo, bank transfer, etc. — supplier
                                 -- payment methods are more varied than patient payment_method enum
  reference text,                -- transaction reference
  paid_by uuid references staff(id),
  paid_at timestamptz not null default now()
);

create or replace function record_supplier_invoice(
  p_clinic_id uuid,
  p_supplier_id uuid,
  p_purchase_order_id uuid,
  p_invoice_number text,
  p_invoice_date date,
  p_total_amount_xaf numeric,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_invoice_id uuid;
  v_terms_days int;
  v_due_date date;
begin
  select payment_terms_days into v_terms_days from suppliers where id = p_supplier_id;
  v_due_date := coalesce(p_invoice_date, current_date) + coalesce(v_terms_days, 0);

  insert into supplier_invoices (
    clinic_id, supplier_id, purchase_order_id, invoice_number, invoice_date, due_date, total_amount_xaf, created_by
  ) values (
    p_clinic_id, p_supplier_id, p_purchase_order_id, p_invoice_number,
    coalesce(p_invoice_date, current_date), v_due_date, p_total_amount_xaf, p_created_by
  )
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;

create or replace function record_supplier_payment(
  p_supplier_invoice_id uuid,
  p_amount_xaf numeric,
  p_payment_method text,
  p_reference text,
  p_paid_by uuid
)
returns void
language plpgsql
as $$
declare
  v_invoice record;
begin
  select * into v_invoice from supplier_invoices where id = p_supplier_invoice_id for update;
  if v_invoice.id is null then
    raise exception 'Supplier invoice % not found', p_supplier_invoice_id;
  end if;

  if v_invoice.amount_paid_xaf + p_amount_xaf > v_invoice.total_amount_xaf then
    raise exception 'Payment of % would exceed the invoice total (% already paid of %)',
      p_amount_xaf, v_invoice.amount_paid_xaf, v_invoice.total_amount_xaf;
  end if;

  insert into supplier_payments (clinic_id, supplier_invoice_id, amount_xaf, payment_method, reference, paid_by)
  values (v_invoice.clinic_id, p_supplier_invoice_id, p_amount_xaf, p_payment_method, p_reference, p_paid_by);

  update supplier_invoices set
    amount_paid_xaf = amount_paid_xaf + p_amount_xaf,
    status = case
      when amount_paid_xaf + p_amount_xaf >= total_amount_xaf then 'paid'
      else 'partial'
    end::supplier_invoice_status
  where id = p_supplier_invoice_id;
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- Financial commitments to suppliers stay admin-territory — pharmacist
-- can view (needs visibility into what's owed) but not create invoices
-- or record payments, unlike goods receipt which pharmacist owns fully.
-- ============================================================================
alter table supplier_invoices enable row level security;
alter table supplier_payments enable row level security;

create policy supplier_invoices_select on supplier_invoices for select
  using (clinic_id = current_staff_clinic_id());
create policy supplier_invoices_write on supplier_invoices for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
);

create policy supplier_payments_select on supplier_payments for select
  using (clinic_id = current_staff_clinic_id());
create policy supplier_payments_write on supplier_payments for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
);
