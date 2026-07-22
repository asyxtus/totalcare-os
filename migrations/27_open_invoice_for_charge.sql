-- ============================================================================
-- BILLING PATCH: OPEN AN INVOICE FOR A SINGLE CHARGE
-- register_visit_with_charge creates the consultation charge, but payment
-- collection in this system settles INVOICES, not raw charges. This is
-- the atomic bridge: wrap one charge into a one-line invoice, ready for
-- create_payment() to settle. Kept as its own function rather than raw
-- inserts from the frontend, matching the pattern used everywhere else —
-- one sanctioned way to perform a multi-table operation.
-- ============================================================================

create or replace function open_invoice_for_charge(
  p_service_charge_id uuid,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_charge record;
  v_invoice_id uuid;
begin
  select * into v_charge from service_charges where id = p_service_charge_id;
  if v_charge.id is null then
    raise exception 'Service charge % not found', p_service_charge_id;
  end if;

  insert into invoices (clinic_id, patient_id, visit_id, total_amount_xaf, created_by)
  values (v_charge.clinic_id, v_charge.patient_id, v_charge.visit_id, v_charge.amount_xaf, p_created_by)
  returning id into v_invoice_id;

  insert into invoice_items (invoice_id, service_charge_id, amount_xaf)
  values (v_invoice_id, p_service_charge_id, v_charge.amount_xaf);

  return v_invoice_id;
end;
$$;
