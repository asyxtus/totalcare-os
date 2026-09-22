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


export async function releaseOrphanBedAction(bedId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data: activeAdmission, error: admissionError } = await supabase
    .from('admissions')
    .select('id, admission_number, patients(full_name)')
    .eq('clinic_id', staff.clinicId)
    .eq('bed_id', bedId)
    .eq('status', 'admitted')
    .maybeSingle()

  if (admissionError) return friendlyError('releaseOrphanBed', 'Impossible de vérifier ce lit.', admissionError)
  if (activeAdmission) {
    return { error: 'Ce lit est lié à une admission active. Utilisez la sortie du patient.' }
  }

  const { error } = await supabase
    .from('beds')
    .update({ status: 'available' })
    .eq('id', bedId)
    .eq('clinic_id', staff.clinicId)
    .eq('status', 'occupied')

  if (error) return friendlyError('releaseOrphanBed', 'Impossible de libérer ce lit.', error)

  revalidatePath('/admissions')
  return { success: true }
}


export async function getAdmissionBedSummaryAction(admissionId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data: admission, error: admissionError } = await supabase
    .from('admissions')
    .select('id, admission_number, admission_reason, status, visit_id, bed_assigned_at, patients(full_name, patient_code, allergies), wards(name), beds(bed_number)')
    .eq('id', admissionId)
    .eq('clinic_id', staff.clinicId)
    .maybeSingle()

  if (admissionError) return { error: 'Impossible de charger le résumé du patient.' }
  if (!admission) return { error: 'Admission introuvable.' }

  const [{ data: notes }, { data: tasks }, { data: vitals }, { data: prescriptions }, { data: labOrders }] = await Promise.all([
    supabase.from('inpatient_notes').select('id, note, round_type, recorded_at').eq('admission_id', admissionId).order('recorded_at', { ascending: false }).limit(5),
    supabase.from('care_tasks').select('id, task_description, completed_at').eq('admission_id', admissionId).order('completed_at', { ascending: false }).limit(8),
    supabase.from('vital_signs').select('id, recorded_at, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature_celsius, respiratory_rate, oxygen_saturation').eq('admission_id', admissionId).order('recorded_at', { ascending: false }).limit(1),
    supabase.from('prescriptions').select('id').eq('visit_id', admission.visit_id),
    supabase.from('lab_orders').select('id, ordered_at').eq('visit_id', admission.visit_id).order('ordered_at', { ascending: false }),
  ])

  const prescriptionIds = (prescriptions ?? []).map((p: any) => p.id)
  const { data: prescriptionItems } = prescriptionIds.length
    ? await supabase.from('prescription_items').select('id').in('prescription_id', prescriptionIds)
    : { data: [] }

  const labOrderIds = (labOrders ?? []).map((o: any) => o.id)
  const { data: labItems } = labOrderIds.length
    ? await supabase.from('lab_order_items').select('id, status').in('lab_order_id', labOrderIds)
    : { data: [] }

  const completedTasks = (tasks ?? []).filter((t: any) => t.completed_at).length
  const pendingTasks = (tasks ?? []).filter((t: any) => !t.completed_at).length
  const completedLabs = (labItems ?? []).filter((l: any) => ['completed', 'verified'].includes(l.status)).length
  const pendingLabs = (labItems ?? []).filter((l: any) => !['completed', 'verified', 'cancelled'].includes(l.status)).length

  return {
    success: true,
    admission: {
      id: admission.id,
      admission_number: admission.admission_number,
      admission_reason: admission.admission_reason,
      status: admission.status,
      visit_id: admission.visit_id,
      bed_assigned_at: admission.bed_assigned_at,
      patient: admission.patients,
      ward: admission.wards,
      bed: admission.beds,
    },
    notes: notes ?? [],
    tasks: { completed: completedTasks, pending: pendingTasks, total: (tasks ?? []).length },
    medications: { prescriptions: prescriptionIds.length, items: (prescriptionItems ?? []).length },
    labs: { orders: labOrderIds.length, completed: completedLabs, pending: pendingLabs },
    latestVitals: vitals?.[0] ?? null,
  }
}
