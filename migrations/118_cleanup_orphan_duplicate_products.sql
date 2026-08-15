-- ============================================================================
-- INVENTORY DUPLICATE CLEANUP
--
-- Removes only product rows that have NO downstream inventory/transaction
-- history and are duplicates of another product in the same clinic.
-- Products with batches, stock movements, dispensing, prescriptions,
-- POS sales, purchase orders, or goods receipts are NEVER deleted here.
--
-- IMPORTANT: This migration is intentionally conservative. It deactivates
-- orphan duplicates rather than hard-deleting them, preserving auditability.
-- ============================================================================

create or replace function cleanup_orphan_duplicate_products(p_clinic_id uuid)
returns table (
  product_id uuid,
  kept_product_id uuid,
  action text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select
      p.id as duplicate_id,
      (
        select k.id
        from products k
        where k.clinic_id = p.clinic_id
          and k.id <> p.id
          and k.is_active = true
          and k.normalized_name = p.normalized_name
          and coalesce(k.normalized_generic, '') = coalesce(p.normalized_generic, '')
          and coalesce(k.normalized_dosage_form, '') = coalesce(p.normalized_dosage_form, '')
          and coalesce(k.normalized_unit, '') = coalesce(p.normalized_unit, '')
          and not exists (select 1 from batches b where b.product_id = k.id)
          is false
        order by k.created_at asc nulls last, k.id
        limit 1
      ) as kept_id
    from products p
    where p.clinic_id = p_clinic_id
      and p.is_active = true
      and p.normalized_name is not null
      and not exists (select 1 from batches b where b.product_id = p.id)
      and not exists (select 1 from stock_movements sm where sm.batch_id in (select b.id from batches b where b.product_id = p.id))
      and not exists (select 1 from dispensing_records dr where dr.product_id = p.id)
      and not exists (select 1 from prescription_items pi where pi.product_id = p.id)
      and not exists (select 1 from pos_sale_items psi where psi.product_id = p.id)
      and not exists (select 1 from purchase_order_items poi where poi.product_id = p.id)
      and not exists (select 1 from goods_receipt_items gri where gri.product_id = p.id)
  ),
  valid as (
    select * from candidates where kept_id is not null
  ),
  updated as (
    update products p
    set is_active = false
    from valid v
    where p.id = v.duplicate_id
    returning p.id, v.kept_id
  )
  select u.id, u.kept_id, 'DEACTIVATED_ORPHAN_DUPLICATE'::text
  from updated u;
end;
$$;

comment on function cleanup_orphan_duplicate_products(uuid) is
'Conservatively deactivates active product duplicates with zero downstream inventory/transaction history. Does not delete historical products.';

-- Prevent future exact duplicates at the database level where the normalized
-- medication identity is complete. Existing historical duplicates are left
-- untouched.
create unique index if not exists uq_products_clinic_medication_identity
on products (
  clinic_id,
  normalized_name,
  normalized_generic,
  normalized_dosage_form,
  normalized_unit
)
where is_active = true
  and normalized_name is not null
  and normalized_dosage_form is not null
  and normalized_unit is not null;
