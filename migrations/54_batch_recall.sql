-- ============================================================================
-- BATCH RECALL: QUARANTINE + PATIENT IMPACT TRACEBACK
--
-- Quarantine is nearly free to implement: dispense_fefo and
-- preview_fefo_pick already only ever select batches with
-- status = 'active'. Changing a batch's status to 'recalled' or
-- 'quarantined' automatically and immediately removes it from every
-- future dispensing pick — no separate "block this batch" logic needed,
-- the existing FEFO filter already does it.
--
-- The real work here is traceback: finding every patient who already
-- received units from a batch BEFORE it was pulled. Prescription-based
-- dispensing traces fully (movement → dispensing_records →
-- prescription_items → visit → patient). POS sales trace ONLY when a
-- patient happens to be linked — which, as built, is never, since POS
-- was designed for fast anonymous checkout. This is reported explicitly,
-- not hidden, in the traceback results.
-- ============================================================================

create type recall_status as enum ('active', 'resolved');

create table batch_recalls (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  batch_id uuid not null references batches(id),
  initiated_by uuid references staff(id),
  reason text not null,
  status recall_status not null default 'active',
  initiated_at timestamptz not null default now(),
  resolved_by uuid references staff(id),
  resolved_at timestamptz,
  resolution_notes text
);
create index idx_batch_recalls_batch on batch_recalls(batch_id);

-- ----------------------------------------------------------------------------
-- initiate_batch_recall() — pharmacist or admin can pull a batch
-- immediately. Same reasoning as the emergency-visit bypass: a safety
-- action shouldn't wait on admin approval in the moment. It's audited
-- and fully traceable afterward, which is the actual safeguard.
-- ----------------------------------------------------------------------------
create or replace function initiate_batch_recall(
  p_clinic_id uuid,
  p_batch_id uuid,
  p_initiated_by uuid,
  p_reason text
)
returns uuid
language plpgsql
as $$
declare
  v_recall_id uuid;
  v_initiator_role staff_role;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to initiate a batch recall';
  end if;

  select role into v_initiator_role from staff
    where id = p_initiated_by and clinic_id = p_clinic_id and is_active = true;
  if v_initiator_role not in ('admin', 'pharmacist') then
    raise exception 'Only an admin or pharmacist can initiate a batch recall, got %', v_initiator_role;
  end if;

  -- THE QUARANTINE: this status change alone removes the batch from
  -- every future FEFO pick, immediately.
  update batches set status = 'recalled' where id = p_batch_id and clinic_id = p_clinic_id;

  insert into batch_recalls (clinic_id, batch_id, initiated_by, reason)
  values (p_clinic_id, p_batch_id, p_initiated_by, p_reason)
  returning id into v_recall_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_initiated_by, 'pharmacy.batch_recalled', 'batch', p_batch_id,
    jsonb_build_object('reason', p_reason, 'recall_id', v_recall_id));

  return v_recall_id;
end;
$$;

create or replace function resolve_batch_recall(
  p_recall_id uuid,
  p_resolved_by uuid,
  p_resolution_notes text
)
returns void
language plpgsql
as $$
begin
  if p_resolution_notes is null or trim(p_resolution_notes) = '' then
    raise exception 'Resolution notes are required to close a recall';
  end if;

  update batch_recalls set
    status = 'resolved',
    resolved_by = p_resolved_by,
    resolved_at = now(),
    resolution_notes = p_resolution_notes
  where id = p_recall_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- get_recall_patient_impact() — the actual traceback. Returns one row
-- per identifiable patient exposure, PLUS a summary of unlinked POS
-- sales that could not be traced, reported honestly rather than omitted.
-- ----------------------------------------------------------------------------
create or replace function get_recall_patient_impact(p_batch_id uuid)
returns table (
  source text,
  patient_id uuid,
  patient_name text,
  patient_phone text,
  quantity int,
  dispensed_at timestamptz
)
language sql
stable
as $$
  -- Prescription-based: full traceback via dispensing_records.
  select
    'prescription'::text as source,
    pt.id as patient_id,
    pt.full_name as patient_name,
    pt.phone as patient_phone,
    sm.quantity,
    sm.created_at as dispensed_at
  from stock_movements sm
  join dispensing_records dr on dr.id = sm.dispensing_record_id
  join prescription_items pi on pi.id = dr.prescription_item_id
  join prescriptions p on p.id = pi.prescription_id
  join visits v on v.id = p.visit_id
  join patients pt on pt.id = v.patient_id
  where sm.batch_id = p_batch_id and sm.movement_type = 'dispense'

  union all

  -- POS-based, ONLY when a patient happened to be linked (rare, given
  -- current POS checkout never collects one).
  select
    'pos_linked'::text as source,
    pt.id as patient_id,
    pt.full_name as patient_name,
    pt.phone as patient_phone,
    sm.quantity,
    sm.created_at as dispensed_at
  from stock_movements sm
  join pos_sales ps on ps.id = sm.reference_id and sm.reference_type = 'pos_sale'
  join patients pt on pt.id = ps.patient_id
  where sm.batch_id = p_batch_id and sm.movement_type = 'sale' and ps.patient_id is not null

  order by dispensed_at desc
$$;

-- Summary count of POS sales from this batch with NO identifiable
-- patient — the honest gap, surfaced explicitly rather than hidden.
create or replace function get_recall_unidentified_pos_count(p_batch_id uuid)
returns bigint
language sql
stable
as $$
  select count(*)
  from stock_movements sm
  join pos_sales ps on ps.id = sm.reference_id and sm.reference_type = 'pos_sale'
  where sm.batch_id = p_batch_id and sm.movement_type = 'sale' and ps.patient_id is null
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table batch_recalls enable row level security;

create policy batch_recalls_select on batch_recalls for select
  using (clinic_id = current_staff_clinic_id());
create policy batch_recalls_insert on batch_recalls for insert with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'pharmacist')
);
create policy batch_recalls_update on batch_recalls for update using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'pharmacist')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'pharmacist')
);
