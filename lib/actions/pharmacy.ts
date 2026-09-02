// lib/actions/pharmacy.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

function friendlyDispensingError(err: { message?: string; code?: string } | null) {
  const raw = (err?.message || '').trim()
  console.error('dispense_prescription_item failed:', err)
  const normalized = raw.toLowerCase()
  let reason = 'Une erreur est survenue lors de la délivrance.'

  if (normalized.includes('insufficient stock') || normalized.includes('insufficient quantity') || normalized.includes('not enough stock')) {
    reason = 'Stock insuffisant pour la quantité demandée.'
  } else if (normalized.includes('no usable stock') || normalized.includes('no stock') || normalized.includes('out of stock')) {
    reason = 'Aucun stock disponible pour ce médicament.'
  } else if (normalized.includes('not been reviewed') || normalized.includes('must be reviewed') || normalized.includes('not reviewed')) {
    reason = "Cette ordonnance n'a pas encore été validée par le pharmacien."
  } else if (normalized.includes('already fully dispensed') || normalized.includes('fully dispensed')) {
    reason = 'Ce médicament a déjà été entièrement dispensé.'
  } else if (normalized.includes('exceeds remaining') || normalized.includes('remaining quantity')) {
    reason = "La quantité demandée dépasse la quantité restante sur cette ordonnance."
  } else if (normalized.includes('inactive product') || normalized.includes('product is inactive')) {
    reason = 'Le produit correspondant est inactif dans le stock.'
  } else if (normalized.includes('product') && (normalized.includes('not found') || normalized.includes('could not find'))) {
    reason = 'Le produit correspondant est introuvable dans la pharmacie.'
  } else if (normalized.includes('manual price') || normalized.includes('unit price') || normalized.includes('price is required')) {
    reason = 'Un prix unitaire doit être renseigné pour ce médicament.'
  } else if (normalized.includes('witness')) {
    reason = 'Un témoin autorisé est requis pour cette délivrance.'
  } else if (normalized.includes('expired') || normalized.includes('expiry')) {
    reason = "Le lot sélectionné est expiré ou sa date d'expiration ne permet pas la délivrance."
  } else if (normalized.includes('permission') || normalized.includes('not authorized') || normalized.includes('forbidden')) {
    reason = "Vous n'êtes pas autorisé à effectuer cette délivrance."
  } else if (raw) {
    reason = raw.replace(/\s+/g, ' ').slice(0, 300)
  }

  return {
    error: `Impossible de dispenser ce médicament. Raison : ${reason}`,
  }
}

export async function updateProduct(productId: string, formData: FormData) {
  const supabase = await createClient()
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Le nom du produit est requis.' }
  const salePrice = formData.get('sale_price_xaf') as string
  if (!salePrice || parseFloat(salePrice) <= 0) return { error: 'Le prix de vente est requis.' }
  const { error } = await supabase.from('products').update({
    name,
    name_fr: (formData.get('name_fr') as string)?.trim() || name,
    generic_name: (formData.get('generic_name') as string)?.trim() || null,
    drug_class_id: (formData.get('drug_class_id') as string) || null,
    dosage_form: (formData.get('dosage_form') as string)?.trim() || null,
    unit: (formData.get('unit') as string)?.trim() || null,
    barcode: (formData.get('barcode') as string)?.trim() || null,
    sale_price_xaf: parseFloat(salePrice),
    cost_price_xaf: formData.get('cost_price_xaf') ? parseFloat(formData.get('cost_price_xaf') as string) : null,
    reorder_threshold: formData.get('reorder_threshold') ? parseInt(formData.get('reorder_threshold') as string, 10) : 10,
  }).eq('id', productId)
  if (error) return friendlyError('updateProduct', 'Impossible de modifier ce produit.', error)
  revalidatePath('/pharmacy/inventory')
  revalidatePath('/pharmacy')
  return { success: true }
}

