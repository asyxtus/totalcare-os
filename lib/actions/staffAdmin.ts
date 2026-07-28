// lib/actions/staffAdmin.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { getSiteUrl } from '@/lib/siteUrl'
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
    redirectTo: `${getSiteUrl()}/accept-invite`,
  })

  if (inviteError || !invited?.user) {
    // "Already registered" doesn't necessarily mean they're stuck — a
    // previously-deactivated staff member's Supabase Auth account still
    // exists (deactivating them only ever flipped is_active on our own
    // table, never touched their auth account). Resolve the existing
    // auth user by email, and if our staff table has a row for them —
    // active or not — handle it instead of dead-ending on a generic error.
    if (inviteError?.message?.includes('already been registered')) {
      // staff has no email column of its own (email lives on Supabase's
      // own auth.users); listUsers() is paginated and doesn't take an
      // email filter in all client versions, so we page through and
      // match manually — fine at clinic-staff scale.
      let existingAuthUserId: string | null = null
      for (let page = 1; page <= 20 && !existingAuthUserId; page++) {
        const { data: pageData } = await adminClient.auth.admin.listUsers({ page, perPage: 200 })
        const match = pageData?.users?.find((u) => u.email?.toLowerCase() === email)
        if (match) existingAuthUserId = match.id
        if (!pageData?.users || pageData.users.length < 200) break
      }

      if (existingAuthUserId) {
        const { data: existingStaff } = await adminClient
          .from('staff')
          .select('id, is_active, full_name')
          .eq('clinic_id', admin.clinicId)
          .eq('auth_user_id', existingAuthUserId)
          .maybeSingle()

        if (existingStaff?.is_active) {
          return { error: `${existingStaff.full_name} a déjà un compte actif dans cette clinique.` }
        }
        if (existingStaff && !existingStaff.is_active) {
          const { error: reactivateError } = await adminClient
            .from('staff')
            .update({ is_active: true, full_name: fullName, role, preferred_language: preferredLanguage })
            .eq('id', existingStaff.id)
          if (reactivateError) return friendlyError('staff reactivate', 'Impossible de réactiver ce compte.', reactivateError)

          await adminClient.from('audit_log').insert({
            clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'staff.reactivated',
            entity_type: 'staff', entity_id: existingStaff.id,
            details: { full_name: fullName, email, role },
          })

          revalidatePath('/admin')
          return { success: true, reactivated: true }
        }

        // Auth account exists but no staff row at all for this clinic —
        // create one for the existing account rather than trying (and
        // failing) to invite an email that's already registered.
        const { data: newStaffRow, error: staffInsertError } = await adminClient.from('staff').insert({
          auth_user_id: existingAuthUserId, clinic_id: admin.clinicId,
          full_name: fullName, role, preferred_language: preferredLanguage, is_active: true,
        }).select('id').maybeSingle()

        if (staffInsertError) return friendlyError('staff insert (existing auth user)', 'Impossible de créer la fiche personnel.', staffInsertError)

        await adminClient.from('audit_log').insert({
          clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'staff.invited',
          entity_type: 'staff', entity_id: newStaffRow?.id ?? null,
          details: { full_name: fullName, email, role, note: 'linked to pre-existing auth account' },
        })

        revalidatePath('/admin')
        return { success: true }
      }
    }

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

// ─── Multi-role support ─────────────────────────────────────────────────

// Lets the signed-in person switch which of their available roles is
// currently active — e.g. a nurse who also covers reception can flip
// between the two. Only allowed into a role they actually hold (their
// primary role or an explicitly granted secondary one); never trust the
// client to only ever offer valid options.
export async function switchActiveRoleAction(newRole: StaffRole) {
  const staff = await getCurrentStaff()

  if (!staff.availableRoles.includes(newRole)) {
    return { error: "Vous n'avez pas ce rôle. / You don't hold that role." }
  }

  const supabase = await createClient()
  // Goes through a validated SECURITY DEFINER function rather than a raw
  // table update — staff's own UPDATE policy only allows admins to touch
  // role-related columns, which silently blocked non-admin staff from
  // switching their own active role (RLS quietly updated zero rows,
  // no error, which is why this looked like "nothing happens"). The
  // function re-checks the target role server-side — never trust the
  // client-side check above alone — and touches only active_role.
  const { error } = await supabase.rpc('switch_active_role', { p_new_role: newRole })

  if (error) return friendlyError('switchActiveRole', 'Impossible de changer de rôle.', error)

  revalidatePath('/', 'layout')
  return { success: true }
}

// Admin-only: grant or revoke a secondary role for someone else on staff.
// The person's primary role (staff.role) is untouched either way — this
// only affects what else they're additionally allowed to switch into.
export async function setStaffSecondaryRoleAction(staffId: string, role: StaffRole, grant: boolean) {
  const admin = await getCurrentStaff()
  if (admin.role !== 'admin') return { error: 'Réservé aux administrateurs. / Admins only.' }

  const supabase = await createClient()

  const { data: target } = await supabase.from('staff').select('role, full_name').eq('id', staffId).eq('clinic_id', admin.clinicId).maybeSingle()
  if (!target) return { error: 'Personnel introuvable dans cette clinique.' }
  if (target.role === role) return { error: "C'est déjà son rôle principal. / That's already their primary role." }

  if (grant) {
    const { error } = await supabase.from('staff_secondary_roles').insert({ staff_id: staffId, role, granted_by: admin.staffId })
    // A duplicate (already granted) isn't really an error from the
    // person clicking the button's point of view — treat it as a no-op
    // success rather than surfacing a unique-constraint message.
    if (error && !error.message.includes('duplicate')) {
      return friendlyError('grant secondary role', 'Impossible d\'ajouter ce rôle.', error)
    }
  } else {
    const { error } = await supabase.from('staff_secondary_roles').delete().eq('staff_id', staffId).eq('role', role)
    if (error) return friendlyError('revoke secondary role', 'Impossible de retirer ce rôle.', error)
    // If they were actively working AS the role just revoked, drop them
    // back to their primary role immediately rather than leaving them
    // switched into a role they no longer hold.
    await supabase.from('staff').update({ active_role: null }).eq('id', staffId).eq('active_role', role)
  }

  await supabase.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId,
    action: grant ? 'staff.secondary_role_granted' : 'staff.secondary_role_revoked',
    entity_type: 'staff', entity_id: staffId,
    details: { target_name: target.full_name, role },
  })

  revalidatePath('/admin')
  return { success: true }
}
