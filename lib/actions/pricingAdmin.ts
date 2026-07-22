// lib/actions/pricingAdmin.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

async function requireAdmin() {
  const staff = await getCurrentStaff()
  if (staff.role !== 'admin') throw new Error('Admin access required.')
  return staff
}

const toNum = (v: FormDataEntryValue | null) => {
  const n = parseFloat((v as string) ?? '')
  return Number.isFinite(n) ? n : null
}
const toList = (v: FormDataEntryValue | null) =>
  ((v as string) ?? '').split(',').map((s) => s.trim()).filter(Boolean)

// ─────────────────────────────────────────────────────────────
// SERVICES (service_prices) — clinic-scoped, no shared-catalog concern.
// ─────────────────────────────────────────────────────────────

export async function createServicePriceAction(formData: FormData) {
  let admin
  try { admin = await requireAdmin() } catch { return { error: 'Réservé aux administrateurs.' } }

  const serviceName = (formData.get('service_name') as string)?.trim()
  const category = (formData.get('category') as string)?.trim()
  const price = toNum(formData.get('price_xaf'))
  const serviceCode = (formData.get('service_code') as string)?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')

  if (!serviceName) return { error: 'Le nom du service est requis.' }
  if (!category) return { error: 'La catégorie est requise.' }
  if (price === null || price < 0) return { error: 'Un prix valide est requis.' }
  if (!serviceCode) return { error: 'Le code du service est requis.' }

  const adminClient = createAdminClient()
  const { data: created, error } = await adminClient.from('service_prices').insert({
    clinic_id: admin.clinicId, service_name: serviceName, category, price_xaf: price,
    service_code: serviceCode, is_active: true,
  }).select('id').maybeSingle()
  if (error) {
    if (error.code === '23505') {
      return { error: `Le code "${serviceCode}" est déjà utilisé par un autre service. Choisissez-en un différent.` }
    }
    return friendlyError('createServicePrice', 'Impossible de créer ce tarif.', error)
  }

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'pricing.service_created',
    entity_type: 'service_price', entity_id: created?.id ?? null,
    details: { service_name: serviceName, service_code: serviceCode, category, price_xaf: price },
  })

  revalidatePath('/admin')
  return { success: true }
}

export async function updateServicePriceAction(id: string, formData: FormData) {
  let admin
  try { admin = await requireAdmin() } catch { return { error: 'Réservé aux administrateurs.' } }

  const price = toNum(formData.get('price_xaf'))
  if (price === null || price < 0) return { error: 'Un prix valide est requis.' }

  const adminClient = createAdminClient()
  const { data: existing } = await adminClient.from('service_prices').select('service_name, price_xaf').eq('id', id).maybeSingle()

  const { error } = await adminClient.from('service_prices').update({ price_xaf: price }).eq('id', id)
  if (error) return friendlyError('updateServicePrice', 'Impossible de mettre à jour ce tarif.', error)

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'pricing.service_price_updated',
    entity_type: 'service_price', entity_id: id,
    details: { service_name: existing?.service_name ?? null, old_price_xaf: existing?.price_xaf ?? null, new_price_xaf: price },
  })

  revalidatePath('/admin')
  return { success: true }
}

export async function toggleServicePriceActiveAction(id: string, makeActive: boolean) {
  let admin
  try { admin = await requireAdmin() } catch { return { error: 'Réservé aux administrateurs.' } }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('service_prices').update({ is_active: makeActive }).eq('id', id)
  if (error) return friendlyError('toggleServicePriceActive', 'Impossible de mettre à jour ce tarif.', error)

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId,
    action: makeActive ? 'pricing.service_reactivated' : 'pricing.service_deactivated',
    entity_type: 'service_price', entity_id: id, details: {},
  })

  revalidatePath('/admin')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// LAB TESTS — lab_test_catalog is platform-wide; clinic_lab_tests is
