// lib/supabase/admin.ts
// SERVER-ONLY. Uses the service role key, which bypasses RLS entirely —
// never import this into a client component or anything that could end
// up in a browser bundle. Reserved for genuinely privileged operations
// where the person performing them isn't the row being written (inviting
// a new staff member, changing someone else's role, deactivating an
// account) — the kind of action no RLS policy should quietly allow from
// the browser regardless of role.
//
// Every function that uses this client must independently verify the
// caller is an admin (via getCurrentStaff()) before doing anything,
// since this client itself enforces nothing.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) is not set — admin actions cannot run without it.')
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
