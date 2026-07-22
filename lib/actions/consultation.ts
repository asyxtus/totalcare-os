// lib/actions/consultation.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { redirect } from 'next/navigation'

export interface CompleteConsultationResult {
  error?: string
  alreadyCompleted?: boolean
}

export async function completeConsultation(
  visitId: string,
  consultationId: string,
  formData: FormData
): Promise<CompleteConsultationResult> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  // THE ACTUAL FIX: check the visit hasn't already moved past
  // 'in_consultation' BEFORE doing any writes. If a previous submission
  // (or an overlapping duplicate click) already completed this visit,
  // refuse immediately rather than re-creating the prescription and lab
  // order a second time. This is what closes the gap that let 5 lab
  // orders get created from repeated clicks on one button.
  const { data: currentVisit } = await supabase
    .from('visits')
    .select('status')
    .eq('id', visitId)
    .single()

  if (currentVisit?.status !== 'in_consultation') {
    return {
      error: 'Cette consultation a déjà été terminée — aucune action supplémentaire nécessaire.',
      alreadyCompleted: true,
    }
  }

  const subjectiveNotes = (formData.get('subjective_notes') as string)?.trim()
  const examinationNotes = (formData.get('examination_notes') as string)?.trim()
  const diagnosis = (formData.get('diagnosis') as string)?.trim()
  const diagnosisCode = (formData.get('diagnosis_code') as string)?.trim()
  const treatmentPlan = (formData.get('treatment_plan') as string)?.trim()

  const { error: consultationError } = await supabase
    .from('consultations')
    .update({
      subjective_notes: subjectiveNotes || null,
      examination_notes: examinationNotes || null,
      diagnosis: diagnosis || null,
      diagnosis_code: diagnosisCode || null,
      treatment_plan: treatmentPlan || null,
    })
    .eq('id', consultationId)

  if (consultationError) {
    return { error: 'Impossible d\'enregistrer la consultation. Réessayez.' }
  }

  // Prescription rows: each row is EITHER a catalog product (rx_product_id
  // set, rx_freetext_name empty) OR a free-text drug (the reverse) — the
  // form always submits both fields per row so getAll() arrays stay
  // aligned by index regardless of which mode a given row was in.
  const productIds = formData.getAll('rx_product_id') as string[]
  const freetextNames = formData.getAll('rx_freetext_name') as string[]
  const doses = formData.getAll('rx_dose') as string[]
  const frequencies = formData.getAll('rx_frequency') as string[]
  const durations = formData.getAll('rx_duration_days') as string[]
  const quantities = formData.getAll('rx_quantity') as string[]

  const validRows = productIds
    .map((productId, i) => ({
      productId: productId || null,
      freetextName: freetextNames[i] || null,
      dose: doses[i],
      frequency: frequencies[i],
      durationDays: durations[i],
      quantity: quantities[i],
    }))
    .filter((row) => (row.productId || row.freetextName) && row.quantity)

  const hasPrescription = validRows.length > 0

  if (hasPrescription) {
    const { data: prescription, error: prescriptionError } = await supabase
      .from('prescriptions')
      .insert({
        clinic_id: staff.clinicId,
        visit_id: visitId,
        consultation_id: consultationId,
        doctor_id: staff.staffId,
      })
      .select('id')
      .single()

    if (prescriptionError || !prescription) {
      return { error: 'Impossible de créer l\'ordonnance. Réessayez.' }
    }

    const items = validRows.map((row) => ({
      prescription_id: prescription.id,
      product_id: row.productId,
      drug_name_freetext: row.freetextName,
      dose: row.dose || null,
      frequency: row.frequency || null,
      duration_days: row.durationDays ? parseInt(row.durationDays, 10) : null,
      quantity_prescribed: parseInt(row.quantity, 10),
    }))

    const { error: itemsError } = await supabase.from('prescription_items').insert(items)

    if (itemsError) {
      return { error: 'Ordonnance créée, mais certains médicaments n\'ont pas pu être ajoutés. Vérifiez avant de continuer.' }
    }
  }

  // Lab ordering: panels and individual tests generate charges
  // automatically inside create_lab_order; external tests don't.
  const panelIds = formData.getAll('lab_panel_ids') as string[]
  const testIds = formData.getAll('lab_test_ids') as string[]
  const externalNames = formData.getAll('lab_external_names') as string[]

  const labItems = [
    ...panelIds.map((id) => ({ type: 'panel', panel_id: id })),
    ...testIds.map((id) => ({ type: 'individual_test', catalog_id: id })),
    ...externalNames.map((name) => ({ type: 'external', name })),
  ]

  // hasAnyLabItems: was anything ordered at all (controls whether
  // create_lab_order runs, since external-only orders still need to be
  // recorded even though they don't affect visit routing).
  const hasAnyLabItems = labItems.length > 0
  // hasInHouseLabOrder: routes the visit to waiting_lab. Must mean "has
  // an IN-HOUSE item to track" — an external-only order has nothing we
  // ever complete, so routing to waiting_lab for that case would strand
  // the visit there permanently.
  const hasInHouseLabOrder = panelIds.length > 0 || testIds.length > 0

  if (hasAnyLabItems) {
    const { data: orderResult, error: orderError } = await supabase.rpc('create_lab_order', {
      p_clinic_id: staff.clinicId,
      p_visit_id: visitId,
      p_ordered_by: staff.staffId,
      p_items: labItems,
    })

    if (orderError || !orderResult?.[0]) {
      return { error: `Impossible de créer la demande d'examen : ${orderError?.message ?? 'erreur inconnue'}` }
    }

    const chargeIds = orderResult[0].service_charge_ids as string[]
    if (chargeIds && chargeIds.length > 0) {
      const { error: invoiceError } = await supabase.rpc('open_invoice_for_charges', {
        p_service_charge_ids: chargeIds,
        p_created_by: staff.staffId,
      })
      if (invoiceError) {
        return { error: 'Examens commandés, mais la facture n\'a pas pu être créée. Contactez un administrateur.' }
      }
    }
  }

  // Admission: recommend_admission() must run BEFORE complete_consultation,
  // since it's the one that actually sets visit.status = 'admitted' —
  // complete_consultation just needs to know NOT to overwrite that with
  // its own lab/pharmacy/discharge routing.
  const admitPatient = formData.get('admit_patient') === 'true'
  const admissionReason = (formData.get('admission_reason') as string)?.trim()

  if (admitPatient) {
    if (!admissionReason) {
      return { error: 'Un motif d\'admission est requis.' }
    }
    const { error: admissionError } = await supabase.rpc('recommend_admission', {
      p_clinic_id: staff.clinicId,
      p_visit_id: visitId,
      p_recommended_by: staff.staffId,
      p_admission_reason: admissionReason,
    })
    if (admissionError) {
      return { error: `Impossible de recommander l'admission : ${admissionError.message}` }
    }
  }

  const { error: completeError } = await supabase.rpc('complete_consultation', {
    p_visit_id: visitId,
    p_consultation_id: consultationId,
    p_staff_id: staff.staffId,
    p_has_prescription: hasPrescription,
    p_has_lab_order: hasInHouseLabOrder,
    p_has_admission: admitPatient,
  })

  if (completeError) {
    return { error: `Impossible de terminer la consultation : ${completeError.message}` }
  }

  redirect('/dashboard')
}
