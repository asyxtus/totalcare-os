-- ============================================================================
-- LAB MODULE, STEP 3: RESULTS + IMAGE ATTACHMENTS + VERIFICATION
--
-- Key design decisions, made explicit rather than silently assumed:
--   1. Verification does NOT require a second person. Many clinics run
--      with one lab tech on duty — requiring two would just mean results
--      never get verified. The same tech can enter, review, and verify.
--   2. Critical values reach the doctor IMMEDIATELY, regardless of
--      verification status. A dangerous potassium shouldn't sit waiting
--      on a bureaucratic step — the frontend will show unverified
--      results with a clear "not yet validated" label, but never hide a
--      critical flag behind that label.
--   3. Completing a lab_order_item only requires SOMETHING documented —
--      at least one result row OR one attachment — not every single
--      component of a panel filled in. Real lab work is sometimes
--      partial (a torn sample, an equipment limit); a rigid all-13-
--      fields-required gate would block legitimate partial results.
-- ============================================================================

create table lab_results (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  lab_order_item_id uuid not null references lab_order_items(id) on delete cascade,
  lab_test_catalog_id uuid not null references lab_test_catalog(id),
  numeric_value numeric,
  qualitative_value text,
  -- Snapshot at entry time — same reasoning as vitals: a later change to
  -- the clinic's reference range must not silently reinterpret a result
  -- that was flagged (or not) under the range that applied when it was
  -- actually entered.
  reference_range_low numeric,
  reference_range_high numeric,
  critical_low numeric,
  critical_high numeric,
  is_abnormal boolean not null default false,
  is_critical boolean not null default false,
  recorded_by uuid references staff(id),
  recorded_at timestamptz not null default now(),
  verified_by uuid references staff(id),
  verified_at timestamptz,
  notes text
);
create index idx_lab_results_item on lab_results(lab_order_item_id);

-- ----------------------------------------------------------------------------
-- Auto-flag at entry time, using effective_lab_test_range() — the same
-- single source of truth the whole module reads from, so an override set
-- via set_lab_test_range_override() is honored here automatically.
-- ----------------------------------------------------------------------------
create or replace function evaluate_lab_result_flag()
returns trigger
language plpgsql
as $$
declare
  v_range record;
begin
  select * into v_range from effective_lab_test_range(new.clinic_id, new.lab_test_catalog_id);

  new.reference_range_low := v_range.reference_range_low;
  new.reference_range_high := v_range.reference_range_high;
  new.critical_low := v_range.critical_low;
  new.critical_high := v_range.critical_high;

  if new.numeric_value is not null then
    new.is_abnormal := (v_range.reference_range_low is not null and new.numeric_value < v_range.reference_range_low)
                     or (v_range.reference_range_high is not null and new.numeric_value > v_range.reference_range_high);
    new.is_critical := (v_range.critical_low is not null and new.numeric_value < v_range.critical_low)
                     or (v_range.critical_high is not null and new.numeric_value > v_range.critical_high);
  elsif new.qualitative_value is not null then
    new.is_abnormal := v_range.abnormal_qualitative_values is not null
                     and new.qualitative_value = any(v_range.abnormal_qualitative_values);
    new.is_critical := v_range.critical_qualitative_values is not null
                     and new.qualitative_value = any(v_range.critical_qualitative_values);
  end if;

  return new;
end;
$$;

create trigger trg_lab_result_flag
  before insert or update on lab_results
  for each row
  execute function evaluate_lab_result_flag();

-- ----------------------------------------------------------------------------
-- IMAGE ATTACHMENTS — the actual answer to "typing 13 FBC values takes
-- too long." A lab tech can attach a photo of the printed report to the
-- ORDER ITEM (the whole panel) instead of, or alongside, typed values.
--
-- REQUIRES a Supabase Storage bucket named 'lab-attachments' to exist —
-- this is NOT something SQL alone can create. In the Supabase dashboard:
-- Storage -> New bucket -> name it 'lab-attachments' -> keep it PRIVATE
-- (not public), since these are patient results. Access is controlled
-- through the storage policies below, matching the same clinic-scoping
-- as everything else.
-- ----------------------------------------------------------------------------
create table lab_result_attachments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  lab_order_item_id uuid not null references lab_order_items(id) on delete cascade,
  file_path text not null,        -- path within the 'lab-attachments' storage bucket
  file_type text,                 -- e.g. 'image/jpeg', 'application/pdf'
  uploaded_by uuid references staff(id),
  uploaded_at timestamptz not null default now(),
  caption text
);
create index idx_lab_attachments_item on lab_result_attachments(lab_order_item_id);

