// lib/actions/inpatientCare.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

export async function recordRoundNoteAction(admissionId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const note = (formData.get('note') as string)?.trim()
  const roundType = (formData.get('round_type') as string) || 'doctor_round'
  if (!note) return { error: 'La note ne peut pas être vide.' }

  const { error } = await supabase.rpc('record_inpatient_note', {
    p_clinic_id: staff.clinicId,
    p_admission_id: admissionId,
    p_recorded_by: staff.staffId,
    p_note: note,
    p_round_type: roundType,
  })

  if (error) return friendlyError('record_inpatient_note', 'Impossible d\'enregistrer cette note.', error)

  revalidatePath(`/admissions/${admissionId}/care`)
  return { success: true }
}

export async function createInpatientPrescriptionAction(admissionId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const productId = formData.get('product_id') as string
  const freetextName = (formData.get('freetext_name') as string)?.trim()
  const dose = (formData.get('dose') as string)?.trim()
  const route = (formData.get('route') as string)?.trim()
  const frequency = (formData.get('frequency') as string)?.trim()
  const durationDays = formData.get('duration_days') as string
  const quantity = formData.get('quantity') as string
  const instructions = (formData.get('instructions') as string)?.trim()

  if (!productId && !freetextName) return { error: 'Sélectionnez un médicament ou saisissez un nom.' }
  if (!quantity || parseInt(quantity, 10) <= 0) return { error: 'La quantité est requise.' }

  const items = [{
    product_id: productId || '',
    freetext_name: freetextName || '',
    dose, route, frequency,
    duration_days: durationDays || '',
    instructions,
    quantity: parseInt(quantity, 10),
  }]

  const { error } = await supabase.rpc('create_inpatient_prescription', {
    p_clinic_id: staff.clinicId,
    p_admission_id: admissionId,
    p_prescribed_by: staff.staffId,
    p_items: items,
  })

  if (error) return friendlyError('create_inpatient_prescription', 'Impossible d\'envoyer cette prescription à la pharmacie.', error)

  revalidatePath(`/admissions/${admissionId}/care`)
  revalidatePath('/pharmacy/dispensing')
  return { success: true }
}

export async function orderInpatientLabAction(admissionId: string, visitId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const itemType = formData.get('item_type') as string
  const catalogId = formData.get('catalog_id') as string
  const externalName = (formData.get('external_name') as string)?.trim()

  if (itemType !== 'external' && !catalogId) return { error: 'Sélectionnez un test.' }
  if (itemType === 'external' && !externalName) return { error: 'Indiquez le nom du test externe.' }

  const items = itemType === 'panel'
    ? [{ type: 'panel', panel_id: catalogId }]
    : itemType === 'individual_test'
    ? [{ type: 'individual_test', catalog_id: catalogId }]
    : [{ type: 'external', name: externalName }]

  const { error } = await supabase.rpc('create_lab_order', {
    p_clinic_id: staff.clinicId,
    p_visit_id: visitId,
    p_ordered_by: staff.staffId,
    p_items: items,
  })

  if (error) return friendlyError('create_lab_order', 'Impossible de commander cet examen.', error)

  revalidatePath(`/admissions/${admissionId}/care`)
  revalidatePath('/laboratory')
  return { success: true }
}

export async function recordVitalSignsAction(admissionId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const toIntOrNull = (v: FormDataEntryValue | null) => v && v !== '' ? parseInt(v as string, 10) : null
  const toFloatOrNull = (v: FormDataEntryValue | null) => v && v !== '' ? parseFloat(v as string) : null

  const { error } = await supabase.rpc('record_vital_signs', {
    p_clinic_id: staff.clinicId,
    p_admission_id: admissionId,
    p_recorded_by: staff.staffId,
    p_bp_systolic: toIntOrNull(formData.get('bp_systolic')),
    p_bp_diastolic: toIntOrNull(formData.get('bp_diastolic')),
    p_heart_rate: toIntOrNull(formData.get('heart_rate')),
    p_temperature_celsius: toFloatOrNull(formData.get('temperature_celsius')),
    p_respiratory_rate: toIntOrNull(formData.get('respiratory_rate')),
    p_oxygen_saturation: toIntOrNull(formData.get('oxygen_saturation')),
    p_notes: (formData.get('notes') as string)?.trim() || null,
  })

  if (error) return friendlyError('record_vital_signs', 'Impossible d\'enregistrer ces signes vitaux.', error)

  revalidatePath(`/admissions/${admissionId}/care`)
  return { success: true }
}

export async function recordMedicationAdministrationAction(admissionId: string, prescriptionItemId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const status = formData.get('status') as string
  const notes = (formData.get('notes') as string)?.trim()

  const { error } = await supabase.rpc('record_medication_administration', {
    p_clinic_id: staff.clinicId,
    p_prescription_item_id: prescriptionItemId,
    p_admission_id: admissionId,
    p_administered_by: staff.staffId,
    p_status: status,
    p_notes: notes || null,
  })

  if (error) return friendlyError('record_medication_administration', 'Impossible d\'enregistrer cette administration.', error)

  revalidatePath(`/admissions/${admissionId}/care`)
  return { success: true }
}

export async function recordCareTaskAction(admissionId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const task = (formData.get('task_description') as string)?.trim()
  if (!task) return { error: 'La description de la tâche est requise.' }

  const { error } = await supabase.rpc('record_care_task', {
    p_clinic_id: staff.clinicId,
    p_admission_id: admissionId,
    p_completed_by: staff.staffId,
    p_task_description: task,
  })

  if (error) return friendlyError('record_care_task', 'Impossible d\'enregistrer cette tâche.', error)

  revalidatePath(`/admissions/${admissionId}/care`)
  return { success: true }
}
