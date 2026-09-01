'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import type { EncounterJourney } from '@/lib/encounter/journey'

export type PatientJourneyResult = {
  patient: { id: string; full_name: string; patient_code: string }
  journey: EncounterJourney
}

export async function searchPatientJourney(query: string): Promise<{
  data?: PatientJourneyResult[]
  error?: string
}> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const q = query.trim()
  if (q.length < 2) return { data: [] }

  const { data: patients, error: patientError } = await supabase
    .from('patients')
    .select('id, full_name, patient_code')
    .eq('clinic_id', staff.clinicId)
    .or(`full_name.ilike.%${q}%,patient_code.ilike.%${q}%`)
    .order('full_name')
    .limit(10)

  if (patientError) {
    console.error('searchPatientJourney patients failed:', patientError)
    return { error: patientError.message }
  }
  if (!patients?.length) return { data: [] }

  const patientIds = patients.map((p) => p.id)
  const { data: visits, error: visitError } = await supabase
    .from('visits')
    .select('id, patient_id, status, created_at')
    .in('patient_id', patientIds)
    .eq('clinic_id', staff.clinicId)
    .not('status', 'in', '(discharged,cancelled)')
    .order('created_at', { ascending: false })

  if (visitError) {
    console.error('searchPatientJourney visits failed:', visitError)
    return { error: visitError.message }
  }

  const patientMap = new Map(patients.map((p) => [p.id, p]))
  const results: PatientJourneyResult[] = []
  for (const visit of visits ?? []) {
    const { data: journey, error } = await supabase.rpc('get_encounter_journey', { p_visit_id: visit.id })
    if (error) {
      console.error(`searchPatientJourney journey ${visit.id} failed:`, error)
      continue
    }
    const patient = patientMap.get(visit.patient_id)
    if (patient && journey) results.push({ patient, journey: journey as EncounterJourney })
  }
  return { data: results }
}
