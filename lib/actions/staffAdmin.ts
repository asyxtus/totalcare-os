// lib/actions/staffAdmin.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { ALL_ROLES } from '@/lib/roleMeta'
import type { StaffRole } from '@/lib/types'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

async function requireAdmin() {
  const staff = await getCurrentStaff()
  if (staff.role !== 'admin') {
    throw new Error('Admin access required.')
  }
  return staff
}

async function countActiveAdmins(clinicId: string, excludeStaffId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('staff')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('role', 'admin')
    .eq('is_active', true)
  if (excludeStaffId) query = query.neq('id', excludeStaffId)
  const { count } = await query
  return count ?? 0
}

export async function inviteStaffAction(formData: FormData) {
  let admin
  try {
    admin = await requireAdmin()
  } catch {
    return { error: 'Seul un administrateur peut inviter du personnel.' }
  }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const fullName = (formData.get('full_name') as string)?.trim()
  const role = formData.get('role') as StaffRole
  const preferredLanguage = (formData.get('preferred_language') as string) === 'en' ? 'en' : 'fr'

  if (!email || !email.includes('@')) return { error: 'Une adresse email valide est requise.' }
  if (!fullName) return { error: 'Le nom complet est requis.' }
  if (!ALL_ROLES.includes(role)) return { error: 'Rôle invalide.' }

  const adminClient = createAdminClient()

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  })

  if (inviteError || !invited?.user) {
    return friendlyError(
      'inviteUserByEmail',
      inviteError?.message?.includes('already been registered')
        ? 'Cette adresse email est déjà associée à un compte.'
        : "Impossible d'envoyer l'invitation.",
      inviteError
    )
  }

  const { data: newStaffRow, error: staffInsertError } = await adminClient.from('staff').insert({
    auth_user_id: invited.user.id,
    clinic_id: admin.clinicId,
    full_name: fullName,
    role,
    preferred_language: preferredLanguage,
    is_active: true,
  }).select('id').maybeSingle()

  if (staffInsertError) {
    // Roll back the auth user so a failed staff-row insert doesn't leave
    // an orphaned account nobody can see or re-invite over.
    await adminClient.auth.admin.deleteUser(invited.user.id)
    return friendlyError('staff insert', "Impossible de créer la fiche personnel — l'invitation a été annulée.", staffInsertError)
  }

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'staff.invited',
    entity_type: 'staff', entity_id: newStaffRow?.id ?? null,
    details: { full_name: fullName, email, role },
  })

  revalidatePath('/admin')
  return { success: true }
}

export async function updateStaffRoleAction(staffId: string, newRole: StaffRole) {
  let admin
  try {
    admin = await requireAdmin()
  } catch {
    return { error: 'Seul un administrateur peut modifier les rôles.' }
  }

  if (!ALL_ROLES.includes(newRole)) return { error: 'Rôle invalide.' }
  if (staffId === admin.staffId) return { error: 'Vous ne pouvez pas modifier votre propre rôle depuis cet écran.' }

  const adminClient = createAdminClient()
  const { data: target } = await adminClient.from('staff').select('id, role, clinic_id').eq('id', staffId).maybeSingle()
  if (!target || target.clinic_id !== admin.clinicId) return { error: 'Membre du personnel introuvable.' }

  if (target.role === 'admin' && newRole !== 'admin') {
    const remaining = await countActiveAdmins(admin.clinicId, staffId)
    if (remaining === 0) {
      return { error: 'Impossible : ce membre est le seul administrateur actif de la clinique.' }
    }
  }

  const { error } = await adminClient.from('staff').update({ role: newRole }).eq('id', staffId)
  if (error) return friendlyError('updateStaffRole', 'Impossible de mettre à jour le rôle.', error)

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'staff.role_changed',
    entity_type: 'staff', entity_id: staffId,
    details: { old_role: target.role, new_role: newRole },
  })

  revalidatePath('/admin')
  return { success: true }
}

export async function toggleStaffActiveAction(staffId: string, makeActive: boolean) {
  let admin
  try {
    admin = await requireAdmin()
  } catch {
    return { error: 'Seul un administrateur peut activer ou désactiver un compte.' }
  }

  if (staffId === admin.staffId) return { error: 'Vous ne pouvez pas désactiver votre propre compte.' }

  const adminClient = createAdminClient()
  const { data: target } = await adminClient.from('staff').select('id, role, clinic_id, is_active, auth_user_id').eq('id', staffId).maybeSingle()
  if (!target || target.clinic_id !== admin.clinicId) return { error: 'Membre du personnel introuvable.' }

  if (!makeActive && target.role === 'admin') {
    const remaining = await countActiveAdmins(admin.clinicId, staffId)
    if (remaining === 0) {
      return { error: 'Impossible : ce membre est le seul administrateur actif de la clinique.' }
    }
  }

  const { error } = await adminClient.from('staff').update({ is_active: makeActive }).eq('id', staffId)
  if (error) return friendlyError('toggleStaffActive', 'Impossible de mettre à jour ce compte.', error)

  // Deactivating isn't just "hide them from the roster" — a real
  // deactivation has to actually end their access, not leave an
  // existing browser session working for up to another hour until its
  // JWT naturally expires. Best-effort: if this fails, the account is
  // still correctly deactivated (is_active is already false above,
  // which every RLS policy already checks), just not immediately
  // logged out — logged rather than surfaced as a user-facing error,
  // since the deactivation itself genuinely succeeded.
  if (!makeActive && target.auth_user_id) {
    const { error: revokeError } = await adminClient.rpc('revoke_staff_sessions', { p_auth_user_id: target.auth_user_id })
    if (revokeError) {
      console.error('revoke_staff_sessions failed (staff is still deactivated correctly):', revokeError)
    }
  }

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId,
    action: makeActive ? 'staff.reactivated' : 'staff.deactivated',
    entity_type: 'staff', entity_id: staffId,
    details: { role: target.role },
  })

  revalidatePath('/admin')
  return { success: true }
}
