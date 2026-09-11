'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export interface OfflinePatientRegistrationPayload {
  full_name: string
  sex: string
  date_of_birth: string
  estimated_age: string
  national_id_number: string
  phone: string
  quartier: string
  city: string
  next_of_kin_name: string
  next_of_kin_phone: string
  allergies: string
  chronic_conditions: string
  payment_category: string
  insurer_id: string
  policy_number: string
  policyholder_name: string
  confirm_duplicate?: boolean
  client_operation_id?: string
}

export interface OfflinePatientRegistrationResult {
  error?: string
  blocked?: boolean
  duplicateWarning?: boolean
  existingPatient?: { id: string; fullName: string; patientCode: string }
  newPatientId?: string
  replayed?: boolean
}

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }

function isPermanentRegistrationError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? ''
  if (['22P02', '22007', '22008', '22003', '23502', '23503', '23505', '23514', '42501'].includes(code)) return true

  const message = (error.message ?? '').toLowerCase()
  return [
    'operation id is required',
    'operation id is already used for another operation',
    'full name is required',
    'provide either a date of birth or an estimated age',
    'use either date of birth or estimated age',
    'invalid estimated age',
    'invalid payment category',
    'select an insurer and provide a policy number',
    'patient does not belong to this clinic',
    'staff does not belong to this clinic',
    'invalid clinic',
    'invalid staff',
  ].some(fragment => message.includes(fragment))
}

export async function registerPatientIdempotent(operationId: string, payload: OfflinePatientRegistrationPayload): Promise<OfflinePatientRegistrationResult> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const lang = staff.preferredLanguage
  const operation = text(operationId || payload.client_operation_id)
  const fullName = text(payload.full_name)
  const sex = text(payload.sex)
  const dateOfBirth = text(payload.date_of_birth)
  const estimatedAge = text(payload.estimated_age)
  const nationalIdNumber = text(payload.national_id_number)
  const phone = text(payload.phone)
  const quartier = text(payload.quartier)
  const city = text(payload.city)
  const nextOfKinName = text(payload.next_of_kin_name)
  const nextOfKinPhone = text(payload.next_of_kin_phone)
  const allergies = text(payload.allergies)
  const chronicConditions = text(payload.chronic_conditions)
  const paymentCategory = text(payload.payment_category) || 'cash'
  const insurerId = text(payload.insurer_id)
  const policyNumber = text(payload.policy_number)
  const policyholderName = text(payload.policyholder_name)
  const confirmDuplicate = payload.confirm_duplicate === true

  if (!operation) return { error: lang === 'fr' ? 'Identifiant de synchronisation manquant.' : 'Sync operation ID is missing.', blocked: true }
  if (!fullName) return { error: lang === 'fr' ? 'Le nom complet est requis.' : 'Full name is required.', blocked: true }
  if (!dateOfBirth && !estimatedAge) return { error: lang === 'fr' ? 'Indiquez soit la date de naissance, soit un âge estimé.' : 'Provide either a date of birth or an estimated age.', blocked: true }
  if (dateOfBirth && estimatedAge) return { error: lang === 'fr' ? 'Utilisez soit la date de naissance, soit l’âge estimé.' : 'Use either date of birth or estimated age, not both.', blocked: true }

  const estimatedAgeNumber = estimatedAge ? Number.parseInt(estimatedAge, 10) : null
  if (estimatedAge && (estimatedAgeNumber === null || Number.isNaN(estimatedAgeNumber) || estimatedAgeNumber < 0 || estimatedAgeNumber > 130)) return { error: lang === 'fr' ? 'Âge estimé invalide.' : 'Invalid estimated age.', blocked: true }
  if (!['cash', 'employer_scheme', 'cnps', 'private_insurance'].includes(paymentCategory)) return { error: lang === 'fr' ? 'Catégorie de paiement invalide.' : 'Invalid payment category.', blocked: true }
  if (paymentCategory !== 'cash' && (!insurerId || !policyNumber)) return { error: lang === 'fr' ? 'Sélectionnez un assureur et indiquez le numéro de police.' : 'Select an insurer and provide a policy number.', blocked: true }

  const { data, error } = await supabase.rpc('register_patient_idempotent', {
    p_operation_id: operation, p_clinic_id: staff.clinicId, p_staff_id: staff.staffId, p_full_name: fullName,
    p_sex: sex || null, p_date_of_birth: dateOfBirth || null, p_estimated_age: estimatedAgeNumber,
    p_national_id_number: nationalIdNumber || null, p_phone: phone || null, p_quartier: quartier || null,
    p_city: city || null, p_next_of_kin_name: nextOfKinName || null, p_next_of_kin_phone: nextOfKinPhone || null,
    p_allergies: allergies || null, p_chronic_conditions: chronicConditions || null, p_payment_category: paymentCategory,
    p_insurer_id: insurerId || null, p_policy_number: policyNumber || null, p_policyholder_name: policyholderName || null,
    p_confirm_duplicate: confirmDuplicate,
  })

  if (error) {
    console.error('registerPatientIdempotent failed:', { code: error.code, message: error.message, clinicId: staff.clinicId })
    if (isPermanentRegistrationError(error)) {
      return {
        error: lang === 'fr'
          ? 'Les données de ce patient ne sont plus valides. Vérifiez le dossier avant de relancer la synchronisation.'
          : 'This patient registration data is no longer valid. Review the record before retrying synchronization.',
        blocked: true,
      }
    }
    return { error: lang === 'fr' ? "Impossible d'enregistrer le patient. La synchronisation réessaiera automatiquement." : 'Could not save the patient. Synchronization will retry automatically.' }
  }

  const result = data?.[0]
  if (!result) return { error: lang === 'fr' ? "Réponse d'enregistrement invalide." : 'Invalid registration response.', blocked: true }
  if (result.duplicate_found) return {
    duplicateWarning: true,
    existingPatient: { id: result.existing_patient_id, fullName: result.existing_full_name, patientCode: result.existing_patient_code },
    replayed: result.idempotent_replay,
  }
  if (!result.new_patient_id) return { error: lang === 'fr' ? "Réponse d'enregistrement invalide." : 'Invalid registration response.', blocked: true }
  return { newPatientId: result.new_patient_id, replayed: result.idempotent_replay }
}
