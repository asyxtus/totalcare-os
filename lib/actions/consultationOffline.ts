'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export interface OfflineConsultationPayload {
  clinicId: string
  staffId: string
  visitId: string
  consultationId: string
  subjectiveNotes: string
  examinationNotes: string
  treatmentPlan: string
  diagnoses: Array<{
    diagnosis: string
    icd10Code: string | null
    isPrimary: boolean
    sequence: number
  }>
}

export interface OfflineConsultationResult {
  saved?: boolean
  completed?: boolean
  idempotentReplay?: boolean
  blocked?: boolean
  error?: string
}

function isPermanentConsultationError(message: string): boolean {
  const text = message.toLowerCase()
  return [
    'operation id is required',
    'operation id is already used for another operation',
    'staff authorization failed',
    'visit is invalid or belongs to another clinic',
    'consultation is no longer active',
    'consultation is invalid or belongs to another clinic',
    'consultation is assigned to another doctor',
    'invalid diagnoses data',
    'already been completed',
    'not found for this visit',
  ].some((fragment) => text.includes(fragment))
}

export async function saveConsultationIdempotent(
  operationId: string,
  payload: OfflineConsultationPayload,
): Promise<OfflineConsultationResult> {
  if (!operationId || !payload.clinicId || !payload.staffId || !payload.visitId || !payload.consultationId) {
    return { blocked: true, error: 'Consultation data is incomplete and requires review before synchronization.' }
  }

  if (!payload.diagnoses.some((d) => d.diagnosis.trim())) {
    return { blocked: true, error: 'A diagnosis is required before this consultation can be synchronized.' }
  }

  const staff = await getCurrentStaff()
  if (staff.clinicId !== payload.clinicId || staff.staffId !== payload.staffId) {
    return { blocked: true, error: 'This offline consultation belongs to a different clinical session. Review it from the Sync Center.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('complete_consultation_idempotent', {
    p_operation_id: operationId,
    p_clinic_id: payload.clinicId,
    p_staff_id: payload.staffId,
    p_visit_id: payload.visitId,
    p_consultation_id: payload.consultationId,
    p_subjective_notes: payload.subjectiveNotes?.trim() || null,
    p_examination_notes: payload.examinationNotes?.trim() || null,
    p_treatment_plan: payload.treatmentPlan?.trim() || null,
    p_diagnoses: payload.diagnoses,
  })

  if (error) {
    if (isPermanentConsultationError(error.message)) {
      return {
        blocked: true,
        error: 'This consultation could not be synchronized because its data or clinical state is no longer valid. Review the consultation before retrying.',
      }
    }
    return { error: 'Could not save the consultation. Synchronization will retry automatically.' }
  }

  const result = data?.[0]
  if (!result?.saved || !result?.completed) {
    return { blocked: true, error: 'The consultation did not complete successfully and requires review.' }
  }

  return {
    saved: true,
    completed: true,
    idempotentReplay: Boolean(result.idempotent_replay),
  }
}
