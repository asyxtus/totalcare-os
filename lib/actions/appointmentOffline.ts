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
  blocked?: boolean
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isPermanentAppointmentError(message: string): boolean {
  return [
    'Operation ID is required',
    'Operation ID is already used for another operation',
    'Patient does not belong to this clinic',
    'Invalid doctor',
    'Invalid consultation type',
    'Date and time are required',
  ].some((fragment) => message.includes(fragment))
}

export async function bookAppointmentIdempotent(
  operationId: string,
  payload: OfflineAppointmentPayload,
): Promise<OfflineAppointmentResult> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const operation = text(operationId)

  if (!operation) return { error: 'Sync operation ID is missing.', blocked: true }
  if (!text(payload.patient_id)) return { error: 'Select a patient.', blocked: true }
  if (!text(payload.scheduled_at)) return { error: 'Date and time are required.', blocked: true }

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
    if (isPermanentAppointmentError(error.message ?? '')) {
      return { error: 'This appointment could not be synchronized because its data is no longer valid. Review the appointment details.', blocked: true }
    }
    return { error: 'Could not save the appointment. Synchronization will retry automatically.' }
  }

  const result = data?.[0]
  if (!result?.appointment_id) return { error: 'Invalid appointment response.', blocked: true }
  return { appointmentId: result.appointment_id, replayed: result.idempotent_replay }
}
