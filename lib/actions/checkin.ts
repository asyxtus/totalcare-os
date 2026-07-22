// lib/actions/checkin.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Shared helper: log the real error server-side always, and include it
// in the returned message outside production. This is what makes a
// failure diagnosable from the browser instead of guessing from a
// generic sentence — every RPC error path in this file uses this.
function friendlyError(label: string, genericMessage: string, err: { message?: string } | null): { error: string } {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${genericMessage}${detail}` }
}

// Step 1: register the visit + its consultation charge + a payable
// invoice, all atomically. No redirect — the patient detail page
// re-renders itself based on the new visit state (status='registered',
// charge unpaid), which is what triggers the payment-collection UI.
export async function startCheckIn(patientId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const visitReason = (formData.get('visit_reason') as string)?.trim()
  const servicePriceId = formData.get('service_price_id') as string
  const assignedDoctorId = (formData.get('assigned_doctor_id') as string)?.trim()
  const appointmentId = (formData.get('appointment_id') as string)?.trim()

  if (!servicePriceId) {
    return { error: 'Sélectionnez un type de consultation.' }
  }

  const { data: registerResult, error: registerError } = await supabase.rpc('register_visit_with_charge', {
    p_clinic_id: staff.clinicId,
    p_patient_id: patientId,
    p_visit_reason: visitReason || null,
    p_service_price_id: servicePriceId,
    p_registered_by: staff.staffId,
    p_assigned_doctor_id: assignedDoctorId || null,
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

  // Link back to the appointment this check-in came from, if any. The
  // visit + invoice above are the money-critical part and already
  // succeeded — this is bookkeeping only, so a failure here is logged
  // but deliberately doesn't turn into a user-facing error: the visit
  // is real and correct either way, the appointment would just be left
  // showing "scheduled" instead of "arrived" until someone notices.
  if (appointmentId) {
    const { error: linkError } = await supabase
      .from('appointments')
      .update({ status: 'arrived', visit_id })
      .eq('id', appointmentId)
      .eq('clinic_id', staff.clinicId)
    if (linkError) {
      console.error('Failed to link appointment to new visit:', linkError)
    }
  }

  revalidatePath(`/patients/${patientId}`)
  revalidatePath('/reception')
}

// Step 2a: collect payment against the invoice, then pass the payment
// gate. Both RPCs must succeed for the visit to actually move forward —
// if advance_past_reception fails after a successful payment, the money
// is still correctly recorded; only the visit's progression is blocked,
// which is the safe direction to fail in.
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

  const splits = [{
    method,
    amount,
    ...(providerRef ? { provider_transaction_ref: providerRef } : {}),
  }]

  const { error: paymentError } = await supabase.rpc('create_payment', {
    p_invoice_id: invoiceId,
    p_total_amount_xaf: amount,
    p_received_by: staff.staffId,
    p_splits: splits,
  })

  if (paymentError) {
    return friendlyError('create_payment', 'Le paiement n\'a pas pu être enregistré. Réessayez.', paymentError)
  }

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

// Recovery path: the charge is already fully paid (a payment succeeded
// on an earlier attempt) but the visit never advanced past the gate —
// this can happen if advance_past_reception failed separately, or if an
// old client retried after a silent failure. Rather than trying to
// charge again (which create_payment correctly refuses), this just
// re-attempts the status transition on its own.
export async function proceedPastGateOnly(visitId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.rpc('advance_past_reception', {
    p_visit_id: visitId,
    p_staff_id: staff.staffId,
  })

  if (error) {
    return friendlyError('advance_past_reception', 'Impossible de continuer. Contactez un administrateur.', error)
  }

  redirect('/dashboard')
}
// Step 3: emergency bypass. Reason is mandatory — enforced again here
// even though the database also enforces it, so the error surfaces
// before a round trip if someone submits an empty reason.
export async function flagEmergencyAndProceed(visitId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const reason = (formData.get('emergency_reason') as string)?.trim()
  if (!reason) {
    return { error: 'Un motif est requis pour signaler une urgence.' }
  }

  const { error: flagError } = await supabase.rpc('flag_visit_emergency', {
    p_visit_id: visitId,
    p_flagged_by: staff.staffId,
    p_reason: reason,
  })

  if (flagError) {
    return friendlyError('flag_visit_emergency', 'Impossible de signaler l\'urgence. Réessayez.', flagError)
  }

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
