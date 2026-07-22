-- ============================================================================
-- FOUNDATION PATCH: AUDIT LOG INSERT POLICY (fixes a systemic bug)
--
-- audit_log was deliberately built with NO insert policy at all — the
-- original intent was "nobody writes here directly, only trusted
-- functions do." But none of those functions were ever marked
-- SECURITY DEFINER, so they all run as the calling staff member, and
-- every one of them has been silently blocked from writing its own
-- audit entry since the day each was created. This was invisible during
-- SQL Editor testing (which runs as the Postgres superuser and bypasses
-- RLS entirely) and only surfaced now that real staff accounts are
-- calling these functions through the actual app.
--
-- Fix: allow any active staff member to insert an audit_log row for
-- their OWN clinic. This does not weaken the table's core guarantee —
-- there is still no UPDATE or DELETE policy on this table for anyone,
-- so history still cannot be rewritten. This only allows the additions
-- that dozens of already-authorized functions have been trying and
-- failing to make the whole time. The actual sensitive action in each
-- of those functions (role checks, reason requirements, two-person
-- checks) was never the problem — only this one bookkeeping side effect
-- was silently failing underneath it.
-- ============================================================================

create policy audit_insert on audit_log for insert
  with check (clinic_id = current_staff_clinic_id());
