-- ============================================================================
-- STAFF ADMIN MODULE: ROLE/STATUS CHANGES RESTRICTED TO ADMINS
--
-- The staff table's original SELECT policy (pre-dating this migration set)
-- already lets every authenticated staff member see clinic-mates by name —
-- confirmed necessary since name-resolution joins against staff.full_name
-- happen throughout the app (administered_by, recorded_by, dispensed_by,
-- etc.). This migration does not touch that.
--
-- What's missing is a scoped, additive UPDATE policy so the client can be
-- trusted to let an admin change someone's role or active status via the
-- normal RLS-scoped client. In practice the Admin module's server actions
-- perform these writes with the service-role client instead (staff being
-- deactivated is exactly the kind of privileged, act-on-someone-else write
-- RLS alone shouldn't be trusted with), so this policy is a defense-in-depth
-- backstop, not the only thing standing between a receptionist and the
-- ability to self-promote to admin.
--
-- Purely additive: a new, uniquely named policy, not a drop/replace of
-- anything already governing this table.
-- ============================================================================

create policy staff_admin_update_role_status on staff for update using (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
);
