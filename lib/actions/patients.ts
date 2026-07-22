// lib/actions/patients.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { redirect } from 'next/navigation'

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

  // CNI duplicate detection. Advisory, not a hard block — the same CNI
  // number can legitimately appear across family members sharing a card,
  // a card can be reused, or the field can simply be wrong. The caller
  // can pass confirm_duplicate=true to proceed past the warning after
  // seeing the existing match.
  const confirmDuplicate = formData.get('confirm_duplicate') === 'true'
  if (nationalIdNumber && !confirmDuplicate) {
    const { data: existing } = await supabase
      .from('patients')
      .select('id, full_name, patient_code')
      .eq('clinic_id', staff.clinicId)
      .eq('national_id_number', nationalIdNumber)
      .limit(1)
      .maybeSingle()
    if (existing) {
      return {
        duplicateWarning: true,
        existingPatient: { id: existing.id, fullName: existing.full_name, patientCode: existing.patient_code },
        error: staff.preferredLanguage === 'fr'
          ? `Un patient avec ce numéro CNI existe déjà : ${existing.full_name} (${existing.patient_code}). Confirmez pour créer quand même, ou ouvrez le dossier existant.`
          : `A patient with this national ID already exists: ${existing.full_name} (${existing.patient_code}). Confirm to create anyway, or open the existing record.`,
      }
    }
  }

  const { data, error } = await supabase
    .from('patients')
    .insert({
      clinic_id: staff.clinicId,
      full_name: fullName,
      sex: sex || null,
      date_of_birth: dateOfBirth || null,
      estimated_age: estimatedAge ? parseInt(estimatedAge, 10) : null,
      national_id_number: nationalIdNumber || null,
      phone: phone || null,
      quartier: quartier || null,
      city: city || null,
      next_of_kin_name: nextOfKinName || null,
      next_of_kin_phone: nextOfKinPhone || null,
      allergies: allergies || null,
      chronic_conditions: chronicConditions || null,
      payment_category: paymentCategory || 'cash',
      created_by: staff.staffId,
    })
    .select('id, patient_code')
    .single()

  if (error) {
    // RLS denial or a real DB error both land here. Not distinguishing
    // between them in the message — a receptionist doesn't need to know
    // it was RLS specifically, just that the save didn't go through.
    return { error: staff.preferredLanguage === 'fr'
      ? 'Impossible d\'enregistrer le patient. Réessayez.'
      : 'Could not save the patient. Please try again.' }
  }

  if (paymentCategory !== 'cash' && insurerId && policyNumber) {
    const { error: insuranceError } = await supabase.from('patient_insurance').insert({
      clinic_id: staff.clinicId,
      patient_id: data.id,
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
  redirect(`/reception?tab=appointments&new_patient=${data.id}`)
}
