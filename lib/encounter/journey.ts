'use server'

import { createClient } from '@/lib/supabase/server'

export type EncounterJourney = {
  visit_id: string
  patient_id: string
  clinic_id: string
  is_emergency: boolean
  status: string
  stage: string
  stage_label_fr: string
  stage_label_en: string
  current_action_fr: string
  current_action_en: string
  is_terminal: boolean
  next_stage: string | null
  next_stage_label_fr: string | null
  next_stage_label_en: string | null
  next_action_fr: string | null
  next_action_en: string | null
  next_module: string | null
  pharmacy: {
    state: 'none' | 'awaiting_review' | 'awaiting_payment' | 'ready_to_dispense' | 'completed' | string
    prescription_item_count: number
    remaining_item_quantity: number
    review_pending_count: number
    ready_count: number
    fully_dispensed_count: number
    charge_count: number
    outstanding_xaf: number
    paid_xaf: number
    dispensed_record_count: number
  }
  laboratory: {
    state: 'none' | 'awaiting_payment' | 'deferred' | 'in_progress' | 'completed' | string
    item_count: number
    pending_count: number
    ready_or_completed_count: number
    unpaid_count: number
    deferred_count: number
    completed_count: number
  }
  billing: {
    state: 'settled' | 'outstanding' | string
    outstanding_xaf: number
  }
  appointment: {
    active_encounter: boolean
    can_explain_block: boolean
    blocked_reason_fr: string | null
    blocked_reason_en: string | null
  }
}

/**
 * Single source of truth for interpreting an encounter's current journey.
 * The database function uses visits.status as the canonical location and
 * derives current task, next destination, module detail and appointment
 * context without changing clinical or financial records.
 */
export async function getEncounterJourney(visitId: string): Promise<{
  data?: EncounterJourney
  error?: string
}> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_encounter_journey', {
    p_visit_id: visitId,
  })

  if (error) {
    console.error('getEncounterJourney failed:', error)
    return { error: error.message }
  }

  return { data: data as EncounterJourney }
}

export const encounterStageLabels: Record<string, { fr: string; en: string }> = {
  registered: { fr: 'Réception', en: 'Reception' },
  triage: { fr: 'Triage', en: 'Triage' },
  waiting_consultation: { fr: 'En attente de consultation', en: 'Awaiting consultation' },
  in_consultation: { fr: 'En consultation', en: 'In consultation' },
  waiting_lab: { fr: 'Laboratoire', en: 'Laboratory' },
  waiting_pharmacy: { fr: 'Pharmacie', en: 'Pharmacy' },
  billing: { fr: 'Facturation', en: 'Billing' },
  admitted: { fr: 'Hospitalisation', en: 'Admission' },
  discharged: { fr: 'Terminé', en: 'Completed' },
  cancelled: { fr: 'Annulé', en: 'Cancelled' },
}
