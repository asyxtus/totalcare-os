-- ============================================================================
-- MIGRATION 138: IMPROVE POS STOCK ERROR DIAGNOSTICS
--
-- Distinguishes between:
--   1. enough sellable stock
--   2. insufficient sellable stock with expired stock present
--   3. insufficient sellable stock with quarantined/inactive batches present
--   4. genuinely insufficient physical stock
--
-- Important: this migration does NOT allow expired or quarantined stock to be
-- sold. It only makes the POS error explain why the requested quantity cannot
-- be fulfilled.
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
    raise exception 'Selling staff member is not active in this clinic';
  end if;

  if p_payment_method not in ('cash', 'momo', 'orange_money') then
    raise exception 'Invalid POS payment method: %', p_payment_method;
  end if;

  if p_cart is null
     or jsonb_typeof(p_cart) <> 'array'
     or jsonb_array_length(p_cart) = 0 then
    raise exception 'The POS cart is empty';
  end if;

  if p_patient_id is not null and not exists (
    select 1 from patients
    where id = p_patient_id and clinic_id = p_clinic_id
  ) then
    raise exception 'Patient does not belong to this clinic';
  end if;

  -- ========================================================================
  -- PASS 1: VALIDATE THE COMPLETE CART
  -- ========================================================================
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
      raise exception 'Quantity must be greater than zero for product %',
        v_cart_item->>'product_id';
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
      raise exception 'Product % not found in this clinic',
        v_cart_item->>'product_id';
    end if;

    if not v_product.is_active then
      raise exception 'Product "%" is inactive and cannot be sold via POS',
        v_product.name;
    end if;

    if v_product.sale_price_xaf is null or v_product.sale_price_xaf <= 0 then
      raise exception 'Product "%" has no valid sale price', v_product.name;
    end if;

    if v_product.is_controlled then
      raise exception
        'Controlled substance "%" cannot be sold via POS — use a prescription with a witness',
        v_product.name;
    end if;

    -- Physical stock includes all stock currently represented by active,
    -- non-depleted batches, regardless of expiry. This is useful for a clear
    -- diagnostic, but it is NEVER used to authorize a sale.
    select coalesce(sum(greatest(batch_quantity_on_hand(b.id), 0)), 0)::integer
      into v_physical_stock
    from batches b
    where b.product_id = v_product.id
      and b.clinic_id = p_clinic_id
      and b.status <> 'depleted';

    -- Sellable stock: active batches with a non-expired date.
    select coalesce(sum(greatest(batch_quantity_on_hand(b.id), 0)), 0)::integer
      into v_sellable_stock
    from batches b
    where b.product_id = v_product.id
      and b.clinic_id = p_clinic_id
      and b.status = 'active'
      and b.expiry_date >= current_date;

    -- Expired stock that still has units available.
    select coalesce(sum(greatest(batch_quantity_on_hand(b.id), 0)), 0)::integer
      into v_expired_stock
    from batches b
    where b.product_id = v_product.id
      and b.clinic_id = p_clinic_id
      and b.status = 'active'
      and b.expiry_date < current_date;

    -- Quarantined stock.
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
        raise exception
          'Stock insuffisant pour % : demandé %, stock vendable 0. Stock physique %, dont % unité(s) expirée(s). Lots expirés : %',
          v_product.name,
          v_quantity,
          v_physical_stock,
          v_expired_stock,
          coalesce(v_expired_batches, 'non spécifié');

      elsif v_expired_stock > 0 and v_sellable_stock > 0 then
        raise exception
          'Stock vendable insuffisant pour % : demandé %, vendable %. Stock physique %, dont % unité(s) expirée(s). Lots expirés : %',
          v_product.name,
          v_quantity,
          v_sellable_stock,
          v_physical_stock,
          v_expired_stock,
          coalesce(v_expired_batches, 'non spécifié');

      elsif v_quarantined_stock > 0 and v_sellable_stock = 0 then
        raise exception
          'Stock insuffisant pour % : demandé %, stock vendable 0. Stock physique %, dont % unité(s) en quarantaine. Lots en quarantaine : %',
          v_product.name,
          v_quantity,
          v_physical_stock,
          v_quarantined_stock,
          coalesce(v_quarantine_batches, 'non spécifié');

      elsif v_quarantined_stock > 0 then
        raise exception
          'Stock vendable insuffisant pour % : demandé %, vendable %. Stock physique %, dont % unité(s) en quarantaine. Lots en quarantaine : %',
          v_product.name,
          v_quantity,
          v_sellable_stock,
          v_physical_stock,
          v_quarantined_stock,
          coalesce(v_quarantine_batches, 'non spécifié');

      elsif v_inactive_batch_stock > 0 then
        raise exception
          'Stock vendable insuffisant pour % : demandé %, vendable %. Stock physique %, avec % unité(s) dans des lots non actifs',
          v_product.name,
          v_quantity,
          v_sellable_stock,
          v_inactive_batch_stock;

      else
        raise exception
          'Stock réellement insuffisant pour % : demandé %, stock vendable %, stock physique %',
          v_product.name,
          v_quantity,
          v_sellable_stock,
          v_physical_stock;
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
      raise exception 'Product % is no longer active',
        v_cart_item->>'product_id';
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
