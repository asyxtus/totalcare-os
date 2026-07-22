// lib/actions/billing.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

export async function addManualChargeAction(patientId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const description = (formData.get('description') as string)?.trim()
  const amount = formData.get('amount_xaf') as string

  if (!description) return { error: 'Une description est requise.' }
  if (!amount || parseFloat(amount) <= 0) return { error: 'Montant invalide.' }

  const { error } = await supabase.rpc('add_manual_charge', {
    p_clinic_id: staff.clinicId,
    p_patient_id: patientId,
    p_description: description,
    p_amount_xaf: parseFloat(amount),
    p_created_by: staff.staffId,
  })

  if (error) return friendlyError('add_manual_charge', 'Impossible d\'ajouter cette charge.', error)

  return { success: true }
}

export async function requestDiscountAction(serviceChargeId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const amount = formData.get('discount_amount_xaf') as string
  const reason = (formData.get('reason') as string)?.trim()

  if (!amount || parseFloat(amount) <= 0) return { error: 'Montant invalide.' }
  if (!reason) return { error: 'Un motif est requis.' }

  const { error } = await supabase.rpc('request_discount', {
    p_service_charge_id: serviceChargeId,
    p_requested_by: staff.staffId,
    p_discount_amount_xaf: parseFloat(amount),
    p_reason: reason,
  })

  if (error) return friendlyError('request_discount', 'Impossible de demander cette remise.', error)

  revalidatePath('/billing')
  return { success: true }
}

export async function approveDiscountAction(discountId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.rpc('approve_discount', {
    p_discount_id: discountId,
    p_approved_by: staff.staffId,
  })

  if (error) return friendlyError('approve_discount', 'Impossible d\'approuver cette remise.', error)

  revalidatePath('/billing')
  return { success: true }
}

export async function rejectDiscountAction(discountId: string, reason: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  if (!reason.trim()) return { error: 'Un motif est requis pour rejeter une remise.' }

  const { error } = await supabase.rpc('reject_discount', {
    p_discount_id: discountId,
    p_rejected_by: staff.staffId,
    p_reason: reason,
  })

  if (error) return friendlyError('reject_discount', 'Impossible de rejeter cette remise.', error)

  revalidatePath('/billing')
  return { success: true }
}

export async function reviewShiftVarianceAction(shiftId: string, notes: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  if (!notes.trim()) return { error: 'Des notes sont requises pour examiner cet écart.' }

  const { error } = await supabase.rpc('review_shift_variance', {
    p_shift_id: shiftId,
    p_reviewed_by: staff.staffId,
    p_review_notes: notes,
  })

  if (error) return friendlyError('review_shift_variance', 'Impossible d\'examiner cet écart.', error)

  revalidatePath('/billing')
  return { success: true }
}

export async function collectPayment(invoiceId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const amount = formData.get('amount_xaf') as string
  const method = formData.get('payment_method') as string
  const reference = (formData.get('reference') as string)?.trim()

  if (!amount || parseFloat(amount) <= 0) return { error: 'Montant invalide.' }

  const totalAmount = parseFloat(amount)
  const splits = [{ method, amount: totalAmount, provider_transaction_ref: reference || null }]

  const { data: paymentId, error } = await supabase.rpc('create_payment', {
    p_invoice_id: invoiceId,
    p_total_amount_xaf: totalAmount,
    p_received_by: staff.staffId,
    p_splits: splits,
  })

  if (error) return friendlyError('create_payment', 'Impossible d\'encaisser ce paiement.', error)

  revalidatePath('/billing')
  return { success: true, paymentId: paymentId as string | null }
}

export async function openShift(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const openingCash = formData.get('opening_cash_xaf') as string
  if (!openingCash || parseFloat(openingCash) < 0) return { error: 'Montant d\'ouverture invalide.' }

  const { error } = await supabase.rpc('open_cashier_shift', {
    p_clinic_id: staff.clinicId,
    p_staff_id: staff.staffId,
    p_opening_cash_xaf: parseFloat(openingCash),
  })

  if (error) return friendlyError('open_cashier_shift', 'Impossible d\'ouvrir la caisse.', error)

  revalidatePath('/billing')
  return { success: true }
}

