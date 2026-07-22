// lib/actions/triage.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { redirect } from 'next/navigation'

export interface SaveTriageResult {
  error?: string
  flags?: any[]
  saved?: boolean
}

// Step 1: record vitals + assessment. Returns critical flags if any exist,
// WITHOUT completing triage yet — the nurse gets a chance to actually see
// a critical value before the visit moves on. This function is safe to
// call exactly once per triage; it does not get re-called on confirmation
// (see finalizeTriage below), so there's no risk of duplicate vitals rows.
export async function saveTriageData(
  visitId: string,
  clinicId: string,
  formData: FormData
): Promise<SaveTriageResult> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const num = (key: string) => {
    const v = formData.get(key) as string
    return v ? parseFloat(v) : null
  }

  const { data: vitalsRow, error: vitalsError } = await supabase
    .from('vitals')
    .insert({
      clinic_id: clinicId,
      visit_id: visitId,
      recorded_by: staff.staffId,
      systolic_bp: num('systolic_bp'),
      diastolic_bp: num('diastolic_bp'),
      pulse: num('pulse'),
      temperature: num('temperature'),
      spo2: num('spo2'),
      respiratory_rate: num('respiratory_rate'),
      weight_kg: num('weight_kg'),
      height_cm: num('height_cm'),
    })
    .select('flags')
    .single()

  if (vitalsError) {
    return { error: 'Impossible d\'enregistrer les constantes. Réessayez.' }
  }

  const chiefComplaint = (formData.get('chief_complaint') as string)?.trim()
  const medicalHistory = (formData.get('medical_history') as string)?.trim()
  const socialHistory = (formData.get('social_history') as string)?.trim()
  const priority = (formData.get('triage_priority') as string) || 'routine'
  const priorityNote = (formData.get('priority_note') as string)?.trim() || null

  // Save priority to the visit row so the doctor queue can sort by it.
  // Best-effort — if this fails, triage still completes; a missing priority
  // just means the patient stays in FIFO order.
  if (priority !== 'routine' || priorityNote) {
    await supabase
      .from('visits')
      .update({
        triage_priority: priority,
        priority_note: priorityNote,
        priority_flagged_by: staff.staffId,
        priority_flagged_at: new Date().toISOString(),
      })
      .eq('id', visitId)
  }

  const { error: assessmentError } = await supabase
    .from('triage_assessments')
    .insert({
      clinic_id: clinicId,
      visit_id: visitId,
      recorded_by: staff.staffId,
      chief_complaint: chiefComplaint || null,
      medical_history: medicalHistory || null,
      social_history: socialHistory || null,
    })

  if (assessmentError) {
    return { error: 'Constantes enregistrées, mais l\'évaluation n\'a pas pu être sauvegardée. Réessayez.' }
  }

  const flags = (vitalsRow?.flags as any[]) ?? []
  const hasCritical = flags.some((f: any) => f.severity === 'critical')

  if (hasCritical) {
    // Data is saved. Hold here — do NOT complete triage yet. The client
    // shows the flags and calls finalizeTriage separately once confirmed.
    return { saved: true, flags }
  }

  // No critical flags — safe to complete triage immediately.
  const { error: completeError } = await supabase.rpc('complete_triage', {
    p_visit_id: visitId,
    p_staff_id: staff.staffId,
  })

  if (completeError) {
    return { error: `Constantes et évaluation enregistrées, mais impossible de terminer le triage : ${completeError.message}` }
  }

  redirect('/dashboard')
}

// Step 2 (only called after a critical-flag confirmation): vitals and
// assessment already exist from saveTriageData — this ONLY completes the
// status transition. No re-insertion, no duplicate rows possible.
export async function finalizeTriage(visitId: string): Promise<{ error?: string }> {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.rpc('complete_triage', {
    p_visit_id: visitId,
    p_staff_id: staff.staffId,
  })

  if (error) {
    return { error: `Impossible de terminer le triage : ${error.message}` }
  }

  redirect('/dashboard')
}

// Called when a nurse updates priority on a patient already in the
// waiting_consultation queue — e.g. patient was routine but deteriorated
// while waiting. Does not require re-doing triage; just updates the flag.
export async function updateVisitPriorityAction(
  visitId: string,
  priority: 'routine' | 'urgent' | 'critical',
  note: string | null
): Promise<{ error?: string }> {
  const staff = await getCurrentStaff()
  if (!['nurse', 'admin', 'doctor'].includes(staff.role)) {
    return { error: 'Rôle insuffisant.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('visits')
    .update({
      triage_priority: priority,
      priority_note: note || null,
      priority_flagged_by: staff.staffId,
      priority_flagged_at: new Date().toISOString(),
    })
    .eq('id', visitId)
    .eq('clinic_id', staff.clinicId)

  if (error) return { error: error.message }
  return {}
}
