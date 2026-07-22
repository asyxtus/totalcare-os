// lib/actions/appointments.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

// Lightweight patient lookup for the booking form's search-as-you-type —
// same three fields the main Patients list already searches by
// (full_name, patient_code, phone), just capped tighter since this
// feeds a dropdown, not a page.
export async function searchPatientsForBookingAction(query: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const q = query.trim()
  if (q.length < 2) return []

  const { data } = await supabase
    .from('patients')
    .select('id, full_name, patient_code, phone')
    .eq('clinic_id', staff.clinicId)
    .or(`full_name.ilike.%${q}%,patient_code.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(8)

  return data ?? []
}

export async function bookAppointmentAction(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const patientId = formData.get('patient_id') as string
  const doctorId = (formData.get('doctor_id') as string)?.trim()
  const servicePriceId = (formData.get('service_price_id') as string)?.trim()
  const date = formData.get('date') as string
  const time = formData.get('time') as string
  const durationMinutes = parseInt((formData.get('duration_minutes') as string) || '30', 10)
  const reason = (formData.get('reason') as string)?.trim()

  if (!patientId) return { error: 'Sélectionnez un patient.' }
  if (!date || !time) return { error: 'La date et l\'heure sont requises.' }

  const scheduledAt = new Date(`${date}T${time}:00`)
  if (Number.isNaN(scheduledAt.getTime())) return { error: 'Date ou heure invalide.' }

  const { error } = await supabase.from('appointments').insert({
    clinic_id: staff.clinicId,
    patient_id: patientId,
    doctor_id: doctorId || null,
    service_price_id: servicePriceId || null,
    scheduled_at: scheduledAt.toISOString(),
    duration_minutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 30,
    reason: reason || null,
    created_by: staff.staffId,
  })

  if (error) return friendlyError('bookAppointment', 'Impossible de créer ce rendez-vous.', error)

  revalidatePath('/reception')
  return { success: true }
}

export async function cancelAppointmentAction(appointmentId: string, reason: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  if (!reason.trim()) return { error: 'Un motif d\'annulation est requis.' }

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', cancelled_reason: reason.trim() })
    .eq('id', appointmentId)
    .eq('clinic_id', staff.clinicId)
    .eq('status', 'scheduled')

  if (error) return friendlyError('cancelAppointment', 'Impossible d\'annuler ce rendez-vous.', error)

  revalidatePath('/reception')
  return { success: true }
}

export async function markNoShowAction(appointmentId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'no_show' })
    .eq('id', appointmentId)
    .eq('clinic_id', staff.clinicId)
    .eq('status', 'scheduled')

  if (error) return friendlyError('markNoShow', 'Impossible de marquer comme absent.', error)

  revalidatePath('/reception')
  return { success: true }
}

// Mark an appointment reminder call as made, with its outcome.
// Called from the receptionist's daily call list.
export async function markAppointmentReminded(appointmentId: string, outcome: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const validOutcomes = ['confirmed', 'no_answer', 'rescheduled', 'cancelled']
  if (!validOutcomes.includes(outcome)) {
    return { error: 'Résultat invalide.' }
  }

  const { error } = await supabase.rpc('mark_appointment_reminded', {
    p_appointment_id: appointmentId,
    p_called_by: staff.staffId,
    p_outcome: outcome,
  })

  if (error) return friendlyError('mark_appointment_reminded', 'Impossible d\'enregistrer l\'appel.', error)

  revalidatePath('/appointments')
  return { success: true }
}
