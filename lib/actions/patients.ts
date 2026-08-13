// lib/actions/patients.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export interface CreatePatientResult {
  error?: string
  duplicateWarning?: boolean
  existingPatient?: { id: string; fullName: string; patientCode: string }
}

export async function createPatient(formData: FormData): Promise<CreatePatientResult> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const fullName = (formData.get('full_name') as string)?.trim()
  const sex = formData.get('sex') as string
  const dateOfBirth = formData.get('date_of_birth') as string
  const estimatedAge = formData.get('estimated_age') as string
  const nationalIdNumber = (formData.get('national_id_number') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()
  const quartier = (formData.get('quartier') as string)?.trim()
  const city = (formData.get('city') as string)?.trim()
  const nextOfKinName = (formData.get('next_of_kin_name') as string)?.trim()
  const nextOfKinPhone = (formData.get('next_of_kin_phone') as string)?.trim()
  const allergies = (formData.get('allergies') as string)?.trim()
  const chronicConditions = (formData.get('chronic_conditions') as string)?.trim()
  // No longer hard-coded — the Insurance module now exists. Still
  // validated below (a non-cash category requires an actual insurer +
  // policy number, not just a label with no coverage data behind it).
  const paymentCategory = (formData.get('payment_category') as string) || 'cash'
  const insurerId = formData.get('insurer_id') as string
  const policyNumber = (formData.get('policy_number') as string)?.trim()
  const policyholderName = (formData.get('policyholder_name') as string)?.trim()

  if (paymentCategory !== 'cash' && (!insurerId || !policyNumber)) {
    return { error: staff.preferredLanguage === 'fr'
      ? 'Sélectionnez un assureur et indiquez le numéro de police pour une catégorie de paiement autre que comptant.'
      : 'Select an insurer and provide a policy number for a non-cash payment category.' }
  }

  if (!fullName) {
    return { error: staff.preferredLanguage === 'fr'
      ? 'Le nom complet est requis.'
      : 'Full name is required.' }
  }

  // Cameroon-specific reality, per the schema design: a patient may know
  // neither field precisely, but should have at least one indication of
  // age — not enforced as a hard DB constraint, but worth catching here
  // with a clear message rather than silently saving an ageless record.
  if (!dateOfBirth && !estimatedAge) {
    return { error: staff.preferredLanguage === 'fr'
      ? 'Indiquez soit la date de naissance, soit un âge estimé.'
      : 'Provide either a date of birth or an estimated age.' }
  }

  const confirmDuplicate = formData.get('confirm_duplicate') === 'true'

  // CNI duplicate detection — now race-safe. Previously this was a
  // plain SELECT-then-INSERT here in application code: two
  // near-simultaneous submissions for the same new national ID could
  // both pass the check before either insert landed, creating two real
  // patient records for the same person. register_patient_with_duplicate_check
  // does the check AND the insert inside one transaction, serialized by
  // an advisory lock scoped to (clinic_id, national_id_number) — closing
  // that race while leaving the deliberate "create anyway" path (still
  // just confirm_duplicate=true, a separate call, never a race) fully
  // intact.
  const { data: rpcRows, error: rpcError } = await supabase.rpc('register_patient_with_duplicate_check', {
    p_clinic_id: staff.clinicId,
    p_full_name: fullName,
    p_sex: sex || null,
    p_date_of_birth: dateOfBirth || null,
    p_estimated_age: estimatedAge ? parseInt(estimatedAge, 10) : null,
    p_national_id_number: nationalIdNumber || null,
    p_phone: phone || null,
    p_quartier: quartier || null,
    p_city: city || null,
    p_next_of_kin_name: nextOfKinName || null,
    p_next_of_kin_phone: nextOfKinPhone || null,
    p_allergies: allergies || null,
    p_chronic_conditions: chronicConditions || null,
    p_payment_category: paymentCategory || 'cash',
    p_created_by: staff.staffId,
    p_confirm_duplicate: confirmDuplicate,
  })

  if (rpcError) {
    console.error('register_patient_with_duplicate_check failed:', rpcError)
    return { error: staff.preferredLanguage === 'fr'
      ? 'Impossible d\'enregistrer le patient. Réessayez.'
      : 'Could not save the patient. Please try again.' }
  }

  const result = rpcRows?.[0]

  if (result?.duplicate_found) {
    return {
      duplicateWarning: true,
      existingPatient: { id: result.existing_patient_id, fullName: result.existing_full_name, patientCode: result.existing_patient_code },
      error: staff.preferredLanguage === 'fr'
        ? `Un patient avec ce numéro CNI existe déjà : ${result.existing_full_name} (${result.existing_patient_code}). Confirmez pour créer quand même, ou ouvrez le dossier existant.`
        : `A patient with this national ID already exists: ${result.existing_full_name} (${result.existing_patient_code}). Confirm to create anyway, or open the existing record.`,
    }
  }

  if (!result?.new_patient_id) {
    return { error: staff.preferredLanguage === 'fr'
      ? 'Impossible d\'enregistrer le patient. Réessayez.'
      : 'Could not save the patient. Please try again.' }
  }

  if (paymentCategory !== 'cash' && insurerId && policyNumber) {
    const { error: insuranceError } = await supabase.from('patient_insurance').insert({
      clinic_id: staff.clinicId,
      patient_id: result.new_patient_id,
      insurer_id: insurerId,
      policy_number: policyNumber,
      policyholder_name: policyholderName || null,
      created_by: staff.staffId,
    })
    // Not blocking registration on this failing — the patient record
    // itself is already saved. Worth surfacing, but a receptionist
    // shouldn't lose the whole registration over a coverage-detail
    // hiccup; insurance can be added from Patient Account afterward.
    if (insuranceError) {
      console.error('patient_insurance insert failed:', insuranceError)
    }
  }

  // After registration, go straight to the appointments/reception screen
  // with the new patient pre-selected for scheduling — the nurse or
  // receptionist can immediately book or walk the patient in from there.
  redirect(`/reception?tab=appointments&new_patient=${result.new_patient_id}`)
}

