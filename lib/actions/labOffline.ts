'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export type OfflineLabOrderItem =
  | { type: 'panel'; panelId: string }
  | { type: 'individual_test'; catalogId: string }
  | { type: 'external'; name: string }

export interface OfflineLabOrderPayload {
  clinicId: string
  staffId: string
  visitId: string
  items: OfflineLabOrderItem[]
  billingMode: 'pay_now' | 'charge_to_encounter' | 'deferred'
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function createLabOrderIdempotent(
  operationId: string,
  payload: OfflineLabOrderPayload,
) {
  const staff = await getCurrentStaff()

  if (!['doctor', 'admin'].includes(staff.role)) {
    return { blocked: true, error: 'Laboratory ordering is restricted to doctors and administrators.' }
  }
  if (!isUuid(operationId) || !isUuid(payload.visitId)) {
    return { blocked: true, error: 'Invalid laboratory operation or visit ID.' }
  }
  if (payload.clinicId !== staff.clinicId || payload.staffId !== staff.staffId) {
    return { blocked: true, error: 'Offline laboratory session no longer matches the current staff session.' }
  }
  if (!payload.items.length) {
    return { blocked: true, error: 'At least one laboratory investigation is required.' }
  }

  const items = payload.items.map((item) => {
    if (item.type === 'panel') return { type: 'panel', panel_id: item.panelId }
    if (item.type === 'individual_test') return { type: 'individual_test', catalog_id: item.catalogId }
    return { type: 'external', name: item.name.trim() }
  })

  if (items.some((item) => item.type === 'external' && !item.name)) {
    return { blocked: true, error: 'External laboratory test name cannot be empty.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_lab_order_idempotent', {
    p_operation_id: operationId,
    p_clinic_id: payload.clinicId,
    p_staff_id: payload.staffId,
    p_visit_id: payload.visitId,
    p_items: items,
    p_billing_mode: payload.billingMode,
  })

  if (error) {
    const message = error.message || 'Laboratory order synchronization failed.'
    const permanent = /operation id|authorization|invalid laboratory|at least one|visit is invalid|another clinic|not available for this clinic|unknown lab order|external laboratory test/i.test(message)
    return permanent ? { blocked: true, error: message } : { error: message }
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    saved: Boolean(row?.saved),
    labOrderId: row?.lab_order_id as string | null,
    serviceChargeIds: (row?.service_charge_ids ?? []) as string[],
    idempotentReplay: Boolean(row?.idempotent_replay),
  }
}
