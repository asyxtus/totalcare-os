'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import type { EncounterJourney } from '@/lib/encounter/journey'

export type PatientJourneyResult = {
  patient: { id: string; full_name: string; patient_code: string }
  journey: EncounterJourney | null
  financial: {
    outstanding_xaf: number
    charge_count: number
  }
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

  // Patient-level financial state is deliberately separate from encounter state.
  // A discharged encounter may still have an unpaid balance that must be visible
  // when the patient returns for a new consultation/follow-up.
  const { data: charges, error: chargeError } = await supabase
    .from('service_charges')
    .select('patient_id, amount_xaf, patient_portion_xaf, amount_paid_xaf, status')
    .in('patient_id', patientIds)
    .eq('clinic_id', staff.clinicId)
    .neq('status', 'void')

  if (chargeError) {
    console.error('searchPatientJourney patient balances failed:', chargeError)
    return { error: chargeError.message }
  }

  const financialMap = new Map<string, { outstanding_xaf: number; charge_count: number }>()
  for (const charge of charges ?? []) {
    const amount = Number(charge.patient_portion_xaf ?? charge.amount_xaf ?? 0)
    const paid = Number(charge.amount_paid_xaf ?? 0)
    const balance = Math.max(amount - paid, 0)
    if (balance <= 0) continue
    const current = financialMap.get(charge.patient_id) ?? { outstanding_xaf: 0, charge_count: 0 }
    current.outstanding_xaf += balance
    current.charge_count += 1
    financialMap.set(charge.patient_id, current)
  }

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
  const activePatientIds = new Set<string>()

  for (const visit of visits ?? []) {
    const { data: journey, error } = await supabase.rpc('get_encounter_journey', { p_visit_id: visit.id })
    if (error) {
      console.error(`searchPatientJourney journey ${visit.id} failed:`, error)
      continue
    }
    const patient = patientMap.get(visit.patient_id)
    if (patient && journey) {
      results.push({
        patient,
        journey: journey as EncounterJourney,
        financial: financialMap.get(patient.id) ?? { outstanding_xaf: 0, charge_count: 0 },
      })
      activePatientIds.add(patient.id)
    }
  }

  // Also return patients with no active encounter when they have an outstanding
  // balance. This lets Reception identify old debt when the patient returns.
  for (const patient of patients) {
    if (activePatientIds.has(patient.id)) continue
    const financial = financialMap.get(patient.id)
    if (!financial?.outstanding_xaf) continue
    results.push({ patient, journey: null, financial })
  }

  return { data: results }
}
