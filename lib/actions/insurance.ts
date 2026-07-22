// lib/actions/insurance.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

export async function createInsurerAction(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  const payerType = formData.get('payer_type') as string
  const coveragePct = formData.get('coverage_percentage') as string

  if (!name) return { error: 'Le nom est requis.' }
  if (!coveragePct || parseFloat(coveragePct) <= 0 || parseFloat(coveragePct) > 100) {
    return { error: 'Le pourcentage de couverture doit être entre 1 et 100.' }
  }

  const { error } = await supabase.from('insurers').insert({
    clinic_id: staff.clinicId,
    name,
    payer_type: payerType,
    coverage_percentage: parseFloat(coveragePct),
    contact_name: (formData.get('contact_name') as string)?.trim() || null,
    phone: (formData.get('phone') as string)?.trim() || null,
    email: (formData.get('email') as string)?.trim() || null,
    address: (formData.get('address') as string)?.trim() || null,
  })

  if (error) return friendlyError('createInsurer', 'Impossible de créer cet assureur.', error)

  revalidatePath('/billing')
  revalidatePath('/patients/new')
  return { success: true }
}

export async function addPatientInsuranceAction(patientId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const insurerId = formData.get('insurer_id') as string
  const policyNumber = (formData.get('policy_number') as string)?.trim()
  const policyholderName = (formData.get('policyholder_name') as string)?.trim()

  if (!insurerId) return { error: 'Sélectionnez un assureur.' }
  if (!policyNumber) return { error: 'Le numéro de police est requis.' }

  // Deactivate any existing active coverage first — only one active
  // per patient at a time (enforced at the DB level too via a partial
  // unique index), so switching insurers means retiring the old one.
  await supabase.from('patient_insurance').update({ is_active: false }).eq('patient_id', patientId).eq('is_active', true)

  const { error } = await supabase.from('patient_insurance').insert({
    clinic_id: staff.clinicId,
    patient_id: patientId,
    insurer_id: insurerId,
    policy_number: policyNumber,
    policyholder_name: policyholderName || null,
    created_by: staff.staffId,
  })

  if (error) return friendlyError('addPatientInsurance', 'Impossible d\'enregistrer cette couverture.', error)

  revalidatePath('/billing')
  return { success: true }
}

export async function createClaimAction(insurerId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.rpc('create_insurance_claim', {
    p_clinic_id: staff.clinicId,
    p_insurer_id: insurerId,
    p_created_by: staff.staffId,
  })

  if (error) return friendlyError('create_insurance_claim', 'Impossible de créer cette réclamation.', error)

  revalidatePath('/billing')
  return { success: true }
}

export async function submitClaimAction(claimId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.rpc('submit_insurance_claim', {
    p_clinic_id: staff.clinicId,
    p_claim_id: claimId,
    p_submitted_by: staff.staffId,
  })

  if (error) return friendlyError('submit_insurance_claim', 'Impossible de soumettre cette réclamation.', error)

  revalidatePath('/billing')
  return { success: true }
}

export async function updateClaimStatusAction(claimId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const status = formData.get('status') as string
  const totalApproved = formData.get('total_approved_xaf') as string
  const notes = (formData.get('notes') as string)?.trim()

  const { error } = await supabase.rpc('update_claim_status', {
    p_clinic_id: staff.clinicId,
    p_claim_id: claimId,
    p_status: status,
    p_updated_by: staff.staffId,
    p_total_approved_xaf: totalApproved ? parseFloat(totalApproved) : null,
    p_notes: notes || null,
  })

  if (error) return friendlyError('update_claim_status', 'Impossible de mettre à jour cette réclamation.', error)

  revalidatePath('/billing')
  return { success: true }
}

export async function recordClaimPaymentAction(claimId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const amount = formData.get('amount_received_xaf') as string
  if (!amount || parseFloat(amount) <= 0) return { error: 'Montant invalide.' }

  const { error } = await supabase.rpc('record_claim_payment', {
    p_clinic_id: staff.clinicId,
    p_claim_id: claimId,
    p_amount_received_xaf: parseFloat(amount),
    p_received_by: staff.staffId,
  })

  if (error) return friendlyError('record_claim_payment', 'Impossible d\'enregistrer ce paiement.', error)

  revalidatePath('/billing')
  return { success: true }
}
