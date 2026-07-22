// lib/actions/admissions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

export async function dischargePatientAction(admissionId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const summary = (formData.get('discharge_summary') as string)?.trim()
  if (!summary) return { error: 'Un résumé de sortie est requis.' }

  const { error } = await supabase.rpc('discharge_patient', {
    p_clinic_id: staff.clinicId,
    p_admission_id: admissionId,
    p_discharged_by: staff.staffId,
    p_discharge_summary: summary,
    p_discharge_type: (formData.get('discharge_type') as string) || 'routine',
    p_outcome: (formData.get('outcome') as string)?.trim() || null,
  })

  if (error) return friendlyError('discharge_patient', 'Impossible de sortir ce patient.', error)

  revalidatePath('/admissions')
  return { success: true }
}

export async function assignBedAction(admissionId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const wardId = formData.get('ward_id') as string
  const bedId = formData.get('bed_id') as string

  if (!wardId || !bedId) return { error: 'Sélectionnez un service et un lit.' }

  const { error } = await supabase.rpc('assign_bed', {
    p_clinic_id: staff.clinicId,
    p_admission_id: admissionId,
    p_ward_id: wardId,
    p_bed_id: bedId,
    p_assigned_by: staff.staffId,
  })

  if (error) return friendlyError('assign_bed', 'Impossible d\'assigner ce lit.', error)

  revalidatePath('/admissions')
  return { success: true }
}

export async function createDirectAdmission(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const patientId = formData.get('patient_id') as string
  const reason = (formData.get('admission_reason') as string)?.trim()
  if (!patientId) return { error: 'Sélectionnez un patient.' }
  if (!reason) return { error: 'Un motif est requis.' }

  const { error } = await supabase.rpc('create_direct_admission', {
    p_clinic_id: staff.clinicId,
    p_patient_id: patientId,
    p_admission_reason: reason,
    p_created_by: staff.staffId,
    p_source: 'reception',
  })

  if (error) return friendlyError('create_direct_admission', 'Impossible de créer cette admission.', error)

  revalidatePath('/admissions')
  return { success: true }
}

export async function transferPatientAction(admissionId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const toWardId = formData.get('to_ward_id') as string
  const toBedId = formData.get('to_bed_id') as string
  const reason = (formData.get('reason') as string)?.trim()

  if (!toWardId || !toBedId) return { error: 'Sélectionnez un service et un lit de destination.' }
  if (!reason) return { error: 'Un motif est requis.' }

  const { error } = await supabase.rpc('transfer_patient', {
    p_clinic_id: staff.clinicId,
    p_admission_id: admissionId,
    p_to_ward_id: toWardId,
    p_to_bed_id: toBedId,
    p_transferred_by: staff.staffId,
    p_reason: reason,
  })

  if (error) return friendlyError('transfer_patient', 'Impossible de transférer ce patient.', error)

  revalidatePath('/admissions')
  return { success: true }
}

export async function recordInpatientNoteAction(admissionId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const note = (formData.get('note') as string)?.trim()
  if (!note) return { error: 'La note ne peut pas être vide.' }

  const { error } = await supabase.rpc('record_inpatient_note', {
    p_clinic_id: staff.clinicId,
    p_admission_id: admissionId,
    p_recorded_by: staff.staffId,
    p_note: note,
  })

  if (error) return friendlyError('record_inpatient_note', 'Impossible d\'enregistrer cette note.', error)

  revalidatePath(`/admissions/${admissionId}/care`)
  return { success: true }
}

export async function createWard(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Le nom du service est requis.' }

  const capacity = formData.get('capacity') as string
  const dailyRate = formData.get('daily_rate_xaf') as string

  const { error } = await supabase.from('wards').insert({
    clinic_id: staff.clinicId,
    name,
    code: (formData.get('code') as string)?.trim() || null,
    ward_type: (formData.get('ward_type') as string)?.trim() || null,
    capacity: capacity ? parseInt(capacity, 10) : null,
    daily_rate_xaf: dailyRate ? parseFloat(dailyRate) : null,
  })

  if (error) return friendlyError('createWard', 'Impossible de créer ce service.', error)

  revalidatePath('/admissions')
  return { success: true }
}

export async function createBed(wardId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const bedNumber = (formData.get('bed_number') as string)?.trim()
  if (!bedNumber) return { error: 'Le numéro du lit est requis.' }

  const { error } = await supabase.from('beds').insert({
    clinic_id: staff.clinicId,
    ward_id: wardId,
    bed_number: bedNumber,
    bed_type: (formData.get('bed_type') as string)?.trim() || null,
  })

  if (error) return friendlyError('createBed', 'Impossible de créer ce lit — vérifiez que ce numéro n\'existe pas déjà dans ce service.', error)

  revalidatePath('/admissions')
  return { success: true }
}

export async function toggleBedStatus(bedId: string, newStatus: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('beds').update({ status: newStatus }).eq('id', bedId)

  if (error) return friendlyError('toggleBedStatus', 'Impossible de modifier ce lit.', error)

  revalidatePath('/admissions')
  revalidatePath('/admissions')
  return { success: true }
}
