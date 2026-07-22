// lib/platformAdmin/session.ts
//
// Per-person platform admin sessions. Reuses the SAME Supabase auth
// session cookie the regular app uses (supabase.auth.getUser()) — a
// platform admin signs in with their own email + password like anyone
// else — but additionally requires an ACTIVE row in platform_admins for
// that auth user. Being logged into the main app as clinic staff does
// NOT grant platform-admin access; the two are checked independently.
//
// PLATFORM_ADMIN_SECRET still exists, but only for two narrow cases:
//   1. Bootstrapping the very first admin account (table is empty)
//   2. Emergency recovery if every admin is somehow locked out
// Normal day-to-day access never touches the secret.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface CurrentPlatformAdmin {
  id: string
  fullName: string
  email: string
}

export async function getCurrentPlatformAdmin(): Promise<CurrentPlatformAdmin | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // platform_admins has no RLS policies for `authenticated`, so this read
  // must go through the admin client even though we already verified the
  // caller's own identity above via their own session.
  const adminClient = createAdminClient()
  const { data: admin } = await adminClient
    .from('platform_admins')
    .select('id, full_name, email, is_active')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!admin) return null
  return { id: admin.id, fullName: admin.full_name, email: admin.email }
}

// Bootstrap-only: valid when the secret matches AND no admin accounts
// exist yet. Once the first admin is created, this always returns false —
// there is no ongoing "secret unlocks everything" mode.
export async function canBootstrapFirstAdmin(secret: string): Promise<boolean> {
  const expected = process.env.PLATFORM_ADMIN_SECRET
  if (!expected || secret !== expected) return false

  const adminClient = createAdminClient()
  const { count } = await adminClient.from('platform_admins').select('id', { count: 'exact', head: true })
  return (count ?? 0) === 0
}
