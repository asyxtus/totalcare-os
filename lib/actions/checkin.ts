// lib/actions/checkin.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function friendlyError(label: string, genericMessage: string, err: { message?: string } | null): { error: string } {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${genericMessage}${detail}` }
}

// Step 1: register the visit + consultation charge + payable invoice atomically.
// If this check-in comes from a doctor-generated follow-up appointment, the
// database validates the appointment and consumes its financial entitlement.
export async function startCheckIn(patientId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const visitReason = (formData.get('visit_reason') as string)?.trim()
  const servicePriceId = formData.get('service_price_id') as string
  const assignedDoctorId = (formData.get('assigned_doctor_id') as string)?.trim()
  const appointmentId = (formData.get('appointment_id') as string)?.trim()

  if (!servicePriceId) return { error: 'Sélectionnez un type de consultation.' }

  const { data: registerResult, error: registerError } = await supabase.rpc('register_visit_with_charge', {
    p_clinic_id: staff.clinicId,
    p_patient_id: patientId,
    p_visit_reason: visitReason || null,
    p_service_price_id: servicePriceId,
    p_registered_by: staff.staffId,
    p_appointment_id: appointmentId || null,
  })

  if (registerError || !registerResult?.[0]) {
    return friendlyError('register_visit_with_charge', 'Impossible de démarrer la visite. Réessayez.', registerError)
  }

  const { service_charge_id, visit_id } = registerResult[0]

  const { error: invoiceError } = await supabase.rpc('open_invoice_for_charge', {
    p_service_charge_id: service_charge_id,
    p_created_by: staff.staffId,
  })

  if (invoiceError) {
    return friendlyError(
      'open_invoice_for_charge',
      'Visite créée, mais la facture n\'a pas pu être ouverte. Contactez un administrateur.',
      invoiceError
    )
  }

  // register_visit_with_charge now links appointment -> visit itself so the
  // appointment/entitlement mutation is part of the same database transaction.
  revalidatePath(`/patients/${patientId}`)
  revalidatePath('/reception')
  return { success: true, visitId: visit_id, serviceChargeId: service_charge_id }
}

export async function collectPaymentAndProceed(
  visitId: string,
  invoiceId: string,
  amount: number,
  formData: FormData
) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const method = formData.get('payment_method') as string
  const providerRef = (formData.get('provider_transaction_ref') as string)?.trim()

  const splits = [{ method, amount, ...(providerRef ? { provider_transaction_ref: providerRef } : {}) }]

  const { error: paymentError } = await supabase.rpc('create_payment', {
    p_invoice_id: invoiceId,
    p_total_amount_xaf: amount,
    p_received_by: staff.staffId,
    p_splits: splits,
  })

  if (paymentError) return friendlyError('create_payment', 'Le paiement n\'a pas pu être enregistré. Réessayez.', paymentError)

  const { error: advanceError } = await supabase.rpc('advance_past_reception', {
    p_visit_id: visitId,
    p_staff_id: staff.staffId,
  })

  if (advanceError) {
    return friendlyError(
      'advance_past_reception',
      'Paiement enregistré, mais la visite n\'a pas pu avancer. Contactez un administrateur.',
      advanceError
    )
  }

  redirect('/dashboard')
}

export async function proceedPastGateOnly(visitId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.rpc('advance_past_reception', {
    p_visit_id: visitId,
    p_staff_id: staff.staffId,
  })

  if (error) return friendlyError('advance_past_reception', 'Impossible de continuer. Contactez un administrateur.', error)

  redirect('/dashboard')
}

export async function flagEmergencyAndProceed(visitId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const reason = (formData.get('emergency_reason') as string)?.trim()
  if (!reason) return { error: 'Un motif est requis pour signaler une urgence.' }

  const { error: flagError } = await supabase.rpc('flag_visit_emergency', {
    p_visit_id: visitId,
    p_flagged_by: staff.staffId,
    p_reason: reason,
  })

  if (flagError) return friendlyError('flag_visit_emergency', 'Impossible de signaler l\'urgence. Réessayez.', flagError)

  const { error: advanceError } = await supabase.rpc('advance_past_reception', {
    p_visit_id: visitId,
    p_staff_id: staff.staffId,
  })

  if (advanceError) {
    return friendlyError(
      'advance_past_reception',
      'Urgence signalée, mais la visite n\'a pas pu avancer. Contactez un administrateur.',
      advanceError
    )
  }

  redirect('/dashboard')
}
