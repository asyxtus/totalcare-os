'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export interface OfflineAppointmentPayload {
  patient_id: string
  doctor_id: string
  service_price_id: string
  scheduled_at: string
  duration_minutes: number
  reason: string
}

export interface OfflineAppointmentResult {
  error?: string
  appointmentId?: string
  replayed?: boolean
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function bookAppointmentIdempotent(
  operationId: string,
  payload: OfflineAppointmentPayload,
): Promise<OfflineAppointmentResult> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const operation = text(operationId)

  if (!operation) return { error: 'Sync operation ID is missing.' }
  if (!text(payload.patient_id)) return { error: 'Select a patient.' }
  if (!text(payload.scheduled_at)) return { error: 'Date and time are required.' }

  const { data, error } = await supabase.rpc('book_appointment_idempotent', {
    p_operation_id: operation,
    p_clinic_id: staff.clinicId,
    p_staff_id: staff.staffId,
    p_patient_id: payload.patient_id,
    p_doctor_id: text(payload.doctor_id) || null,
    p_service_price_id: text(payload.service_price_id) || null,
    p_scheduled_at: payload.scheduled_at,
    p_duration_minutes: Number.isFinite(payload.duration_minutes) && payload.duration_minutes > 0 ? payload.duration_minutes : 30,
    p_reason: text(payload.reason) || null,
  })

  if (error) {
    console.error('bookAppointmentIdempotent failed:', { code: error.code, message: error.message, clinicId: staff.clinicId })
    return { error: 'Could not save the appointment. Synchronization will retry automatically.' }
  }

  const result = data?.[0]
  if (!result?.appointment_id) return { error: 'Invalid appointment response.' }
  return { appointmentId: result.appointment_id, replayed: result.idempotent_replay }
}
