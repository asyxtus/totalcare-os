// lib/actions/platformAdmin.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionClinicCore } from '@/lib/platformAdmin/provisionClinic'
import { getCurrentPlatformAdmin, canBootstrapFirstAdmin } from '@/lib/platformAdmin/session'
import { getSiteUrl } from '@/lib/siteUrl'

// Best-effort audit trail — logs the action but never blocks or fails the
// primary operation if the log write itself has a problem. A missing log
// entry is a minor gap; a provisioning/suspension that silently fails
// because logging broke would be a much worse one. Attributes to whoever
// is currently signed in, when available.
async function logPlatformAdminAction(
  action: string,
  clinicId: string | null,
  clinicName: string | null,
  detail?: Record<string, unknown>
) {
  try {
    const admin = await getCurrentPlatformAdmin()
    const adminClient = createAdminClient()
    await adminClient.from('platform_admin_audit_log').insert({
      action, clinic_id: clinicId, clinic_name: clinicName, detail: detail ?? null,
      admin_id: admin?.id ?? null, admin_name: admin?.fullName ?? null, admin_email: admin?.email ?? null,
    })
  } catch (err) {
    console.error('platform admin audit log write failed:', err)
  }
}

// ─── Sign-in / sign-out (day-to-day access) ─────────────────────────────────

export async function platformAdminSignInAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = (formData.get('password') as string) ?? ''
  if (!email || !password) return { error: 'Email et mot de passe requis. / Email and password required.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: 'Identifiants incorrects. / Incorrect credentials.' }
  }

  // Signed into Supabase successfully, but that alone isn't enough — must
  // also be an active platform admin. Sign back out immediately if not,
  // rather than leaving a valid-but-unauthorized session sitting around.
  const admin = await getCurrentPlatformAdmin()
  if (!admin) {
    await supabase.auth.signOut()
    return { error: "Ce compte n'a pas accès à l'administration plateforme. / This account does not have platform admin access." }
  }

  revalidatePath('/platform-admin')
  return { success: true }
}

export async function platformAdminSignOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/platform-admin')
}

// ─── Bootstrap (only usable when zero admin accounts exist) ────────────────

export async function bootstrapFirstAdminAction(formData: FormData) {
  const secret = (formData.get('secret') as string)?.trim()
  const fullName = (formData.get('full_name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = (formData.get('password') as string) ?? ''

  if (!fullName || !email || password.length < 8) {
    return { error: 'Nom, email, et un mot de passe (8+ caractères) sont requis. / Name, email, and an 8+ character password are required.' }
  }
  if (!secret || !(await canBootstrapFirstAdmin(secret))) {
    return { error: 'Code invalide, ou un administrateur existe déjà. / Invalid code, or an admin already exists.' }
  }

  const adminClient = createAdminClient()

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (createError || !created.user) {
    return { error: `Création du compte impossible. (${createError?.message})` }
  }

  const { error: insertError } = await adminClient.from('platform_admins').insert({
    auth_user_id: created.user.id, full_name: fullName, email, is_active: true,
  })
  if (insertError) {
    await adminClient.auth.admin.deleteUser(created.user.id)
    return { error: `Création impossible. (${insertError.message})` }
  }

  await logPlatformAdminAction('bootstrap_first_admin', null, null, { fullName, email })

  // Sign the newly-created admin straight in so they land in the console
  // without a second manual login step.
  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email, password })

  revalidatePath('/platform-admin')
  return { success: true }
}

// ─── Manage other admins ─────────────────────────────────────────────────

export interface PlatformAdminListItem {
  id: string
  fullName: string
  email: string
  isActive: boolean
  createdAt: string | null
  invitedByName: string | null
}

export async function listPlatformAdminsAction(): Promise<PlatformAdminListItem[] | { error: string }> {
  const admin = await getCurrentPlatformAdmin()
  if (!admin) return { error: 'Session expirée — reconnectez-vous. / Session expired — sign in again.' }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('platform_admins')
    .select('id, full_name, email, is_active, created_at, invited_by, inviter:platform_admins!invited_by(full_name)')
    .order('created_at', { ascending: true })

  if (error) return { error: `Impossible de charger la liste. (${error.message})` }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    isActive: row.is_active,
    createdAt: row.created_at,
    invitedByName: row.inviter?.full_name ?? null,
  }))
}

