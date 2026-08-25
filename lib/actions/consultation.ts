// lib/actions/consultation.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { redirect } from 'next/navigation'

export interface CompleteConsultationResult {
  error?: string
  alreadyCompleted?: boolean
}

interface ConsultationDiagnosisInput {
  diagnosis: string
  icd10Code: string | null
  isPrimary: boolean
  sequence: number
}

function parseDiagnoses(formData: FormData): ConsultationDiagnosisInput[] {
  const raw = formData.get('diagnoses_json')
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .map((d: any, index: number) => ({
            diagnosis: typeof d?.diagnosis === 'string' ? d.diagnosis.trim() : '',
            icd10Code: typeof d?.icd10Code === 'string' && d.icd10Code.trim() ? d.icd10Code.trim() : null,
            isPrimary: Boolean(d?.isPrimary),
            sequence: Number.isInteger(d?.sequence) && d.sequence > 0 ? d.sequence : index + 1,
          }))
          .filter((d) => d.diagnosis.length > 0)
      }
    } catch {
      // Fall through to the legacy single-diagnosis fields.
    }
  }

  const diagnosis = (formData.get('diagnosis') as string)?.trim()
  const diagnosisCode = (formData.get('diagnosis_code') as string)?.trim()
  return diagnosis
    ? [{ diagnosis, icd10Code: diagnosisCode || null, isPrimary: true, sequence: 1 }]
    : []
}

export async function completeConsultation(
  visitId: string,
  consultationId: string,
  formData: FormData
): Promise<CompleteConsultationResult> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data: currentVisit } = await supabase
    .from('visits')
    .select('status, patient_id')
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
  const diagnoses = parseDiagnoses(formData)
  const treatmentPlan = (formData.get('treatment_plan') as string)?.trim()
  const followupDate = (formData.get('followup_date') as string)?.trim() || null
  const followupTime = (formData.get('followup_time') as string)?.trim() || null
  const followupReason = (formData.get('followup_reason') as string)?.trim() || null

  if (diagnoses.length > 0) {
    const primaryCount = diagnoses.filter((d) => d.isPrimary).length
    if (primaryCount === 0) diagnoses[0].isPrimary = true
    if (primaryCount > 1) {
      let primarySeen = false
      for (const diagnosis of diagnoses) {
        if (diagnosis.isPrimary && !primarySeen) primarySeen = true
        else diagnosis.isPrimary = false
      }
    }
    diagnoses.forEach((d, index) => { d.sequence = index + 1 })
  }

  const { error: consultationSaveError } = await supabase.rpc('save_consultation_diagnoses', {
    p_clinic_id: staff.clinicId,
    p_consultation_id: consultationId,
    p_staff_id: staff.staffId,
    p_subjective_notes: subjectiveNotes || null,
    p_examination_notes: examinationNotes || null,
    p_treatment_plan: treatmentPlan || null,
    p_diagnoses: diagnoses,
  })

  if (consultationSaveError) {
    return { error: `Impossible d'enregistrer la consultation : ${consultationSaveError.message}` }
  }

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
      .insert({ clinic_id: staff.clinicId, visit_id: visitId, consultation_id: consultationId, doctor_id: staff.staffId })
      .select('id')
      .single()

    if (prescriptionError || !prescription) return { error: 'Impossible de créer l\'ordonnance. Réessayez.' }

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
    if (itemsError) return { error: 'Ordonnance créée, mais certains médicaments n\'ont pas pu être ajoutés. Vérifiez avant de continuer.' }
  }

  const panelIds = formData.getAll('lab_panel_ids') as string[]
  const testIds = formData.getAll('lab_test_ids') as string[]
  const externalNames = formData.getAll('lab_external_names') as string[]
  const labItems = [
    ...panelIds.map((id) => ({ type: 'panel', panel_id: id })),
    ...testIds.map((id) => ({ type: 'individual_test', catalog_id: id })),
    ...externalNames.map((name) => ({ type: 'external', name })),
  ]
  const hasAnyLabItems = labItems.length > 0
  const hasInHouseLabOrder = panelIds.length > 0 || testIds.length > 0

  if (hasAnyLabItems) {
    const { data: orderResult, error: orderError } = await supabase.rpc('create_lab_order', {
      p_clinic_id: staff.clinicId,
      p_visit_id: visitId,
      p_ordered_by: staff.staffId,
      p_items: labItems,
    })
    if (orderError || !orderResult?.[0]) return { error: `Impossible de créer la demande d'examen : ${orderError?.message ?? 'erreur inconnue'}` }

    const chargeIds = orderResult[0].service_charge_ids as string[]
    if (chargeIds && chargeIds.length > 0) {
      const { error: invoiceError } = await supabase.rpc('open_invoice_for_charges', {
        p_service_charge_ids: chargeIds,
        p_created_by: staff.staffId,
      })
      if (invoiceError) return { error: 'Examens commandés, mais la facture n\'a pas pu être créée. Contactez un administrateur.' }
    }
  }

  const procedureIds = formData.getAll('procedure_ids') as string[]
  if (procedureIds.length > 0 && currentVisit.patient_id) {
    for (const procedureId of procedureIds) {
      const { error: procedureError } = await supabase.rpc('add_consultation_procedure_charge', {
        p_clinic_id: staff.clinicId,
        p_patient_id: currentVisit.patient_id,
        p_visit_id: visitId,
        p_service_price_id: procedureId,
        p_created_by: staff.staffId,
      })
      if (procedureError) return { error: `Impossible d'ajouter une procédure à la facture : ${procedureError.message}` }
    }
  }

  const admitPatient = formData.get('admit_patient') === 'true'
  const admissionReason = (formData.get('admission_reason') as string)?.trim()
  if (admitPatient) {
    if (!admissionReason) return { error: 'Un motif d\'admission est requis.' }
    const { error: admissionError } = await supabase.rpc('recommend_admission', {
      p_clinic_id: staff.clinicId,
      p_visit_id: visitId,
      p_recommended_by: staff.staffId,
      p_admission_reason: admissionReason,
    })
    if (admissionError) return { error: `Impossible de recommander l'admission : ${admissionError.message}` }
  }

  const { error: completeError } = await supabase.rpc('complete_consultation', {
    p_visit_id: visitId,
    p_consultation_id: consultationId,
    p_staff_id: staff.staffId,
    p_has_prescription: hasPrescription,
    p_has_lab_order: hasInHouseLabOrder,
    p_has_admission: admitPatient,
  })
  if (completeError) return { error: `Impossible de terminer la consultation : ${completeError.message}` }

  // Follow-up creation happens only after the consultation has successfully
  // completed. The database RPC verifies that this consultation is complete,
  // belongs to this patient/clinic, and is owned by the clinician. No fee or
  // discount is accepted from the browser.
  if (followupDate || followupTime) {
    if (!followupDate || !followupTime) {
      return { error: 'La date et l\'heure du suivi doivent être renseignées ensemble.' }
    }

    const { error: followupError } = await supabase.rpc('schedule_followup_from_consultation', {
      p_visit_id: visitId,
      p_consultation_id: consultationId,
      p_doctor_id: staff.staffId,
      p_followup_date: followupDate,
      p_followup_time: followupTime,
      p_reason: followupReason,
    })

    if (followupError) {
      return { error: `Consultation terminée, mais le rendez-vous de suivi n'a pas pu être créé : ${followupError.message}` }
    }
  }

  redirect('/dashboard')
}
