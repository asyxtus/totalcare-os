'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

async function requireAdmin() {
  const staff = await getCurrentStaff()
  if (staff.role !== 'admin') throw new Error('Admin access required.')
  return staff
}

const num = (value: FormDataEntryValue | null) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function createConsultationFollowupPolicy(formData: FormData) {
  try {
    const admin = await requireAdmin()
    const name = String(formData.get('name') ?? '').trim()
    const minDays = num(formData.get('min_days_after_consultation'))
    const maxDays = num(formData.get('max_days_after_consultation'))
    const patientFee = num(formData.get('patient_fee_xaf'))

    if (!name) return { error: 'Le nom de la règle est requis.' }
    if (minDays === null || maxDays === null || minDays < 0 || maxDays < minDays) return { error: 'La fenêtre de validité est invalide.' }
    if (patientFee === null || patientFee < 0) return { error: 'Le montant patient est invalide.' }

    const db = createAdminClient()
    const { data, error } = await db.from('consultation_followup_policies').insert({
      clinic_id: admin.clinicId,
      name,
      min_days_after_consultation: Math.floor(minDays),
      max_days_after_consultation: Math.floor(maxDays),
      patient_fee_xaf: patientFee,
      is_active: true,
      created_by: admin.staffId,
    }).select('id').single()

    if (error) return { error: error.code === '23505' ? 'Une règle portant ce nom existe déjà.' : error.message }

    await db.from('audit_log').insert({
      clinic_id: admin.clinicId,
      staff_id: admin.staffId,
      action: 'pricing.consultation_followup_policy_created',
      entity_type: 'consultation_followup_policy',
      entity_id: data.id,
      details: { name, min_days: minDays, max_days: maxDays, patient_fee_xaf: patientFee },
    })

    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message ?? 'Accès administrateur requis.' }
  }
}

export async function updateConsultationFollowupPolicy(id: string, formData: FormData) {
  try {
    const admin = await requireAdmin()
    const minDays = num(formData.get('min_days_after_consultation'))
    const maxDays = num(formData.get('max_days_after_consultation'))
    const patientFee = num(formData.get('patient_fee_xaf'))

    if (minDays === null || maxDays === null || minDays < 0 || maxDays < minDays) return { error: 'La fenêtre de validité est invalide.' }
    if (patientFee === null || patientFee < 0) return { error: 'Le montant patient est invalide.' }

    const db = createAdminClient()
    const { data: existing } = await db.from('consultation_followup_policies')
      .select('name, min_days_after_consultation, max_days_after_consultation, patient_fee_xaf')
      .eq('id', id).eq('clinic_id', admin.clinicId).maybeSingle()
    if (!existing) return { error: 'Règle introuvable.' }

    const { error } = await db.from('consultation_followup_policies').update({
      min_days_after_consultation: Math.floor(minDays),
      max_days_after_consultation: Math.floor(maxDays),
      patient_fee_xaf: patientFee,
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('clinic_id', admin.clinicId)
    if (error) return { error: error.message }

    await db.from('audit_log').insert({
      clinic_id: admin.clinicId,
      staff_id: admin.staffId,
      action: 'pricing.consultation_followup_policy_updated',
      entity_type: 'consultation_followup_policy',
      entity_id: id,
      details: { before: existing, after: { min_days: minDays, max_days: maxDays, patient_fee_xaf: patientFee } },
    })

    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message ?? 'Accès administrateur requis.' }
  }
}

export async function toggleConsultationFollowupPolicy(id: string, active: boolean) {
  try {
    const admin = await requireAdmin()
    const db = createAdminClient()
    const { error } = await db.from('consultation_followup_policies')
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq('id', id).eq('clinic_id', admin.clinicId)
    if (error) return { error: error.message }

    await db.from('audit_log').insert({
      clinic_id: admin.clinicId,
      staff_id: admin.staffId,
      action: active ? 'pricing.consultation_followup_policy_activated' : 'pricing.consultation_followup_policy_deactivated',
      entity_type: 'consultation_followup_policy',
      entity_id: id,
      details: {},
    })

    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message ?? 'Accès administrateur requis.' }
  }
}
