-- ============================================================================
-- INVENTORY DUPLICATE CLEANUP
--
-- IMPORTANT: normalized_name / normalized_generic / normalized_dosage_form /
-- normalized_unit are NOT physical columns on public.products. They were
-- derived in an earlier diagnostic query. This migration therefore compares
-- the real products columns directly using normalized expressions.
--
-- This migration is deliberately conservative: it DEACTIVATES orphan
-- duplicates. It does not hard-delete products or historical records.
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
          and lower(trim(k.name)) = lower(trim(p.name))
          and lower(trim(coalesce(k.generic_name, ''))) = lower(trim(coalesce(p.generic_name, '')))
          and lower(trim(coalesce(k.dosage_form, ''))) = lower(trim(coalesce(p.dosage_form, '')))
          and lower(trim(coalesce(k.unit, ''))) = lower(trim(coalesce(p.unit, '')))
        order by
          (
            exists (select 1 from batches hb where hb.product_id = k.id)
            or exists (select 1 from dispensing_records hdr where hdr.product_id = k.id)
            or exists (select 1 from prescription_items hpi where hpi.product_id = k.id)
            or exists (select 1 from pos_sale_items hpsi where hpsi.product_id = k.id)
            or exists (select 1 from purchase_order_items hpoi where hpoi.product_id = k.id)
            or exists (select 1 from goods_receipt_items hgri where hgri.product_id = k.id)
          ) desc,
          k.id
        limit 1
      ) as kept_id
    from products p
    where p.clinic_id = p_clinic_id
      and p.is_active = true
      -- Only products with ZERO downstream history are eligible for cleanup.
      and not exists (select 1 from batches b where b.product_id = p.id)
      and not exists (select 1 from dispensing_records dr where dr.product_id = p.id)
      and not exists (select 1 from prescription_items pi where pi.product_id = p.id)
      and not exists (select 1 from pos_sale_items psi where psi.product_id = p.id)
      and not exists (select 1 from purchase_order_items poi where poi.product_id = p.id)
      and not exists (select 1 from goods_receipt_items gri where gri.product_id = p.id)
      and exists (
        select 1
        from products d
        where d.clinic_id = p.clinic_id
          and d.id <> p.id
          and d.is_active = true
          and lower(trim(d.name)) = lower(trim(p.name))
          and lower(trim(coalesce(d.generic_name, ''))) = lower(trim(coalesce(p.generic_name, '')))
          and lower(trim(coalesce(d.dosage_form, ''))) = lower(trim(coalesce(p.dosage_form, '')))
          and lower(trim(coalesce(d.unit, ''))) = lower(trim(coalesce(p.unit, '')))
      )
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
  select
    u.id,
    u.kept_id,
    'DEACTIVATED_ORPHAN_DUPLICATE'::text
  from updated u;
end;
$$;

comment on function cleanup_orphan_duplicate_products(uuid) is
'Conservatively deactivates active product duplicates with zero downstream inventory/transaction history. Compares real products columns rather than diagnostic normalized aliases. Does not delete historical products.';

-- DO NOT create a unique index yet. Existing duplicate active products must
-- first be cleaned up. A separate follow-up migration should add the unique
-- constraint after the cleanup has been verified in production.
