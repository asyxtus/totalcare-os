-- ============================================================================
-- FIX: dispensing_records HAD NO UPDATE POLICY AT ALL
-- Only INSERT and SELECT policies existed. dispense_prescription_item
-- updates this table twice after the initial insert (setting
-- batch_allocations, then service_charge_id) — with no UPDATE policy,
-- RLS defaults to denying it, and Postgres does NOT raise an error for
-- an UPDATE that matches zero rows. The insert succeeded, both updates
-- silently did nothing, and the resulting row just looked incomplete
-- forever with no error anywhere in the chain to point at why.
-- ============================================================================

create policy dispensing_records_update on dispensing_records for update
  using (clinic_id = current_staff_clinic_id())
  with check (
    clinic_id = current_staff_clinic_id()
    and current_staff_role() in ('admin', 'pharmacist')
  );
