-- ============================================================================
-- FIX: POS SALE CHECKOUT
--
-- The POS UI can only display active products, but the database function
-- previously did not enforce that invariant. It also accepted malformed or
-- non-positive quantities and did not explicitly validate the selling staff
-- member. Tighten the transaction boundary so a POS sale either completes
-- atomically or fails before creating any sale/stock rows.
-- ============================================================================

create or replace function public.record_pos_sale(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_sold_by uuid,
  p_payment_method payment_method,
  p_cart jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_cart_item jsonb;
  v_product record;
  v_total numeric(10,2) := 0;
  v_subtotal numeric(10,2);
  v_quantity integer;
  v_on_hand integer;
begin
  -- Caller/staff validation keeps the mutation scoped to the active clinic.
  if not exists (
    select 1
    from staff
    where id = p_sold_by
      and clinic_id = p_clinic_id
      and is_active = true
  ) then
    raise exception 'Selling staff member is not active in this clinic';
  end if;

  if p_payment_method not in ('cash', 'momo', 'orange_money') then
    raise exception 'Invalid POS payment method: %', p_payment_method;
  end if;

  if p_cart is null or jsonb_typeof(p_cart) <> 'array' or jsonb_array_length(p_cart) = 0 then
    raise exception 'The POS cart is empty';
  end if;

  if p_patient_id is not null and not exists (
    select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id
  ) then
    raise exception 'Patient does not belong to this clinic';
  end if;

  -- Pass 1: validate every line before inserting anything. This is important
  -- because one bad line must reject the entire cart, not leave a partial sale.
  for v_cart_item in select * from jsonb_array_elements(p_cart)
  loop
    if coalesce(v_cart_item->>'product_id', '') = '' then
      raise exception 'A POS cart line is missing its product';
    end if;

    begin
      v_quantity := (v_cart_item->>'quantity')::integer;
    exception when others then
      raise exception 'Invalid quantity for product %', v_cart_item->>'product_id';
    end;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Quantity must be greater than zero for product %', v_cart_item->>'product_id';
    end if;

    select
      pr.id,
      pr.sale_price_xaf,
      pr.is_active,
      coalesce(dc.is_controlled, false) as is_controlled
    into v_product
    from products pr
    left join drug_classes dc on dc.id = pr.drug_class_id
    where pr.id = (v_cart_item->>'product_id')::uuid
      and pr.clinic_id = p_clinic_id;

    if v_product.id is null then
      raise exception 'Product % not found in this clinic', v_cart_item->>'product_id';
    end if;

    if not v_product.is_active then
      raise exception 'Product % is inactive and cannot be sold', v_cart_item->>'product_id';
    end if;

    if v_product.sale_price_xaf is null or v_product.sale_price_xaf <= 0 then
      raise exception 'Product % has no valid sale price', v_cart_item->>'product_id';
    end if;

    if v_product.is_controlled then
      raise exception 'Controlled substances cannot be sold via POS — this must go through a prescription with a witness';
    end if;

    select coalesce(sum(batch_quantity_on_hand(b.id)), 0)::integer
      into v_on_hand
    from batches b
    where b.product_id = v_product.id
      and b.clinic_id = p_clinic_id
      and b.status = 'active'
      and b.expiry_date >= current_date;

    if v_on_hand < v_quantity then
      raise exception 'Insufficient stock for %: requested %, available %',
        v_product.id, v_quantity, v_on_hand;
    end if;
  end loop;

  -- Pass 2: create the sale and move stock in the same database transaction.
  insert into pos_sales (
    clinic_id, patient_id, sold_by, payment_method, total_amount_xaf
  ) values (
    p_clinic_id, p_patient_id, p_sold_by, p_payment_method, 0
  )
  returning id into v_sale_id;

  for v_cart_item in select * from jsonb_array_elements(p_cart)
  loop
    v_quantity := (v_cart_item->>'quantity')::integer;

    select pr.id, pr.sale_price_xaf
      into v_product
    from products pr
    where pr.id = (v_cart_item->>'product_id')::uuid
      and pr.clinic_id = p_clinic_id
      and pr.is_active = true;

    v_subtotal := v_product.sale_price_xaf * v_quantity;
    v_total := v_total + v_subtotal;

    perform dispense_fefo(
      p_clinic_id,
      v_product.id,
      v_quantity,
      'pos_sale',
      v_sale_id,
      p_sold_by,
      false,
      null,
      null,
      null,
      'sale'
    );

    insert into pos_sale_items (
      pos_sale_id, product_id, quantity, unit_price_xaf, subtotal_xaf
    ) values (
      v_sale_id, v_product.id, v_quantity, v_product.sale_price_xaf, v_subtotal
    );
  end loop;

  update pos_sales
  set total_amount_xaf = v_total
  where id = v_sale_id;

  return v_sale_id;
end;
$$;
