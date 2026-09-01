'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

export async function deferLabOrderItem(itemId: string, reason?: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  if (!itemId) return { error: 'Examen requis.' }
  const { error } = await supabase.rpc('defer_lab_order_item', { p_lab_order_item_id: itemId, p_staff_id: staff.staffId, p_reason: reason?.trim() || null })
  if (error) return { error: error.message || "Impossible de différer l'examen." }
  revalidatePath('/billing'); revalidatePath('/laboratory'); revalidatePath('/reception')
  return { success: true }
}

export async function activateDeferredLabOrderItem(itemId: string, billingMode: 'pay_now' | 'charge_to_encounter' = 'pay_now') {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  if (!itemId) return { error: 'Examen requis.' }
  const { data, error } = await supabase.rpc('activate_deferred_lab_order_item', { p_lab_order_item_id: itemId, p_staff_id: staff.staffId, p_billing_mode: billingMode })
  if (error) return { error: error.message || "Impossible de réactiver l'examen." }
  revalidatePath('/billing'); revalidatePath('/laboratory'); revalidatePath('/reception')
  return { success: true, chargeId: data }
}

export async function prepareSelectedLabPayment(itemIds: string[]) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const ids = [...new Set(itemIds.filter(Boolean))]
  if (!ids.length) return { error: 'Sélectionnez au moins un examen.' }
  const { data, error } = await supabase.rpc('prepare_selected_lab_payment', { p_lab_order_item_ids: ids, p_staff_id: staff.staffId })
  if (error) return { error: error.message || 'Impossible de préparer le paiement des examens.' }
  revalidatePath('/billing'); revalidatePath('/reception'); revalidatePath('/laboratory')
  return { success: true, invoiceId: data as string }
}

export async function collectLabPayment(invoiceId: string, amount: number, method: string, reference?: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  if (!invoiceId || !Number.isFinite(amount) || amount <= 0) return { error: 'Montant invalide.' }
  if (!method) return { error: 'Mode de paiement requis.' }
  const { data, error } = await supabase.rpc('create_payment', {
    p_invoice_id: invoiceId,
    p_total_amount_xaf: amount,
    p_received_by: staff.staffId,
    p_splits: [{ method, amount, provider_transaction_ref: reference?.trim() || null }],
  })
  if (error) return { error: error.message || "Impossible d'encaisser le paiement." }
  revalidatePath('/billing'); revalidatePath('/reception'); revalidatePath('/laboratory')
  return { success: true, paymentId: data as string | null }
}