export async function updatePatient(patientId: string, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const lang = staff.preferredLanguage

  if (!patientId) return { error: lang === 'fr' ? 'Patient introuvable.' : 'Patient not found.' }

  const fullName = (formData.get('full_name') as string)?.trim()
  const sex = (formData.get('sex') as string) || null
  const dateOfBirth = (formData.get('date_of_birth') as string)?.trim() || null
  const estimatedAgeRaw = (formData.get('estimated_age') as string)?.trim() || ''
  const estimatedAge = estimatedAgeRaw ? Number.parseInt(estimatedAgeRaw, 10) : null
  const nationalIdNumber = (formData.get('national_id_number') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const quartier = (formData.get('quartier') as string)?.trim() || null
  const city = (formData.get('city') as string)?.trim() || null
  const nextOfKinName = (formData.get('next_of_kin_name') as string)?.trim() || null
  const nextOfKinPhone = (formData.get('next_of_kin_phone') as string)?.trim() || null
  const allergies = (formData.get('allergies') as string)?.trim() || null
  const chronicConditions = (formData.get('chronic_conditions') as string)?.trim() || null
  const paymentCategory = (formData.get('payment_category') as string) || 'cash'

  if (!fullName) return { error: lang === 'fr' ? 'Le nom complet est requis.' : 'Full name is required.' }
  if (!dateOfBirth && (estimatedAge === null || Number.isNaN(estimatedAge))) {
    return { error: lang === 'fr' ? 'Indiquez la date de naissance ou un âge estimé.' : 'Provide a date of birth or an estimated age.' }
  }
  if (dateOfBirth && estimatedAgeRaw) {
    return { error: lang === 'fr' ? 'Utilisez soit la date de naissance, soit l’âge estimé, pas les deux.' : 'Use either date of birth or estimated age, not both.' }
  }
  if (estimatedAge !== null && (Number.isNaN(estimatedAge) || estimatedAge < 0 || estimatedAge > 130)) {
    return { error: lang === 'fr' ? 'Âge estimé invalide.' : 'Invalid estimated age.' }
  }

  if (nationalIdNumber) {
    const { data: duplicate } = await supabase
      .from('patients')
      .select('id, full_name, patient_code')
      .eq('clinic_id', staff.clinicId)
      .eq('national_id_number', nationalIdNumber)
      .neq('id', patientId)
      .maybeSingle()
    if (duplicate) {
      return { error: lang === 'fr'
        ? `Ce numéro CNI est déjà utilisé par ${duplicate.full_name} (${duplicate.patient_code}).`
        : `This national ID is already used by ${duplicate.full_name} (${duplicate.patient_code}).` }
    }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('clinic_id', staff.clinicId)
    .maybeSingle()
  if (fetchError || !existing) return { error: lang === 'fr' ? 'Patient introuvable dans cette clinique.' : 'Patient not found in this clinic.' }

  const { data: updated, error } = await supabase
    .from('patients')
    .update({
      full_name: fullName,
      sex,
      date_of_birth: dateOfBirth,
      estimated_age: dateOfBirth ? null : estimatedAge,
      estimated_age_recorded_at: dateOfBirth ? null : (estimatedAge !== null ? new Date().toISOString() : null),
      national_id_number: nationalIdNumber,
      phone,
      quartier,
      city,
      next_of_kin_name: nextOfKinName,
      next_of_kin_phone: nextOfKinPhone,
      allergies,
      chronic_conditions: chronicConditions,
      payment_category: paymentCategory,
    })
    .eq('id', patientId)
    .eq('clinic_id', staff.clinicId)
    .select('id')
    .maybeSingle()

  if (error || !updated) {
    console.error('updatePatient failed:', error)
    return { error: lang === 'fr' ? 'Impossible de mettre à jour le patient. Vérifiez vos droits et réessayez.' : 'Could not update the patient. Check your permissions and try again.' }
  }

  await supabase.from('audit_log').insert({
    clinic_id: staff.clinicId,
    staff_id: staff.staffId,
    action: 'patient.updated',
    entity_type: 'patient',
    entity_id: patientId,
    details: { changed_fields: ['full_name', 'sex', 'date_of_birth', 'estimated_age', 'national_id_number', 'phone', 'quartier', 'city', 'next_of_kin_name', 'next_of_kin_phone', 'allergies', 'chronic_conditions', 'payment_category'] },
  })

  revalidatePath(`/patients/${patientId}`)
  revalidatePath('/patients')
  return { success: true }
}