export async function updateSupplier(supplierId: string, formData: FormData) {
  const supabase = await createClient()
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Le nom du fournisseur est requis.' }
  const { error } = await supabase.from('suppliers').update({ name, contact_name: (formData.get('contact_name') as string)?.trim() || null, phone: (formData.get('phone') as string)?.trim() || null, email: (formData.get('email') as string)?.trim() || null, address: (formData.get('address') as string)?.trim() || null, payment_terms_days: formData.get('payment_terms_days') ? parseInt(formData.get('payment_terms_days') as string, 10) : 0 }).eq('id', supplierId)
  if (error) return friendlyError('updateSupplier', 'Impossible de modifier ce fournisseur.', error)
  revalidatePath('/pharmacy/suppliers')
  return { success: true }
}

export async function toggleSupplierActive(supplierId: string, isActive: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').update({ is_active: !isActive }).eq('id', supplierId)
  if (error) return friendlyError('toggleSupplierActive', 'Impossible de modifier ce fournisseur.', error)
  revalidatePath('/pharmacy/suppliers')
  return { success: true }
}

export async function createProduct(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Le nom du produit est requis.' }
  const salePrice = formData.get('sale_price_xaf') as string
  const costPrice = formData.get('cost_price_xaf') as string
  const reorderThreshold = formData.get('reorder_threshold') as string
  if (!salePrice || parseFloat(salePrice) <= 0) return { error: 'Le prix de vente est requis.' }
  const { data: sku } = await supabase.rpc('generate_next_sku', { p_clinic_id: staff.clinicId })
  const { error } = await supabase.from('products').insert({ clinic_id: staff.clinicId, sku, name, name_fr: (formData.get('name_fr') as string)?.trim() || name, generic_name: (formData.get('generic_name') as string)?.trim() || null, drug_class_id: (formData.get('drug_class_id') as string) || null, dosage_form: (() => { const f = (formData.get('form') as string)?.trim(); const st = (formData.get('strength') as string)?.trim(); return st && f ? `${st} ${f}` : (st || f || null) })(), unit: (formData.get('unit') as string)?.trim() || null, barcode: (formData.get('barcode') as string)?.trim() || null, sale_price_xaf: parseFloat(salePrice), cost_price_xaf: costPrice ? parseFloat(costPrice) : null, reorder_threshold: reorderThreshold ? parseInt(reorderThreshold, 10) : 10 })
  if (error) return friendlyError('createProduct', 'Impossible de créer le produit — vérifiez que le code-barres n\'est pas déjà utilisé.', error)
  revalidatePath('/pharmacy/inventory')
  revalidatePath('/pharmacy')
  return { success: true }
}

export async function toggleProductActive(productId: string, isActive: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('products').update({ is_active: !isActive }).eq('id', productId)
  if (error) return friendlyError('toggleProductActive', 'Impossible de modifier ce produit.', error)
  revalidatePath('/pharmacy/inventory')
  revalidatePath('/pharmacy')
  return { success: true }
}

export async function recordStockAdjustment(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const batchId = formData.get('batch_id') as string
  const direction = formData.get('direction') as string
  const quantity = formData.get('quantity') as string
  const reason = (formData.get('reason') as string)?.trim()
  if (!batchId) return { error: 'Sélectionnez un lot.' }
  if (!quantity || parseInt(quantity, 10) <= 0) return { error: 'Quantité invalide.' }
  if (!reason) return { error: 'Un motif est requis.' }
  const { error } = await supabase.rpc('record_stock_adjustment', { p_clinic_id: staff.clinicId, p_batch_id: batchId, p_quantity: parseInt(quantity, 10), p_direction: direction, p_reason: reason, p_staff_id: staff.staffId })
  if (error) return friendlyError('record_stock_adjustment', 'Impossible d\'enregistrer l\'ajustement.', error)
  revalidatePath('/pharmacy/adjustments')
  revalidatePath('/pharmacy/inventory')
  revalidatePath('/pharmacy')
  return { success: true }
}

