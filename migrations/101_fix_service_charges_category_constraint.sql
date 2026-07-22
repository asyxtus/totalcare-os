-- ============================================================================
-- FIX: service_charges_category_check missing 'admission' category
--
-- The DO block in the previous attempt dropped the old constraint, but the
-- ADD CONSTRAINT that followed failed because another constraint with the
-- same name already existed (likely from a partial previous run). This
-- version drops the constraint by exact name first, then recreates it.
-- ============================================================================

-- Drop whatever exists (IF EXISTS so it's safe to re-run)
alter table service_charges
  drop constraint if exists service_charges_category_check;

-- Also drop any other category check constraints found under a different name
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'service_charges'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table service_charges drop constraint %I', v_name);
    raise notice 'Dropped: %', v_name;
  end loop;
end;
$$;

-- Recreate with all four valid categories
alter table service_charges
  add constraint service_charges_category_check
  check (category in ('consultation', 'pharmacy', 'lab', 'admission'));
