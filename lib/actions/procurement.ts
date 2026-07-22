// lib/actions/procurement.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

export async function createPurchaseOrder(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const supplierId = formData.get('supplier_id') as string
  const expectedDeliveryDate = formData.get('expected_delivery_date') as string
  const notes = (formData.get('notes') as string)?.trim()

  const productIds = formData.getAll('item_product_id') as string[]
  const quantities = formData.getAll('item_quantity') as string[]
  const unitCosts = formData.getAll('item_unit_cost') as string[]

  const items = productIds
    .map((productId, i) => ({
      product_id: productId,
      quantity: parseInt(quantities[i], 10),
      unit_cost_xaf: unitCosts[i] ? parseFloat(unitCosts[i]) : null,
    }))
    .filter((item) => item.product_id && item.quantity > 0)

  if (!supplierId) return { error: 'Sélectionnez un fournisseur.' }
  if (items.length === 0) return { error: 'Ajoutez au moins un article.' }

  const { data: poId, error } = await supabase.rpc('create_purchase_order', {
    p_clinic_id: staff.clinicId,
    p_supplier_id: supplierId,
    p_created_by: staff.staffId,
    p_expected_delivery_date: expectedDeliveryDate || null,
    p_notes: notes || null,
    p_items: items,
  })

  if (error) return friendlyError('create_purchase_order', 'Impossible de créer le bon de commande.', error)

  revalidatePath('/pharmacy/purchase-orders')
  return { success: true, poId }
}

export async function markPOSent(poId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.rpc('mark_po_sent', { p_po_id: poId, p_staff_id: staff.staffId })

  if (error) return friendlyError('mark_po_sent', 'Impossible de marquer ce bon comme envoyé.', error)

  revalidatePath(`/pharmacy/purchase-orders/${poId}`)
  revalidatePath('/pharmacy/purchase-orders')
  return { success: true }
}

export async function recordSupplierInvoice(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const supplierId = formData.get('supplier_id') as string
  const purchaseOrderId = (formData.get('purchase_order_id') as string) || null
  const invoiceNumber = (formData.get('invoice_number') as string)?.trim()
  const invoiceDate = formData.get('invoice_date') as string
  const totalAmount = formData.get('total_amount_xaf') as string

  if (!supplierId) return { error: 'Sélectionnez un fournisseur.' }
  if (!totalAmount || parseFloat(totalAmount) <= 0) return { error: 'Montant invalide.' }

  const { error } = await supabase.rpc('record_supplier_invoice', {
    p_clinic_id: staff.clinicId,
    p_supplier_id: supplierId,
    p_purchase_order_id: purchaseOrderId,
    p_invoice_number: invoiceNumber || null,
    p_invoice_date: invoiceDate || null,
    p_total_amount_xaf: parseFloat(totalAmount),
    p_created_by: staff.staffId,
  })

  if (error) return friendlyError('record_supplier_invoice', 'Impossible d\'enregistrer la facture.', error)

  revalidatePath('/pharmacy/supplier-invoices')
  return { success: true }
}

export async function recordSupplierPayment(invoiceId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const amount = formData.get('amount_xaf') as string
  const method = (formData.get('payment_method') as string)?.trim()
  const reference = (formData.get('reference') as string)?.trim()

  if (!amount || parseFloat(amount) <= 0) return { error: 'Montant invalide.' }

  const { error } = await supabase.rpc('record_supplier_payment', {
    p_supplier_invoice_id: invoiceId,
    p_amount_xaf: parseFloat(amount),
    p_payment_method: method || null,
    p_reference: reference || null,
    p_paid_by: staff.staffId,
  })

  if (error) return friendlyError('record_supplier_payment', 'Impossible d\'enregistrer le paiement.', error)

  revalidatePath('/pharmacy/supplier-invoices')
  return { success: true }
}

export async function recordSupplierReturn(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const supplierId = formData.get('supplier_id') as string
  const batchId = formData.get('batch_id') as string
  const quantity = formData.get('quantity') as string
  const reason = (formData.get('reason') as string)?.trim()

  if (!supplierId || !batchId) return { error: 'Sélectionnez un fournisseur et un lot.' }
  if (!quantity || parseInt(quantity, 10) <= 0) return { error: 'Quantité invalide.' }
  if (!reason) return { error: 'Un motif est requis.' }

  const { error } = await supabase.rpc('record_supplier_return', {
    p_clinic_id: staff.clinicId,
    p_supplier_id: supplierId,
    p_batch_id: batchId,
    p_quantity: parseInt(quantity, 10),
    p_reason: reason,
    p_created_by: staff.staffId,
  })

  if (error) return friendlyError('record_supplier_return', 'Impossible d\'enregistrer le retour.', error)

  revalidatePath('/pharmacy/returns')
  revalidatePath('/pharmacy/inventory')
  revalidatePath('/pharmacy')
  return { success: true }
}
