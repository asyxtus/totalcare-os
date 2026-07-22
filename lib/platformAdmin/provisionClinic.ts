// lib/platformAdmin/provisionClinic.ts
//
// The actual provisioning steps (call provision_clinic(), invite the
// first admin, roll back the invite if the staff insert fails) —
// extracted so app/api/admin/provision-clinic/route.ts (for curl/CI
// use) and the /platform-admin dashboard form both call the exact same
// logic instead of two copies that quietly drift apart over time.

import { createAdminClient } from '@/lib/supabase/admin'

export interface ProvisionClinicInput {
  clinicName: string
  templateClinicId?: string | null
  adminFullName: string
  adminEmail: string
}

export interface ProvisionClinicResult {
  success: boolean
  clinicId?: string
  adminEmail?: string
  error?: string
  detail?: string
}

export async function provisionClinicCore(input: ProvisionClinicInput): Promise<ProvisionClinicResult> {
  const { clinicName, templateClinicId, adminFullName, adminEmail } = input

  if (!clinicName.trim()) return { success: false, error: 'clinic_name is required' }
  if (!adminFullName.trim()) return { success: false, error: 'admin_full_name is required' }
  if (!adminEmail.trim().includes('@')) return { success: false, error: 'A valid admin_email is required' }

  const adminClient = createAdminClient()

  // Step 1: the clinic itself, optionally cloned from a template.
  // Idempotent on clinic_name (see 99_tenant_onboarding.sql) — safe to
  // call this again with the same name if step 2 fails below.
  const { data: clinicId, error: provisionError } = await adminClient.rpc('provision_clinic', {
    p_clinic_name: clinicName.trim(),
    p_template_clinic_id: templateClinicId || null,
  })

  if (provisionError || !clinicId) {
    console.error('provision_clinic failed:', provisionError)
    return { success: false, error: 'Failed to create the clinic or clone its catalog.', detail: provisionError?.message }
  }

  // Step 2: invite the first admin — same shape as inviteStaffAction.
  const email = adminEmail.trim().toLowerCase()
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: adminFullName.trim() },
  })

  if (inviteError || !invited?.user) {
    return {
      success: false, clinicId,
      error: 'Clinic created, but inviting the first admin failed. Retry with the same clinic name to attempt just this step again.',
      detail: inviteError?.message,
    }
  }

  const { error: staffInsertError } = await adminClient.from('staff').insert({
    auth_user_id: invited.user.id,
    clinic_id: clinicId,
    full_name: adminFullName.trim(),
    role: 'admin',
    preferred_language: 'fr',
    is_active: true,
  })

  if (staffInsertError) {
    await adminClient.auth.admin.deleteUser(invited.user.id)
    return {
      success: false, clinicId,
      error: 'Clinic created, but creating the admin staff record failed — the invite was rolled back. Retry with the same clinic name.',
      detail: staffInsertError.message,
    }
  }

  return { success: true, clinicId, adminEmail: email }
}
