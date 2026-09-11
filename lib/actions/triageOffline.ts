'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export interface OfflineTriagePayload {
  visit_id: string
  clinic_id: string
  systolic_bp: number | null
  diastolic_bp: number | null
  pulse: number | null
  temperature: number | null
  spo2: number | null
  respiratory_rate: number | null
  weight_kg: number | null
  height_cm: number | null
  chief_complaint: string
  medical_history: string
  social_history: string
  triage_priority: 'routine' | 'urgent' | 'critical'
  priority_note: string
}

export interface OfflineTriageResult {
  error?: string
  saved?: boolean
  completed?: boolean
  requiresReview?: boolean
  flags?: any[]
  replayed?: boolean
  blocked?: boolean
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isPermanentTriageError(code: string | undefined, message: string): boolean {
  if (code && /^(22|23)/.test(code)) return true

  return [
    'Operation ID is required',
    'Operation ID is already used for another operation',
    'Staff authorization failed',
    'Visit is invalid, already triaged, or belongs to another clinic',
    'Invalid triage priority',
    'Invalid systolic blood pressure',
    'Invalid diastolic blood pressure',
    'Invalid pulse',
    'Invalid temperature',
    'Invalid oxygen saturation',
    'Invalid respiratory rate',
    'Invalid weight',
    'Invalid height',
  ].some((fragment) => message.includes(fragment))
}

export async function saveTriageIdempotent(
  operationId: string,
  payload: OfflineTriagePayload,
): Promise<OfflineTriageResult> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const operation = text(operationId)

  if (!operation) return { error: 'Sync operation ID is missing.', blocked: true }
  if (!text(payload.clinic_id) || payload.clinic_id !== staff.clinicId) {
    return { error: 'This triage record belongs to another clinic.', blocked: true }
  }
  if (!text(payload.visit_id)) return { error: 'Visit is required.', blocked: true }
  if (!['routine', 'urgent', 'critical'].includes(payload.triage_priority)) {
    return { error: 'Invalid triage priority.', blocked: true }
  }

  const { data, error } = await supabase.rpc('save_triage_idempotent', {
    p_operation_id: operation,
    p_clinic_id: staff.clinicId,
    p_staff_id: staff.staffId,
    p_visit_id: payload.visit_id,
    p_systolic_bp: payload.systolic_bp,
    p_diastolic_bp: payload.diastolic_bp,
    p_pulse: payload.pulse,
    p_temperature: payload.temperature,
    p_spo2: payload.spo2,
    p_respiratory_rate: payload.respiratory_rate,
    p_weight_kg: payload.weight_kg,
    p_height_cm: payload.height_cm,
    p_chief_complaint: text(payload.chief_complaint) || null,
    p_medical_history: text(payload.medical_history) || null,
    p_social_history: text(payload.social_history) || null,
    p_triage_priority: payload.triage_priority,
    p_priority_note: text(payload.priority_note) || null,
  })

  if (error) {
    console.error('saveTriageIdempotent failed:', {
      code: error.code,
      message: error.message,
      clinicId: staff.clinicId,
    })

    if (isPermanentTriageError(error.code, error.message ?? '')) {
      return {
        error: 'This triage record could not be synchronized because its data is no longer valid. Review the triage details.',
        blocked: true,
      }
    }

    return { error: 'Could not save the triage record. Synchronization will retry automatically.' }
  }

  const result = data?.[0]
  if (!result?.saved) return { error: 'Invalid triage response.', blocked: true }

  return {
    saved: true,
    completed: result.completed,
    requiresReview: result.requires_review,
    flags: result.flags ?? [],
    replayed: result.idempotent_replay,
  }
}
