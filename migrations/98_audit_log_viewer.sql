-- ============================================================================
-- AUDIT LOG: READ ACCESS FOR ADMIN + AUDITOR
--
-- audit_log has been written to since early in this schema (visit
-- transitions, admissions, pharmacy, billing, insurance — and as of
-- this session, every staff/pricing admin action too), but nothing has
-- ever selected from it. No viewer, no policy verified for it.
--
-- 'auditor' already exists as a first-class staff_role (lib/types.ts)
-- with no other plausible purpose in this schema — this is what it's
-- for. Scoped read-only: an auditor gets visibility into everything
-- that happened, and no write access to anything, which is exactly the
-- oversight role implies. Admins get the same visibility, since they
-- already have write access to everything the log records anyway.
--
-- Purely additive — a new, uniquely named policy. If audit_log already
-- had a read policy from before this migration set, this doesn't touch
-- or replace it; RLS SELECT policies are OR'd together, so this only
-- ever widens legitimate visibility, never narrows it.
-- ============================================================================

create policy audit_log_select_admin_auditor on audit_log for select using (
  clinic_id = current_staff_clinic_id() and current_staff_role() in ('admin', 'auditor')
);
