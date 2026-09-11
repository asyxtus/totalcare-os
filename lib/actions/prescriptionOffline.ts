'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export interface OfflinePrescriptionItem {
  productId: string | null
  freetextName: string | null
  dose: string
  frequency: string
  durationDays: string
  quantity: string
}

export interface OfflinePrescriptionPayload {
  clinicId: string
  staffId: string
  visitId: string
  consultationId: string
  items: OfflinePrescriptionItem[]
}

export interface OfflinePrescriptionResult {
  saved?: boolean
  prescriptionId?: string
  idempotentReplay?: boolean
  blocked?: boolean
  error?: string
}

function isPermanentPrescriptionError(message: string): boolean {
  const text = message.toLowerCase()
  return [
    'operation id is required',
    'operation id is already used for another operation',
    'staff authorization failed',
    'visit is invalid or belongs to another clinic',
    'consultation is invalid or belongs to another clinic',
    'consultation is assigned to another doctor',
    'invalid prescription items data',
    'at least one medication is required',
    'each medication must be either a catalog product or free-text medication',
    'medication quantity must be a positive integer',
    'medication duration must be a positive integer',
    'medication product is invalid or inactive',
    'insufficient current stock for prescribed medication',
  ].some((fragment) => text.includes(fragment))
}

export async function createPrescriptionIdempotent(
  operationId: string,
  payload: OfflinePrescriptionPayload,
): Promise<OfflinePrescriptionResult> {
  if (!operationId || !payload.clinicId || !payload.staffId || !payload.visitId || !payload.consultationId) {
    return { blocked: true, error: 'Prescription data is incomplete and requires review before synchronization.' }
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return { blocked: true, error: 'At least one medication is required.' }
  }

  const staff = await getCurrentStaff()
  if (staff.clinicId !== payload.clinicId || staff.staffId !== payload.staffId) {
    return { blocked: true, error: 'This offline prescription belongs to a different clinical session. Review it from the Sync Center.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_prescription_idempotent', {
    p_operation_id: operationId,
    p_clinic_id: payload.clinicId,
    p_staff_id: payload.staffId,
    p_visit_id: payload.visitId,
    p_consultation_id: payload.consultationId,
    p_items: payload.items,
  })

  if (error) {
    if (isPermanentPrescriptionError(error.message)) {
      return {
        blocked: true,
        error: 'This prescription could not be synchronized because its medication data, authorization, or current stock is no longer valid. Review it before retrying.',
      }
    }
    return { error: 'Could not save the prescription. Synchronization will retry automatically.' }
  }

  const result = data?.[0]
  if (!result?.saved || !result?.prescription_id) {
    return { blocked: true, error: 'The prescription was not saved successfully and requires review.' }
  }

  return {
    saved: true,
    prescriptionId: result.prescription_id,
    idempotentReplay: Boolean(result.idempotent_replay),
  }
}