// Any active admin can invite another — no special "super" tier. Uses the
// same invite-by-email pattern as onboarding a clinic's first admin.
export async function invitePlatformAdminAction(formData: FormData) {
  const currentAdmin = await getCurrentPlatformAdmin()
  if (!currentAdmin) return { error: 'Session expirée — reconnectez-vous. / Session expired — sign in again.' }

  const fullName = (formData.get('full_name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!fullName || !email.includes('@')) {
    return { error: 'Nom et email valide requis. / Valid name and email required.' }
  }

  const adminClient = createAdminClient()

  // A deactivated admin's Supabase Auth account still exists — deactivating
  // them only ever flipped is_active on this table, never touched their
  // auth account. Re-inviting the same email would otherwise fail with
  // "already registered" and no way forward. platform_admins has its own
  // email column, so check here first rather than hitting that dead end.
  const { data: existing } = await adminClient
    .from('platform_admins')
    .select('id, is_active, full_name')
    .eq('email', email)
    .maybeSingle()

  if (existing?.is_active) {
    return { error: `${existing.full_name} a déjà un compte administrateur actif. / ${existing.full_name} already has an active admin account.` }
  }
  if (existing && !existing.is_active) {
    const { error: reactivateError } = await adminClient
      .from('platform_admins')
      .update({ is_active: true, full_name: fullName })
      .eq('id', existing.id)
    if (reactivateError) return { error: `Réactivation impossible. (${reactivateError.message})` }

    await logPlatformAdminAction('reactivate_admin', null, null, { targetName: fullName, viaReinvite: true })

    revalidatePath('/platform-admin')
    return { success: true, reactivated: true }
  }

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${getSiteUrl()}/accept-invite`,
  })
  if (inviteError || !invited?.user) {
    return { error: `Invitation impossible. (${inviteError?.message})` }
  }

  const { error: insertError } = await adminClient.from('platform_admins').insert({
    auth_user_id: invited.user.id, full_name: fullName, email, is_active: true, invited_by: currentAdmin.id,
  })
  if (insertError) {
    await adminClient.auth.admin.deleteUser(invited.user.id)
    return { error: `Invitation impossible. (${insertError.message})` }
  }

  await logPlatformAdminAction('invite_admin', null, null, { fullName, email })

  revalidatePath('/platform-admin')
  return { success: true }
}

// Deactivating yourself is blocked — with only one admin left, that would
// lock everyone out with no way back in except the emergency bootstrap
// path re-running (which requires the secret and an empty table, neither
// of which apply here). Multiple admins can still deactivate each other.
export async function setPlatformAdminActiveAction(adminId: string, active: boolean) {
  const currentAdmin = await getCurrentPlatformAdmin()
  if (!currentAdmin) return { error: 'Session expirée — reconnectez-vous. / Session expired — sign in again.' }
  if (adminId === currentAdmin.id && !active) {
    return { error: 'Vous ne pouvez pas désactiver votre propre compte. / You cannot deactivate your own account.' }
  }

  const adminClient = createAdminClient()
  const { data: target } = await adminClient.from('platform_admins').select('full_name').eq('id', adminId).maybeSingle()

  const { error } = await adminClient.from('platform_admins').update({ is_active: active }).eq('id', adminId)
  if (error) return { error: `Impossible de mettre à jour. (${error.message})` }

  await logPlatformAdminAction(active ? 'reactivate_admin' : 'deactivate_admin', null, null, { targetName: target?.full_name })

  revalidatePath('/platform-admin')
  return { success: true }
}

// ─── Clinic provisioning ────────────────────────────────────────────────────

export async function provisionClinicAction(formData: FormData) {
  const admin = await getCurrentPlatformAdmin()
  if (!admin) return { error: 'Session expirée — reconnectez-vous. / Session expired — sign in again.' }

  const result = await provisionClinicCore({
    clinicName: (formData.get('clinic_name') as string) ?? '',
    templateClinicId: (formData.get('template_clinic_id') as string) || null,
    adminFullName: (formData.get('admin_full_name') as string) ?? '',
    adminEmail: (formData.get('admin_email') as string) ?? '',
  })

  if (!result.success) {
    return { error: result.error, detail: result.detail, clinicId: result.clinicId }
  }

  await logPlatformAdminAction('provision_clinic', result.clinicId ?? null, (formData.get('clinic_name') as string) ?? null, {
    adminEmail: result.adminEmail,
    clonedFrom: (formData.get('template_clinic_id') as string) || null,
  })

  revalidatePath('/platform-admin')
  return { success: true, clinicId: result.clinicId, adminEmail: result.adminEmail }
}

export interface ClinicListItem { id: string; name: string; created_at: string | null }

export async function listClinicsForPlatformAdminAction(): Promise<ClinicListItem[]> {
  if (!(await getCurrentPlatformAdmin())) return []

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.from('clinics').select('id, name, created_at').order('created_at', { ascending: false })
  if (error) {
    console.warn('listClinicsForPlatformAdmin: created_at fetch failed, retrying without it:', error.message)
    const fallback = await adminClient.from('clinics').select('id, name')
    return (fallback.data ?? []).map((c) => ({ ...c, created_at: null }))
  }
  return data ?? []
}

export interface AuditLogEntry {
  id: string
  action: string
  clinicId: string | null
  clinicName: string | null
  detail: Record<string, unknown> | null
  createdAt: string
  adminName: string | null
}

export async function getPlatformAuditLogAction(): Promise<AuditLogEntry[] | { error: string }> {
  if (!(await getCurrentPlatformAdmin())) return { error: 'Session expirée — reconnectez-vous. / Session expired — sign in again.' }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('platform_admin_audit_log')
    .select('id, action, clinic_id, clinic_name, detail, created_at, admin_name')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return { error: `Impossible de charger le journal. (${error.message})` }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    action: row.action,
    clinicId: row.clinic_id,
    clinicName: row.clinic_name,
    detail: row.detail,
    createdAt: row.created_at,
    adminName: row.admin_name,
  }))
}

export interface ClinicSummary {
  clinicId: string
  clinicName: string
  isActive: boolean
  createdAt: string | null
  patientCount: number
  staffCount: number
  revenue30dXaf: number
}

export interface PlatformOverview {
  totalClinics: number
  activeClinics: number
  suspendedClinics: number
  totalPatients: number
  totalStaff: number
  totalRevenue30dXaf: number
}

// Single round trip for every clinic's headline numbers — the platform
// admin console's "Clinics" tab and its "Overview" tab both derive from
// this same call, so the two never show inconsistent totals.
export async function getClinicSummariesAction(): Promise<{ clinics: ClinicSummary[]; overview: PlatformOverview } | { error: string }> {
  if (!(await getCurrentPlatformAdmin())) return { error: 'Session expirée — reconnectez-vous. / Session expired — sign in again.' }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.rpc('platform_clinic_summary')

  if (error) {
    console.error('platform_clinic_summary failed:', error)
    return { error: `Impossible de charger les statistiques. (${error.message})` }
  }

  const clinics: ClinicSummary[] = (data ?? []).map((row: any) => ({
    clinicId: row.clinic_id,
    clinicName: row.clinic_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    patientCount: Number(row.patient_count ?? 0),
    staffCount: Number(row.staff_count ?? 0),
    revenue30dXaf: Number(row.revenue_30d_xaf ?? 0),
  }))

  const overview: PlatformOverview = {
    totalClinics: clinics.length,
    activeClinics: clinics.filter((c) => c.isActive).length,
    suspendedClinics: clinics.filter((c) => !c.isActive).length,
    totalPatients: clinics.reduce((sum, c) => sum + c.patientCount, 0),
    totalStaff: clinics.reduce((sum, c) => sum + c.staffCount, 0),
    totalRevenue30dXaf: clinics.reduce((sum, c) => sum + c.revenue30dXaf, 0),
  }

  return { clinics, overview }
}

export async function renameClinicAction(clinicId: string, newName: string) {
  if (!(await getCurrentPlatformAdmin())) return { error: 'Session expirée — reconnectez-vous. / Session expired — sign in again.' }
  const trimmed = newName.trim()
  if (!trimmed) return { error: 'Le nom ne peut pas être vide.' }

  const adminClient = createAdminClient()
  const { data: before } = await adminClient.from('clinics').select('name').eq('id', clinicId).maybeSingle()

  const { error } = await adminClient.from('clinics').update({ name: trimmed }).eq('id', clinicId)
  if (error) return { error: `Renommage impossible. (${error.message})` }

  await logPlatformAdminAction('rename_clinic', clinicId, trimmed, { from: before?.name ?? null, to: trimmed })

  revalidatePath('/platform-admin')
  return { success: true }
}

// Suspending a clinic sets clinics.is_active = false. Enforcement lives in
// getCurrentStaff() — every page in the app calls it, and it now checks
// the clinic's own active status alongside the staff member's, so a
// suspended clinic's staff are signed out on their very next request
// without needing to touch every individual page.
export async function setClinicActiveAction(clinicId: string, active: boolean) {
  if (!(await getCurrentPlatformAdmin())) return { error: 'Session expirée — reconnectez-vous. / Session expired — sign in again.' }

  const adminClient = createAdminClient()
  const { data: clinic } = await adminClient.from('clinics').select('name').eq('id', clinicId).maybeSingle()

  const { error } = await adminClient.from('clinics').update({ is_active: active }).eq('id', clinicId)
  if (error) return { error: `Impossible de mettre à jour le statut. (${error.message})` }

  await logPlatformAdminAction(active ? 'reactivate_clinic' : 'suspend_clinic', clinicId, clinic?.name ?? null)

  revalidatePath('/platform-admin')
  return { success: true }
}
