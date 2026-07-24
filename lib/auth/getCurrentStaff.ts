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
  primaryRole: StaffRole
  availableRoles: StaffRole[]
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
    .select('id, full_name, role, active_role, preferred_language, clinic_id, clinics(name, is_active)')
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

  // Every role this person can switch into (primary + any secondary
  // roles) — mirrors current_staff_available_roles() in the DB so the
  // switcher UI and the RLS-level validation of a switch request never
  // disagree about what's actually available.
  const { data: secondaryRoles } = await supabase
    .from('staff_secondary_roles')
    .select('role')
    .eq('staff_id', staff.id)
  const availableRoles = Array.from(new Set([staff.role, ...(secondaryRoles ?? []).map((r) => r.role)])) as StaffRole[]

  return {
    staffId: staff.id,
    // Effective role — what every permission check in the app should use.
    // Mirrors the DB's current_staff_role(): active_role if explicitly
    // switched, otherwise the primary role.
    role: (staff.active_role as StaffRole) ?? staff.role,
    primaryRole: staff.role,
    availableRoles,
    fullName: staff.full_name,
    clinicId: staff.clinic_id,
    clinicName: (staff.clinics as any)?.name ?? 'TotalCare OS',
    preferredLanguage: staff.preferred_language ?? 'fr',
  }
}
