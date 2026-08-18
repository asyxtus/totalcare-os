-- ============================================================================
-- MIGRATION 138: IMPROVE POS STOCK ERROR DIAGNOSTICS
--
-- Distinguishes between sellable, expired, quarantined, inactive-batch, and
-- genuinely insufficient stock without using PL/pgSQL RAISE format strings.
-- The latter avoids placeholder-count compilation errors.
--
-- This migration does NOT allow expired or quarantined stock to be sold.
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
security invoker
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_cart_item jsonb;
  v_product record;
  v_total numeric(10,2) := 0;
  v_subtotal numeric(10,2);
  v_quantity integer;
  v_sellable_stock integer;
  v_physical_stock integer;
  v_expired_stock integer;
  v_quarantined_stock integer;
  v_inactive_batch_stock integer;
  v_expired_batches text;
  v_quarantine_batches text;
begin
  -- ========================================================================
  -- BASIC VALIDATION
  -- ========================================================================

  if not exists (
    select 1 from staff
    where id = p_sold_by
      and clinic_id = p_clinic_id
      and is_active = true
  ) then
    raise exception using message = 'Selling staff member is not active in this clinic';
  end if;

  if p_payment_method not in ('cash', 'momo', 'orange_money') then
    raise exception using message = 'Invalid POS payment method: ' || p_payment_method::text;
  end if;

  if p_cart is null
     or jsonb_typeof(p_cart) <> 'array'
     or jsonb_array_length(p_cart) = 0 then
    raise exception using message = 'The POS cart is empty';
  end if;

  if p_patient_id is not null and not exists (
    select 1 from patients
    where id = p_patient_id and clinic_id = p_clinic_id
  ) then
    raise exception using message = 'Patient does not belong to this clinic';
  end if;

  -- ========================================================================
  -- PASS 1: VALIDATE THE COMPLETE CART
  -- ========================================================================
  for v_cart_item in select * from jsonb_array_elements(p_cart)
  loop
    if coalesce(v_cart_item->>'product_id', '') = '' then
      raise exception using message = 'A POS cart line is missing its product';
    end if;

    begin
      v_quantity := (v_cart_item->>'quantity')::integer;
    exception when others then
      raise exception using message =
        'Invalid quantity for product ' || coalesce(v_cart_item->>'product_id', '(unknown)');
    end;

    if v_quantity is null or v_quantity <= 0 then
      raise exception using message =
        'Quantity must be greater than zero for product ' || v_cart_item->>'product_id';
    end if;

    select
      pr.id,
      pr.name,
      pr.sale_price_xaf,
      pr.is_active,
      coalesce(dc.is_controlled, false) as is_controlled
    into v_product
    from products pr
    left join drug_classes dc on dc.id = pr.drug_class_id
    where pr.id = (v_cart_item->>'product_id')::uuid
      and pr.clinic_id = p_clinic_id;

    if v_product.id is null then
      raise exception using message =
        'Product ' || v_cart_item->>'product_id' || ' not found in this clinic';
    end if;

    if not v_product.is_active then
      raise exception using message =
        'Product "' || v_product.name || '" is inactive and cannot be sold via POS';
    end if;

    if v_product.sale_price_xaf is null or v_product.sale_price_xaf <= 0 then
      raise exception using message =
        'Product "' || v_product.name || '" has no valid sale price';
    end if;

    if v_product.is_controlled then
      raise exception using message =
        'Controlled substance "' || v_product.name ||
        '" cannot be sold via POS — use a prescription with a witness';
    end if;

    -- Physical stock includes stock in active, quarantined, and other
    -- non-depleted batches. It is diagnostic only and never authorizes a sale.
    select coalesce(sum(greatest(batch_quantity_on_hand(b.id), 0)), 0)::integer
      into v_physical_stock
    from batches b
    where b.product_id = v_product.id
      and b.clinic_id = p_clinic_id
      and b.status <> 'depleted';

    -- Sellable stock: active batches whose expiry date has not passed.
    select coalesce(sum(greatest(batch_quantity_on_hand(b.id), 0)), 0)::integer
      into v_sellable_stock
    from batches b
    where b.product_id = v_product.id
      and b.clinic_id = p_clinic_id
      and b.status = 'active'
      and b.expiry_date >= current_date;

    -- Expired stock with units remaining.
    select coalesce(sum(greatest(batch_quantity_on_hand(b.id), 0)), 0)::integer
      into v_expired_stock
    from batches b
    where b.product_id = v_product.id
      and b.clinic_id = p_clinic_id
      and b.status = 'active'
      and b.expiry_date < current_date;

    -- Quarantined stock with units remaining.
    select coalesce(sum(greatest(batch_quantity_on_hand(b.id), 0)), 0)::integer
      into v_quarantined_stock
    from batches b
    where b.product_id = v_product.id
      and b.clinic_id = p_clinic_id
      and b.status = 'quarantined';

    -- Other non-sellable, non-depleted batch states.
    select coalesce(sum(greatest(batch_quantity_on_hand(b.id), 0)), 0)::integer
      into v_inactive_batch_stock
    from batches b
    where b.product_id = v_product.id
      and b.clinic_id = p_clinic_id
      and b.status not in ('active', 'quarantined', 'depleted');

    if v_sellable_stock < v_quantity then
      select string_agg(
        coalesce(b.batch_number, b.id::text) ||
        ' (expire ' || to_char(b.expiry_date, 'DD/MM/YYYY') ||
        ', ' || greatest(batch_quantity_on_hand(b.id), 0)::text || ' unité(s))',
        ', ' order by b.expiry_date
      )
      into v_expired_batches
      from batches b
      where b.product_id = v_product.id
        and b.clinic_id = p_clinic_id
        and b.status = 'active'
        and b.expiry_date < current_date
        and batch_quantity_on_hand(b.id) > 0;

      select string_agg(
        coalesce(b.batch_number, b.id::text) ||
        ' (' || greatest(batch_quantity_on_hand(b.id), 0)::text || ' unité(s))',
        ', ' order by b.batch_number
      )
      into v_quarantine_batches
      from batches b
      where b.product_id = v_product.id
        and b.clinic_id = p_clinic_id
        and b.status = 'quarantined'
        and batch_quantity_on_hand(b.id) > 0;

      if v_expired_stock > 0 and v_sellable_stock = 0 then
        raise exception using message =
          'Stock insuffisant pour ' || v_product.name ||
          ' : demandé ' || v_quantity::text ||
          ', stock vendable 0. Stock physique ' || v_physical_stock::text ||
          ', dont ' || v_expired_stock::text ||
          ' unité(s) expirée(s). Lots expirés : ' ||
          coalesce(v_expired_batches, 'non spécifié');

      elsif v_expired_stock > 0 and v_sellable_stock > 0 then
        raise exception using message =
          'Stock vendable insuffisant pour ' || v_product.name ||
          ' : demandé ' || v_quantity::text ||
          ', vendable ' || v_sellable_stock::text ||
          '. Stock physique ' || v_physical_stock::text ||
          ', dont ' || v_expired_stock::text ||
          ' unité(s) expirée(s). Lots expirés : ' ||
          coalesce(v_expired_batches, 'non spécifié');

      elsif v_quarantined_stock > 0 and v_sellable_stock = 0 then
        raise exception using message =
          'Stock insuffisant pour ' || v_product.name ||
          ' : demandé ' || v_quantity::text ||
          ', stock vendable 0. Stock physique ' || v_physical_stock::text ||
          ', dont ' || v_quarantined_stock::text ||
          ' unité(s) en quarantaine. Lots en quarantaine : ' ||
          coalesce(v_quarantine_batches, 'non spécifié');

      elsif v_quarantined_stock > 0 then
        raise exception using message =
          'Stock vendable insuffisant pour ' || v_product.name ||
          ' : demandé ' || v_quantity::text ||
          ', vendable ' || v_sellable_stock::text ||
          '. Stock physique ' || v_physical_stock::text ||
          ', dont ' || v_quarantined_stock::text ||
          ' unité(s) en quarantaine. Lots en quarantaine : ' ||
          coalesce(v_quarantine_batches, 'non spécifié');

      elsif v_inactive_batch_stock > 0 then
        raise exception using message =
          'Stock vendable insuffisant pour ' || v_product.name ||
          ' : demandé ' || v_quantity::text ||
          ', vendable ' || v_sellable_stock::text ||
          '. Stock physique, avec ' || v_inactive_batch_stock::text ||
          ' unité(s) dans des lots non actifs';

      else
        raise exception using message =
          'Stock réellement insuffisant pour ' || v_product.name ||
          ' : demandé ' || v_quantity::text ||
          ', stock vendable ' || v_sellable_stock::text ||
          ', stock physique ' || v_physical_stock::text;
      end if;
    end if;
  end loop;

  -- ========================================================================
  -- PASS 2: CREATE SALE AND CONSUME STOCK ATOMICALLY
  -- ========================================================================

  insert into pos_sales (
    clinic_id, patient_id, sold_by, payment_method, total_amount_xaf
  )
  values (
    p_clinic_id, p_patient_id, p_sold_by, p_payment_method, 0
  )
  returning id into v_sale_id;

  for v_cart_item in select * from jsonb_array_elements(p_cart)
  loop
    v_quantity := (v_cart_item->>'quantity')::integer;

    select pr.id, pr.name, pr.sale_price_xaf
      into v_product
    from products pr
    where pr.id = (v_cart_item->>'product_id')::uuid
      and pr.clinic_id = p_clinic_id
      and pr.is_active = true;

    if v_product.id is null then
      raise exception using message =
        'Product ' || v_cart_item->>'product_id' || ' is no longer active';
    end if;

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
      'sale'::stock_movement_type
    );

    insert into pos_sale_items (
      pos_sale_id, product_id, quantity, unit_price_xaf, subtotal_xaf
    )
    values (
      v_sale_id,
      v_product.id,
      v_quantity,
      v_product.sale_price_xaf,
      v_subtotal
    );
  end loop;

  update pos_sales
  set total_amount_xaf = v_total
  where id = v_sale_id;

  return v_sale_id;
end;
$$;