export async function closeShift(shiftId: string, formData: FormData) {
  const supabase = await createClient()

  const closingCash = formData.get('closing_cash_xaf') as string
  const notes = (formData.get('notes') as string)?.trim()
  if (!closingCash || parseFloat(closingCash) < 0) return { error: 'Montant de clôture invalide.' }

  const { error } = await supabase.rpc('close_cashier_shift', {
    p_shift_id: shiftId,
    p_closing_cash_xaf: parseFloat(closingCash),
    p_notes: notes || null,
  })

  if (error) return friendlyError('close_cashier_shift', 'Impossible de clôturer la caisse.', error)

  revalidatePath('/billing')
  return { success: true }
}

export async function reversePaymentAction(paymentId: string, reason: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  if (!reason.trim()) return { error: 'Un motif est requis pour annuler un paiement.' }

  const { error } = await supabase.rpc('reverse_payment', {
    p_payment_id: paymentId,
    p_reversed_by: staff.staffId,
    p_reason: reason,
  })

  if (error) return friendlyError('reverse_payment', 'Impossible d\'annuler ce paiement.', error)

  revalidatePath('/billing')
  return { success: true }
}

// Collect payment for service charges that have no invoice —
// common for lab charges ordered after the consultation invoice was created.
// Marks each charge as paid and records the payment in payment_receipts.
export async function collectChargesDirectly(chargeIds: string[], formData: FormData, patientId?: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const amount = parseFloat(formData.get('amount_xaf') as string)
  const method = formData.get('payment_method') as string
  const reference = (formData.get('reference') as string)?.trim() || null

  if (!amount || amount <= 0) return { error: 'Montant invalide.' }
  if (!chargeIds.length) return { error: 'Aucun frais à encaisser.' }

  // If patientId wasn't passed explicitly, look it up from the first charge
  // so the payment record always has a patient attached — otherwise the
  // receipt and Receipts list show a blank patient name.
  let resolvedPatientId = patientId ?? null
  if (!resolvedPatientId) {
    const { data: firstCharge } = await supabase
      .from('service_charges')
      .select('patient_id')
      .eq('id', chargeIds[0])
      .maybeSingle()
    resolvedPatientId = firstCharge?.patient_id ?? null
  }

  // Create the payment record FIRST — this is what makes the money
  // traceable in Receipts, the end-of-day report, and patient payment
  // history. invoice_id is null because these charges have no invoice.
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      clinic_id: staff.clinicId,
      patient_id: resolvedPatientId,
      invoice_id: null,
      total_amount_xaf: amount,
      status: 'completed',
      received_by: staff.staffId,
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    return friendlyError('collectChargesDirectly', 'Impossible d\'enregistrer ce paiement.', paymentError)
  }

  const { error: splitError } = await supabase
    .from('payment_splits')
    .insert({
      payment_id: payment.id,
      method,
      amount_xaf: amount,
      provider_transaction_ref: reference,
    })

  if (splitError) {
    return friendlyError('collectChargesDirectly', 'Impossible d\'enregistrer le mode de paiement.', splitError)
  }

  // Mark each charge as paid
  for (const chargeId of chargeIds) {
    const { data: sc } = await supabase
      .from('service_charges')
      .select('amount_xaf, patient_portion_xaf')
      .eq('id', chargeId)
      .eq('clinic_id', staff.clinicId)
      .maybeSingle()
    if (!sc) continue
    const chargeAmount = Number(sc.patient_portion_xaf ?? sc.amount_xaf)
    await supabase
      .from('service_charges')
      .update({ amount_paid_xaf: chargeAmount, status: 'paid' })
      .eq('id', chargeId)
  }

  await supabase.from('audit_log').insert({
    clinic_id: staff.clinicId,
    staff_id: staff.staffId,
    action: 'billing.direct_charge_collection',
    entity_type: 'service_charge',
    details: { charge_ids: chargeIds, amount, method, reference, payment_id: payment.id },
  })

  revalidatePath('/billing')
  return { success: true, paymentId: payment.id }
}
