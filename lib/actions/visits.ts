// lib/actions/visits.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { redirect } from 'next/navigation'

const TERMINAL_STATUSES = ['discharged', 'cancelled']

export interface CreateVisitResult {
  error?: string
}

export async function createVisit(patientId: string, formData: FormData): Promise<CreateVisitResult> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const visitReason = (formData.get('visit_reason') as string)?.trim()

  // Soft duplicate check: not a database constraint like the billing
  // dedup index, because a patient legitimately CAN have multiple visits
  // over time — the thing to prevent is two active (non-terminal) visits
  // open at once, which would just be confusing (which queue entry is
  // the real one?). If one's already open, route there instead of
  // creating a second.
  const { data: existingVisit } = await supabase
    .from('visits')
    .select('id')
    .eq('patient_id', patientId)
    .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingVisit) {
    redirect(`/dashboard`)
  }

  const { error } = await supabase
    .from('visits')
    .insert({
      clinic_id: staff.clinicId,
      patient_id: patientId,
      visit_reason: visitReason || null,
      status: 'waiting_consultation',
      registered_by: staff.staffId,
    })

  if (error) {
    return { error: staff.preferredLanguage === 'fr'
      ? 'Impossible de démarrer la visite. Réessayez.'
      : 'Could not start the visit. Please try again.' }
  }

  redirect('/dashboard')
}
