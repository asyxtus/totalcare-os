// lib/actions/referral.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

function friendlyError(label: string, msg: string, err: unknown) {
  console.error(`${label}:`, err)
  return { error: msg }
}

export async function createReferralAction(formData: FormData) {
  const staff = await getCurrentStaff()
  if (!['doctor', 'admin'].includes(staff.role)) {
    return { error: 'Réservé aux médecins.' }
  }

  const visitId = formData.get('visit_id') as string
  const consultationId = (formData.get('consultation_id') as string) || null
  const patientId = formData.get('patient_id') as string
  const specialty = (formData.get('specialty') as string)?.trim()
  const specialistName = (formData.get('specialist_name') as string)?.trim() || null
  const facilityName = (formData.get('facility_name') as string)?.trim() || null
  const facilityAddress = (formData.get('facility_address') as string)?.trim() || null
  const urgency = (formData.get('urgency') as string) || 'routine'
  const reason = (formData.get('reason') as string)?.trim()
  const clinicalSummary = (formData.get('clinical_summary') as string)?.trim() || null
  const specificRequest = (formData.get('specific_request') as string)?.trim() || null

  if (!specialty) return { error: staff.preferredLanguage === 'fr' ? 'La spécialité est requise.' : 'Specialty is required.' }
  if (!reason) return { error: staff.preferredLanguage === 'fr' ? 'Le motif de référence est requis.' : 'Referral reason is required.' }
  if (!visitId || !patientId) return { error: 'Données de visite manquantes.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('external_referrals')
    .insert({
      clinic_id: staff.clinicId,
      visit_id: visitId,
      consultation_id: consultationId,
      patient_id: patientId,
      referred_by: staff.staffId,
      specialty,
      specialist_name: specialistName,
      facility_name: facilityName,
      facility_address: facilityAddress,
      urgency,
      reason,
      clinical_summary: clinicalSummary,
      specific_request: specificRequest,
    })
    .select('id')
    .maybeSingle()

  if (error) return friendlyError('createReferral', staff.preferredLanguage === 'fr' ? 'Impossible de créer la référence.' : 'Could not create referral.', error)

  revalidatePath(`/visits/${visitId}/consultation`)
  revalidatePath(`/patients/${patientId}`)
  return { success: true, referralId: data?.id }
}
