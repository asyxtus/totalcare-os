// lib/actions/platformAdmin.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionClinicCore } from '@/lib/platformAdmin/provisionClinic'
import { isPlatformAdminUnlocked, setPlatformAdminSession, clearPlatformAdminSession } from '@/lib/platformAdmin/session'

export async function unlockPlatformAdminAction(formData: FormData) {
  const secret = (formData.get('secret') as string)?.trim()
  const expected = process.env.PLATFORM_ADMIN_SECRET

  if (!expected) return { error: "PLATFORM_ADMIN_SECRET n'est pas configuré côté serveur." }
  if (!secret || secret !== expected) return { error: 'Code incorrect.' }

  await setPlatformAdminSession(secret)
  revalidatePath('/platform-admin')
  return { success: true }
}

export async function lockPlatformAdminAction() {
  await clearPlatformAdminSession()
  revalidatePath('/platform-admin')
}

export async function provisionClinicAction(formData: FormData) {
  if (!(await isPlatformAdminUnlocked())) {
    return { error: 'Session expirée — déverrouillez à nouveau.' }
  }

  const result = await provisionClinicCore({
    clinicName: (formData.get('clinic_name') as string) ?? '',
    templateClinicId: (formData.get('template_clinic_id') as string) || null,
    adminFullName: (formData.get('admin_full_name') as string) ?? '',
    adminEmail: (formData.get('admin_email') as string) ?? '',
  })

  if (!result.success) {
    return { error: result.error, detail: result.detail, clinicId: result.clinicId }
  }

  revalidatePath('/platform-admin')
  return { success: true, clinicId: result.clinicId, adminEmail: result.adminEmail }
}

export interface ClinicListItem { id: string; name: string; created_at: string | null }

export async function listClinicsForPlatformAdminAction(): Promise<ClinicListItem[]> {
  if (!(await isPlatformAdminUnlocked())) return []

  const adminClient = createAdminClient()
  // created_at is selected defensively — it's on every other table in
  // this schema, but `clinics` itself predates everything visible in
  // this codebase, same blind spot that caused the service_code
  // surprise. If it's missing, degrade to name-only rather than break
  // the whole dashboard over a column used for sorting, not function.
  const { data, error } = await adminClient.from('clinics').select('id, name, created_at').order('created_at', { ascending: false })
  if (error) {
    console.warn('listClinicsForPlatformAdmin: created_at fetch failed, retrying without it:', error.message)
    const fallback = await adminClient.from('clinics').select('id, name')
    return (fallback.data ?? []).map((c) => ({ ...c, created_at: null }))
  }
  return data ?? []
}