// this clinic's activation + price on top of it. Creating a brand-new
// test writes to the shared catalog table, then immediately activates
// and prices it for this clinic. If the second write fails, the first
// is rolled back so a half-created test can't sit invisible in the
// catalog with no price attached to anything.
// ─────────────────────────────────────────────────────────────

export async function createLabTestAction(formData: FormData) {
  let admin
  try { admin = await requireAdmin() } catch { return { error: 'Réservé aux administrateurs.' } }

  const nameFr = (formData.get('name_fr') as string)?.trim()
  const nameEn = ((formData.get('name_en') as string)?.trim()) || nameFr
  const category = (formData.get('category') as string)?.trim()
  const specimenType = (formData.get('specimen_type') as string)?.trim() || null
  const unit = (formData.get('unit') as string)?.trim() || null
  const resultType = formData.get('result_type') as string
  const price = toNum(formData.get('price_xaf'))

  if (!nameFr) return { error: 'Le nom du test est requis.' }
  if (!category) return { error: 'La catégorie est requise.' }
  if (resultType !== 'numeric' && resultType !== 'qualitative') return { error: 'Type de résultat invalide.' }
  if (price === null || price < 0) return { error: 'Un prix valide est requis.' }

  const catalogRow: Record<string, unknown> = {
    clinic_id: admin.clinicId,
    name_fr: nameFr, name_en: nameEn, category, specimen_type: specimenType, unit, result_type: resultType,
  }

  if (resultType === 'numeric') {
    catalogRow.reference_range_low = toNum(formData.get('reference_range_low'))
    catalogRow.reference_range_high = toNum(formData.get('reference_range_high'))
    catalogRow.critical_low = toNum(formData.get('critical_low'))
    catalogRow.critical_high = toNum(formData.get('critical_high'))
  } else {
    const options = toList(formData.get('qualitative_options'))
    const abnormal = toList(formData.get('abnormal_qualitative_values'))
    if (options.length === 0) return { error: 'Indiquez au moins une valeur possible (ex: Positif, Négatif).' }
    catalogRow.qualitative_options = options
    catalogRow.abnormal_qualitative_values = abnormal.length > 0 ? abnormal : null
  }

  const adminClient = createAdminClient()
  const { data: catalogInserted, error: catalogError } = await adminClient
    .from('lab_test_catalog').insert(catalogRow).select('id').maybeSingle()

  if (catalogError || !catalogInserted) {
    return friendlyError('createLabTest (catalog)', 'Impossible de créer ce test.', catalogError)
  }

  const { error: clinicError } = await adminClient.from('clinic_lab_tests').insert({
    clinic_id: admin.clinicId, lab_test_catalog_id: catalogInserted.id, price_xaf: price, is_active: true,
  })

  if (clinicError) {
    await adminClient.from('lab_test_catalog').delete().eq('id', catalogInserted.id)
    return friendlyError('createLabTest (clinic price)', "Impossible d'activer ce test pour la clinique — annulé.", clinicError)
  }

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'pricing.lab_test_created',
    entity_type: 'lab_test_catalog', entity_id: catalogInserted.id,
    details: { name_fr: nameFr, category, result_type: resultType, price_xaf: price },
  })

  revalidatePath('/admin')
  return { success: true }
}

export async function updateClinicLabTestAction(id: string, formData: FormData) {
  let admin
  try { admin = await requireAdmin() } catch { return { error: 'Réservé aux administrateurs.' } }

  const price = toNum(formData.get('price_xaf'))
  if (price === null || price < 0) return { error: 'Un prix valide est requis.' }

  const adminClient = createAdminClient()
  const { data: existing } = await adminClient
    .from('clinic_lab_tests').select('price_xaf, lab_test_catalog(name_fr)').eq('id', id).maybeSingle()

  const { error } = await adminClient.from('clinic_lab_tests').update({ price_xaf: price }).eq('id', id)
  if (error) return friendlyError('updateClinicLabTest', 'Impossible de mettre à jour ce tarif.', error)

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'pricing.lab_test_price_updated',
    entity_type: 'clinic_lab_test', entity_id: id,
    details: { test_name: (existing as any)?.lab_test_catalog?.name_fr ?? null, old_price_xaf: existing?.price_xaf ?? null, new_price_xaf: price },
  })

  revalidatePath('/admin')
  return { success: true }
}

