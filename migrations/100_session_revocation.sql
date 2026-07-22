-- ============================================================================
-- SESSION REVOCATION ON STAFF DEACTIVATION
-- From BACKLOG.md: "deactivating a staff row doesn't yet force-kill
-- their active session." Real and current — toggleStaffActiveAction
-- (built this session) sets is_active = false, but a deactivated staff
-- member's existing browser session keeps working until their JWT
-- naturally expires, which could be up to an hour.
--
-- The obvious-looking fix (supabase-js's `auth.admin.signOut()`) is a
-- dead end: that method revokes the session belonging to the JWT you
-- pass it — i.e. a user signing themselves out via a trusted server
-- context. There is no supabase-js method for an admin to revoke a
-- DIFFERENT user's sessions by their user ID. Confirmed against
-- Supabase's own team responses on this exact question before writing
-- a single line here, not assumed — this is precisely the class of
-- "guessed a function signature, shipped something that compiles but
-- does nothing" mistake BACKLOG.md itself catalogs repeatedly.
--
-- The actual working mechanism, per Supabase's own engineers in that
-- same discussion: DELETE directly from auth.sessions and
-- auth.refresh_tokens for that user. This is Supabase's internal auth
-- schema, not one of ours — flagged honestly rather than assumed
-- stable: if a future Supabase Auth version changes these table/column
-- names, this function is the one place that would need updating.
-- ============================================================================

create or replace function revoke_staff_sessions(p_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from auth.refresh_tokens where user_id = p_auth_user_id::text;
  delete from auth.sessions where user_id = p_auth_user_id;
end;
$$;

-- Same lockdown as every other cross-cutting system function this
-- session: only the service-role client can call this, never a logged-
-- in staff session regardless of role. A function that can force-log-
-- out any user in the system is exactly the kind of thing RLS alone
-- shouldn't be trusted to gate.
revoke all on function revoke_staff_sessions(uuid) from public, anon, authenticated;