export async function approvePrescriptionReview(prescriptionId: string, notes: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const { error } = await supabase.rpc('approve_prescription_review', { p_prescription_id: prescriptionId, p_reviewed_by: staff.staffId, p_review_notes: notes || null })
  if (error) return friendlyError('approve_prescription_review', 'Impossible d\'approuver cette ordonnance.', error)
  revalidatePath('/pharmacy')
  revalidatePath(`/pharmacy/prescriptions/${prescriptionId}`)
  return { success: true }
}

export async function checkoutPosSale(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const paymentMethod = formData.get('payment_method') as string
  const cartJson = formData.get('cart') as string
  if (!cartJson) return { error: 'Le panier est vide.' }
  let cart: { product_id: string; quantity: number }[]
  try { cart = JSON.parse(cartJson) } catch { return { error: 'Panier invalide.' } }
  if (cart.length === 0) return { error: 'Le panier est vide.' }
  const { data: saleId, error } = await supabase.rpc('record_pos_sale', { p_clinic_id: staff.clinicId, p_patient_id: null, p_sold_by: staff.staffId, p_payment_method: paymentMethod, p_cart: cart })
  if (error) return friendlyError('record_pos_sale', 'Impossible de finaliser la vente.', error)
  revalidatePath('/pharmacy')
  return { success: true, saleId }
}

export async function createSupplier(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Le nom du fournisseur est requis.' }
  const { error } = await supabase.from('suppliers').insert({ clinic_id: staff.clinicId, name, contact_name: (formData.get('contact_name') as string)?.trim() || null, phone: (formData.get('phone') as string)?.trim() || null, email: (formData.get('email') as string)?.trim() || null, address: (formData.get('address') as string)?.trim() || null, payment_terms_days: formData.get('payment_terms_days') ? parseInt(formData.get('payment_terms_days') as string, 10) : 0 })
  if (error) return friendlyError('createSupplier', 'Impossible de créer le fournisseur.', error)
  revalidatePath('/pharmacy/suppliers')
  return { success: true }
}

export async function recordGoodsReceipt(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const supplierId = formData.get('supplier_id') as string
  const purchaseOrderId = (formData.get('purchase_order_id') as string) || null
  const invoiceReference = (formData.get('invoice_reference') as string)?.trim()
  const notes = (formData.get('notes') as string)?.trim()
  const productIds = formData.getAll('item_product_id') as string[]
  const batchNumbers = formData.getAll('item_batch_number') as string[]
  const expiryDates = formData.getAll('item_expiry_date') as string[]
  const quantities = formData.getAll('item_quantity') as string[]
  const unitCosts = formData.getAll('item_unit_cost') as string[]
  const items = productIds.map((productId, i) => ({ product_id: productId, batch_number: batchNumbers[i], expiry_date: expiryDates[i], quantity: parseInt(quantities[i], 10), unit_cost_xaf: unitCosts[i] ? parseFloat(unitCosts[i]) : null })).filter((item) => item.product_id && item.batch_number && item.expiry_date && item.quantity > 0)
  if (items.length === 0) return { error: 'Ajoutez au moins un article avec produit, numéro de lot, date d\'expiration et quantité.' }
  const { error } = await supabase.rpc('record_goods_receipt', { p_clinic_id: staff.clinicId, p_supplier_id: supplierId || null, p_received_by: staff.staffId, p_invoice_reference: invoiceReference || null, p_notes: notes || null, p_items: items, p_purchase_order_id: purchaseOrderId })
  if (error) return friendlyError('record_goods_receipt', 'Impossible d\'enregistrer la réception.', error)
  revalidatePath('/pharmacy')
  revalidatePath('/pharmacy/receiving')
  return { success: true }
}