export async function toggleClinicLabTestActiveAction(id: string, makeActive: boolean) {
  let admin
  try { admin = await requireAdmin() } catch { return { error: 'Réservé aux administrateurs.' } }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('clinic_lab_tests').update({ is_active: makeActive }).eq('id', id)
  if (error) return friendlyError('toggleClinicLabTestActive', 'Impossible de mettre à jour ce test.', error)

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId,
    action: makeActive ? 'pricing.lab_test_reactivated' : 'pricing.lab_test_deactivated',
    entity_type: 'clinic_lab_test', entity_id: id, details: {},
  })

  revalidatePath('/admin')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// LAB PANELS — same shared-catalog-then-clinic-price shape as tests,
// plus a join table linking the new panel to existing catalog tests.
// ─────────────────────────────────────────────────────────────

export async function createLabPanelAction(formData: FormData) {
  let admin
  try { admin = await requireAdmin() } catch { return { error: 'Réservé aux administrateurs.' } }

  const nameFr = (formData.get('name_fr') as string)?.trim()
  const nameEn = ((formData.get('name_en') as string)?.trim()) || nameFr
  const category = (formData.get('category') as string)?.trim()
  const price = toNum(formData.get('price_xaf'))
  const testIds = formData.getAll('test_ids') as string[]

  if (!nameFr) return { error: 'Le nom du bilan est requis.' }
  if (!category) return { error: 'La catégorie est requise.' }
  if (price === null || price < 0) return { error: 'Un prix valide est requis.' }
  if (testIds.length === 0) return { error: 'Sélectionnez au moins un test pour ce bilan.' }

  const adminClient = createAdminClient()
  const { data: panelInserted, error: panelError } = await adminClient
    .from('lab_panels').insert({ clinic_id: admin.clinicId, name_fr: nameFr, name_en: nameEn, category }).select('id').maybeSingle()

  if (panelError || !panelInserted) {
    return friendlyError('createLabPanel (panel)', 'Impossible de créer ce bilan.', panelError)
  }

  const { error: itemsError } = await adminClient.from('lab_panel_items').insert(
    testIds.map((testId) => ({ panel_id: panelInserted.id, lab_test_catalog_id: testId }))
  )

  if (itemsError) {
    await adminClient.from('lab_panels').delete().eq('id', panelInserted.id)
    return friendlyError('createLabPanel (items)', 'Impossible de lier les tests à ce bilan — annulé.', itemsError)
  }

  const { error: clinicError } = await adminClient.from('clinic_lab_panels').insert({
    clinic_id: admin.clinicId, lab_panel_id: panelInserted.id, price_xaf: price, is_active: true,
  })

  if (clinicError) {
    await adminClient.from('lab_panels').delete().eq('id', panelInserted.id) // cascades lab_panel_items
    return friendlyError('createLabPanel (clinic price)', "Impossible d'activer ce bilan pour la clinique — annulé.", clinicError)
  }

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'pricing.lab_panel_created',
    entity_type: 'lab_panel', entity_id: panelInserted.id,
    details: { name_fr: nameFr, category, price_xaf: price, test_count: testIds.length },
  })

  revalidatePath('/admin')
  return { success: true }
}

