// lib/auth/getCurrentStaff.ts
// Single source of truth for "who is logged in, what's their role, which
// clinic are they in." Used by the layout (for nav) and now by every page
// that needs to scope a query or an insert to the right clinic — rather
// than each page re-writing this same fetch-and-check logic.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { StaffRole } from '@/lib/types'

export interface CurrentStaff {
  staffId: string
  fullName: string
  role: StaffRole
  clinicId: string
  clinicName: string
  preferredLanguage: 'fr' | 'en'
}

export async function getCurrentStaff(): Promise<CurrentStaff> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, full_name, role, preferred_language, clinic_id, clinics(name, is_active)')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!staff) {
    redirect('/login?error=no_staff_record')
  }

  // A suspended clinic (platform admin toggled it off) blocks every staff
  // member at that clinic on their very next request — this is the one
  // place that check needs to live, rather than repeating it on every page.
  if ((staff.clinics as any)?.is_active === false) {
    redirect('/login?error=clinic_suspended')
  }

  return {
    staffId: staff.id,
    fullName: staff.full_name,
    role: staff.role,
    clinicId: staff.clinic_id,
    clinicName: (staff.clinics as any)?.name ?? 'TotalCare OS',
    preferredLanguage: staff.preferred_language ?? 'fr',
  }
}
