// lib/actions/myPreferences.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

// Changing your own display language. Goes through the service-role
// client for one specific reason: the staff table's UPDATE policy
// (94_staff_admin_management.sql) is deliberately admin-only, so a
// nurse changing her own language through the normal client would be
// silently blocked by RLS. Safe here because the target row is derived
// server-side from the caller's own session (never a client-supplied
// id) and exactly one non-privileged column is touched.
export async function setMyLanguageAction(lang: 'fr' | 'en') {
  if (lang !== 'fr' && lang !== 'en') return { error: 'Invalid language' }

  const staff = await getCurrentStaff()
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('staff')
    .update({ preferred_language: lang })
    .eq('id', staff.staffId)

  if (error) {
    console.error('setMyLanguage failed:', error)
    return { error: lang === 'fr' ? 'Impossible de changer la langue.' : 'Could not change language.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