export async function updateClinicLabPanelAction(id: string, formData: FormData) {
  let admin
  try { admin = await requireAdmin() } catch { return { error: 'Réservé aux administrateurs.' } }

  const price = toNum(formData.get('price_xaf'))
  if (price === null || price < 0) return { error: 'Un prix valide est requis.' }

  const adminClient = createAdminClient()
  const { data: existing } = await adminClient
    .from('clinic_lab_panels').select('price_xaf, lab_panels(name_fr)').eq('id', id).maybeSingle()

  const { error } = await adminClient.from('clinic_lab_panels').update({ price_xaf: price }).eq('id', id)
  if (error) return friendlyError('updateClinicLabPanel', 'Impossible de mettre à jour ce tarif.', error)

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'pricing.lab_panel_price_updated',
    entity_type: 'clinic_lab_panel', entity_id: id,
    details: { panel_name: (existing as any)?.lab_panels?.name_fr ?? null, old_price_xaf: existing?.price_xaf ?? null, new_price_xaf: price },
  })

  revalidatePath('/admin')
  return { success: true }
}

export async function toggleClinicLabPanelActiveAction(id: string, makeActive: boolean) {
  let admin
  try { admin = await requireAdmin() } catch { return { error: 'Réservé aux administrateurs.' } }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('clinic_lab_panels').update({ is_active: makeActive }).eq('id', id)
  if (error) return friendlyError('toggleClinicLabPanelActive', 'Impossible de mettre à jour ce bilan.', error)

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId,
    action: makeActive ? 'pricing.lab_panel_reactivated' : 'pricing.lab_panel_deactivated',
    entity_type: 'clinic_lab_panel', entity_id: id, details: {},
  })

  revalidatePath('/admin')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// INPATIENT — ward daily rate + clinic-wide nursing per-diem. Both feed
// accrue_nightly_inpatient_charges() (95/96 migrations), which posts a
// room + nursing charge every night a patient stays admitted. These are
// real, human-initiated rate changes, so — unlike the routine pricing
// edits above — they're written to audit_log too, following the exact
// pattern already used throughout the clinical schema (see
// discharge_patient(), complete_triage(), etc.).
// ─────────────────────────────────────────────────────────────

export async function updateWardRateAction(wardId: string, formData: FormData) {
  let admin
  try { admin = await requireAdmin() } catch { return { error: 'Réservé aux administrateurs.' } }

  const price = toNum(formData.get('daily_rate_xaf'))
  if (price === null || price < 0) return { error: 'Un tarif valide est requis.' }

  const adminClient = createAdminClient()
  const { data: ward } = await adminClient.from('wards').select('id, name, daily_rate_xaf, clinic_id').eq('id', wardId).maybeSingle()
  if (!ward || ward.clinic_id !== admin.clinicId) return { error: 'Service introuvable.' }

  const { error } = await adminClient.from('wards').update({ daily_rate_xaf: price }).eq('id', wardId)
  if (error) return friendlyError('updateWardRate', 'Impossible de mettre à jour ce tarif.', error)

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'ward.rate_updated',
    entity_type: 'ward', entity_id: wardId,
    details: { ward_name: ward.name, old_rate_xaf: ward.daily_rate_xaf, new_rate_xaf: price },
  })

  revalidatePath('/admin')
  return { success: true }
}

export async function updateNursingRateAction(formData: FormData) {
  let admin
  try { admin = await requireAdmin() } catch { return { error: 'Réservé aux administrateurs.' } }

  const price = toNum(formData.get('nursing_daily_rate_xaf'))
  if (price === null || price < 0) return { error: 'Un tarif valide est requis.' }

  const adminClient = createAdminClient()
  const { data: clinic } = await adminClient.from('clinics').select('id, nursing_daily_rate_xaf').eq('id', admin.clinicId).maybeSingle()

  const { error } = await adminClient.from('clinics').update({ nursing_daily_rate_xaf: price }).eq('id', admin.clinicId)
  if (error) return friendlyError('updateNursingRate', 'Impossible de mettre à jour ce tarif.', error)

  await adminClient.from('audit_log').insert({
    clinic_id: admin.clinicId, staff_id: admin.staffId, action: 'clinic.nursing_rate_updated',
    entity_type: 'clinic', entity_id: admin.clinicId,
    details: { old_rate_xaf: clinic?.nursing_daily_rate_xaf ?? null, new_rate_xaf: price },
  })

  revalidatePath('/admin')
  return { success: true }
}
