// lib/actions/deposits.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

export async function recordDepositAction(patientId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const amount = formData.get('amount_xaf') as string
  const method = formData.get('method') as string
  const notes = (formData.get('notes') as string)?.trim()

  if (!amount || parseFloat(amount) <= 0) return { error: 'Montant invalide.' }

  const { error } = await supabase.rpc('record_patient_deposit', {
    p_clinic_id: staff.clinicId,
    p_patient_id: patientId,
    p_amount_xaf: parseFloat(amount),
    p_method: method,
    p_received_by: staff.staffId,
    p_notes: notes || null,
  })

  if (error) return friendlyError('record_patient_deposit', 'Impossible d\'enregistrer ce dépôt.', error)

  return { success: true }
}

export async function applyDepositAction(patientId: string, invoiceId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const amount = formData.get('amount_xaf') as string
  if (!amount || parseFloat(amount) <= 0) return { error: 'Montant invalide.' }

  const { error } = await supabase.rpc('apply_deposit_to_invoice', {
    p_clinic_id: staff.clinicId,
    p_patient_id: patientId,
    p_invoice_id: invoiceId,
    p_amount_xaf: parseFloat(amount),
    p_applied_by: staff.staffId,
  })

  if (error) return friendlyError('apply_deposit_to_invoice', 'Impossible d\'appliquer le dépôt.', error)

  return { success: true }
}
