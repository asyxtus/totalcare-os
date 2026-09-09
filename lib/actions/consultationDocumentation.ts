'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

export async function updateUnsignedSoap(input: {
  consultationId: string
  visitId: string
  subjective: string
  objective: string
  diagnosis: string
  treatmentPlan: string
}): Promise<{ ok?: boolean; error?: string }> {
  try {
    const staff = await getCurrentStaff()
    const supabase = await createClient()
    const { error } = await supabase.rpc('update_unsigned_consultation_soap', {
      p_consultation_id: input.consultationId,
      p_staff_id: staff.staffId,
      p_subjective_notes: input.subjective,
      p_examination_notes: input.objective,
      p_diagnosis: input.diagnosis,
      p_treatment_plan: input.treatmentPlan,
    })
    if (error) return { error: error.message }
    revalidatePath(`/visits/${input.visitId}/consultation`)
    revalidatePath(`/visits/${input.visitId}/consultation-note`)
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message ?? 'Unable to update the clinical note.' }
  }
}

export async function signConsultation(input: {
  consultationId: string
  visitId: string
}): Promise<{ ok?: boolean; error?: string }> {
  try {
    const staff = await getCurrentStaff()
    const supabase = await createClient()
    const { error } = await supabase.rpc('sign_consultation', {
      p_consultation_id: input.consultationId,
      p_staff_id: staff.staffId,
    })
    if (error) return { error: error.message }
    revalidatePath(`/visits/${input.visitId}/consultation`)
    revalidatePath(`/visits/${input.visitId}/consultation-note`)
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message ?? 'Unable to sign the clinical note.' }
  }
}

export async function createConsultationAddendum(input: {
  consultationId: string
  visitId: string
  section: string
  reason: string
  content: string
}): Promise<{ ok?: boolean; error?: string }> {
  try {
    const staff = await getCurrentStaff()
    const supabase = await createClient()
    const { error } = await supabase.rpc('create_consultation_addendum', {
      p_consultation_id: input.consultationId,
      p_staff_id: staff.staffId,
      p_section: input.section,
      p_reason: input.reason,
      p_content: input.content,
    })
    if (error) return { error: error.message }
    revalidatePath(`/visits/${input.visitId}/consultation`)
    revalidatePath(`/visits/${input.visitId}/consultation-note`)
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message ?? 'Unable to create the addendum.' }
  }
}
