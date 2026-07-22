-- ============================================================================
-- INSURANCE AGING REPORT
--
-- Answers: "Which insurers owe me money, how much, and how old is it?"
--
-- Two kinds of insurer receivable:
--   1. CLAIMED   — service charges bundled into an insurance_claim that has
--                  been submitted but not yet paid. Aged from submitted_at.
--   2. UNCLAIMED — service charges with insurer_portion_xaf > 0 that were
--                  never put into any claim. This is the invisible money:
--                  the insurer hasn't even been billed yet. Aged from the
--                  charge's created_at. (Donald Trump / Zenith case.)
--
-- Buckets: 0-30, 31-60, 61-90, 90+ days. All Africa/Douala dates.
-- ============================================================================

-- ── Summary: one row per insurer with totals + aging buckets ────────────────
create or replace function insurance_aging_summary(p_clinic_id uuid)
returns table (
  insurer_id        uuid,
  insurer_name      text,
  claimed_xaf       numeric,   -- submitted, awaiting insurer payment
  unclaimed_xaf     numeric,   -- never submitted to insurer yet
  total_owed_xaf    numeric,
  bucket_0_30       numeric,
  bucket_31_60      numeric,
  bucket_61_90      numeric,
  bucket_90_plus    numeric,
  oldest_days       int
)
language sql
stable
as $$
  with receivables as (
    -- CLAIMED: charges in a submitted-but-unpaid claim
    select
      claim.insurer_id,
      sc.insurer_portion_xaf as amount,
      'claimed'::text as kind,
      greatest(0, (current_date - date(timezone('Africa/Douala', coalesce(claim.submitted_at, claim.created_at))))) as age_days
    from insurance_claim_items ic
    join insurance_claims claim on claim.id = ic.claim_id
    join service_charges sc on sc.id = ic.service_charge_id
    where claim.clinic_id = p_clinic_id
      and claim.status in ('submitted', 'under_review', 'approved', 'partially_approved')
      and coalesce(sc.insurer_portion_xaf, 0) > 0

    union all

    -- UNCLAIMED: insured charges not in any claim
    select
      pi.insurer_id,
      sc.insurer_portion_xaf as amount,
      'unclaimed'::text as kind,
      greatest(0, (current_date - date(timezone('Africa/Douala', sc.created_at)))) as age_days
    from service_charges sc
    join patient_insurance pi on pi.patient_id = sc.patient_id and pi.is_active = true
    where sc.clinic_id = p_clinic_id
      and coalesce(sc.insurer_portion_xaf, 0) > 0
      and not exists (
        select 1 from insurance_claim_items ici where ici.service_charge_id = sc.id
      )
  )
  select
    i.id,
    i.name,
    coalesce(sum(r.amount) filter (where r.kind = 'claimed'), 0),
    coalesce(sum(r.amount) filter (where r.kind = 'unclaimed'), 0),
    coalesce(sum(r.amount), 0),
    coalesce(sum(r.amount) filter (where r.age_days <= 30), 0),
    coalesce(sum(r.amount) filter (where r.age_days between 31 and 60), 0),
    coalesce(sum(r.amount) filter (where r.age_days between 61 and 90), 0),
    coalesce(sum(r.amount) filter (where r.age_days > 90), 0),
    coalesce(max(r.age_days), 0)
  from insurers i
  join receivables r on r.insurer_id = i.id
  where i.clinic_id = p_clinic_id
  group by i.id, i.name
  having coalesce(sum(r.amount), 0) > 0
  order by coalesce(sum(r.amount), 0) desc
$$;

-- ── Detail: line-by-line receivables for one insurer ────────────────────────
create or replace function insurance_aging_detail(p_clinic_id uuid, p_insurer_id uuid)
returns table (
  service_charge_id uuid,
  patient_name      text,
  patient_code      text,
  description       text,
  category          text,
  insurer_owes_xaf  numeric,
  kind              text,       -- 'claimed' or 'unclaimed'
  claim_number      text,
  claim_status      text,
  age_days          int,
  charge_date       timestamptz
)
language sql
stable
as $$
  -- CLAIMED
  select
    sc.id,
    p.full_name,
    p.patient_code,
    sc.description,
    sc.category::text,
    sc.insurer_portion_xaf,
    'claimed'::text,
    claim.claim_number,
    claim.status,
    greatest(0, (current_date - date(timezone('Africa/Douala', coalesce(claim.submitted_at, claim.created_at))))),
    sc.created_at
  from insurance_claim_items ic
  join insurance_claims claim on claim.id = ic.claim_id
  join service_charges sc on sc.id = ic.service_charge_id
  join patients p on p.id = sc.patient_id
  where claim.clinic_id = p_clinic_id
    and claim.insurer_id = p_insurer_id
    and claim.status in ('submitted', 'under_review', 'approved', 'partially_approved')
    and coalesce(sc.insurer_portion_xaf, 0) > 0

  union all

  -- UNCLAIMED
  select
    sc.id,
    p.full_name,
    p.patient_code,
    sc.description,
    sc.category::text,
    sc.insurer_portion_xaf,
    'unclaimed'::text,
    null,
    null,
    greatest(0, (current_date - date(timezone('Africa/Douala', sc.created_at)))),
    sc.created_at
  from service_charges sc
  join patient_insurance pi on pi.patient_id = sc.patient_id and pi.is_active = true
  join patients p on p.id = sc.patient_id
  where sc.clinic_id = p_clinic_id
    and pi.insurer_id = p_insurer_id
    and coalesce(sc.insurer_portion_xaf, 0) > 0
    and not exists (
      select 1 from insurance_claim_items ici where ici.service_charge_id = sc.id
    )

  order by 10 desc  -- age_days descending: oldest first
$$;