-- ----------------------------------------------------------------------------
-- complete_lab_order_item() — the gate. Requires SOMETHING documented,
-- not every field. Also auto-verifies nothing — verification is always
-- a separate, deliberate action via verify_lab_result() below.
-- ----------------------------------------------------------------------------
create or replace function complete_lab_order_item(
  p_lab_order_item_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
as $$
declare
  v_has_result boolean;
  v_has_attachment boolean;
begin
  select exists(select 1 from lab_results where lab_order_item_id = p_lab_order_item_id) into v_has_result;
  select exists(select 1 from lab_result_attachments where lab_order_item_id = p_lab_order_item_id) into v_has_attachment;

  if not v_has_result and not v_has_attachment then
    raise exception 'Cannot complete: no result value or attachment has been recorded for this item';
  end if;

  update lab_order_items set status = 'completed' where id = p_lab_order_item_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- verify_lab_result() — deliberate separate step, same person allowed.
-- ----------------------------------------------------------------------------
create or replace function verify_lab_result(
  p_lab_result_id uuid,
  p_verified_by uuid
)
returns void
language plpgsql
as $$
declare
  v_result record;
  v_verifier_role staff_role;
begin
  select * into v_result from lab_results where id = p_lab_result_id;
  if v_result.id is null then
    raise exception 'Lab result % not found', p_lab_result_id;
  end if;

  select role into v_verifier_role from staff
    where id = p_verified_by and clinic_id = v_result.clinic_id and is_active = true;
  if v_verifier_role not in ('lab_technician', 'admin') then
    raise exception 'Only a lab technician or admin can verify a result, got %', v_verifier_role;
  end if;

  update lab_results set verified_by = p_verified_by, verified_at = now() where id = p_lab_result_id;
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table lab_results enable row level security;
alter table lab_result_attachments enable row level security;

create policy lab_results_select on lab_results for select
  using (clinic_id = current_staff_clinic_id());
create policy lab_results_write on lab_results for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin','lab_technician')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin','lab_technician')
);

create policy lab_attachments_select on lab_result_attachments for select
  using (clinic_id = current_staff_clinic_id());
create policy lab_attachments_write on lab_result_attachments for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin','lab_technician')
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin','lab_technician')
);

-- ============================================================================
-- STORAGE BUCKET ACCESS POLICIES
-- lab_result_attachments tracks WHICH files exist and who they belong to,
-- but Supabase Storage has its OWN separate permission layer
-- (storage.objects) that must also be locked down — otherwise the file
-- itself could be readable by anyone with the path, even if our own
-- table correctly restricts who knows that path exists.
--
-- This assumes uploaded files are stored with clinic_id as the first
-- path segment, e.g.: {clinic_id}/{lab_order_item_id}/{filename}.jpg
-- The upload code (built alongside the lab tech's screen, next step)
-- MUST follow this convention for these policies to actually restrict
-- anything — a flat filename with no clinic_id prefix would defeat this
-- entirely.
-- ============================================================================

create policy lab_attachments_storage_select on storage.objects for select
  using (
    bucket_id = 'lab-attachments'
    and (storage.foldername(name))[1] = current_staff_clinic_id()::text
  );

create policy lab_attachments_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'lab-attachments'
    and (storage.foldername(name))[1] = current_staff_clinic_id()::text
    and current_staff_role() in ('admin', 'lab_technician')
  );

-- ============================================================================
-- LAB MODULE CORE COMPLETE:
--   test catalog (with editable reference ranges) -> orders (with
--   auto-charge, no charge for external) -> results (with critical
--   flagging) -> image attachments -> verification
-- Remaining: lab tech's own screen, doctor's results-viewing panel,
-- and the doctor's "order labs" UI on the consultation screen
-- (currently shows "not available yet" — this is what unlocks it).
-- ============================================================================