export async function dispensePrescriptionItem(prescriptionId: string, itemId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const quantity = parseInt(formData.get('quantity') as string, 10)
  const witnessId = (formData.get('witness_id') as string) || null
  const manualPrice = formData.get('manual_unit_price_xaf') as string
  const counselingNotes = (formData.get('counseling_notes') as string)?.trim()
  const productIdOverride = (formData.get('product_id_override') as string) || null
  const patientSupplied = formData.get('patient_supplied') === 'true'

  if (!quantity || quantity <= 0) return { error: 'Quantité invalide.' }

  // Capture the encounter before dispensing so the successful pharmacy action
  // can reconcile the encounter status immediately afterwards.
  const { data: prescription, error: prescriptionError } = await supabase
    .from('prescriptions')
    .select('visit_id')
    .eq('id', prescriptionId)
    .maybeSingle()

  if (prescriptionError || !prescription?.visit_id) {
    return friendlyDispensingError(prescriptionError ?? { message: 'Prescription has no linked encounter.' })
  }

  const { data, error } = await supabase.rpc('dispense_prescription_item', {
    p_prescription_item_id: itemId,
    p_quantity: quantity,
    p_dispensed_by: staff.staffId,
    p_witness_id: witnessId,
    p_allow_expired_override: false,
    p_override_reason: null,
    p_override_approved_by: null,
    p_manual_unit_price_xaf: manualPrice ? parseFloat(manualPrice) : null,
    p_product_id_override: productIdOverride,
    p_patient_supplied: patientSupplied,
  })

  if (error) return friendlyDispensingError(error)

  if (counselingNotes) {
    await supabase.from('prescription_items').update({ dispensing_notes: counselingNotes }).eq('id', itemId)
  }

  // Dispensing is the pharmacy completion event. Reconcile only after the
  // dispensing RPC succeeds so a failed dispense cannot move the encounter.
  const { error: advanceError } = await supabase.rpc('advance_encounter_status', {
    p_visit_id: prescription.visit_id,
  })

  if (advanceError) {
    console.error('advance_encounter_status after pharmacy dispensing failed:', advanceError)
  }

  revalidatePath(`/pharmacy/prescriptions/${prescriptionId}`)
  revalidatePath('/pharmacy/dispensing')
  revalidatePath('/pharmacy')

  return { success: true, serviceChargeId: (data as any)?.service_charge_id ?? null }
}

// ── Product template import ────────────────────────────────────────────────

export async function importFromTemplate(templateId: string, salePrice: number, costPrice?: number | null) {
  const staff = await getCurrentStaff()
  if (!['admin', 'pharmacist'].includes(staff.role)) return { error: 'Rôle insuffisant.' }
  const supabase = await createClient()
  const { data: tpl, error: tplErr } = await supabase.from('product_templates').select('name, name_fr, dosage_form, unit, drug_class_id, requires_review').eq('id', templateId).maybeSingle()
  if (tplErr || !tpl) return { error: 'Modèle introuvable.' }
  const { data: sku } = await supabase.rpc('generate_next_sku', { p_clinic_id: staff.clinicId })
  const { error } = await supabase.from('products').insert({ clinic_id: staff.clinicId, sku, name: tpl.name, name_fr: tpl.name_fr ?? tpl.name, dosage_form: tpl.dosage_form, unit: tpl.unit, drug_class_id: tpl.drug_class_id, requires_review: tpl.requires_review, sale_price_xaf: salePrice, cost_price_xaf: costPrice ?? null, reorder_threshold: 10, is_active: true })
  if (error) return friendlyError('importFromTemplate', 'Impossible d\'importer ce médicament.', error)
  revalidatePath('/pharmacy/inventory')
  return { success: true }
}

export async function searchProductTemplates(query: string, drugClassId?: string) {
  const supabase = await createClient()
  let q = supabase.from('product_templates').select('id, name, name_fr, dosage_form, unit, requires_review, drug_classes(name_fr, name_en, is_antibiotic)').order('name').limit(50)
  if (query.trim()) q = q.or(`name.ilike.%${query}%,name_fr.ilike.%${query}%,dosage_form.ilike.%${query}%`)
  if (drugClassId) q = q.eq('drug_class_id', drugClassId)
  const { data, error } = await q
  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}
