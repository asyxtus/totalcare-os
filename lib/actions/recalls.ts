// lib/actions/recalls.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

export async function initiateRecall(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const batchId = formData.get('batch_id') as string
  const reason = (formData.get('reason') as string)?.trim()

  if (!batchId) return { error: 'Sélectionnez un lot.' }
  if (!reason) return { error: 'Un motif est requis.' }

  const { data: recallId, error } = await supabase.rpc('initiate_batch_recall', {
    p_clinic_id: staff.clinicId,
    p_batch_id: batchId,
    p_initiated_by: staff.staffId,
    p_reason: reason,
  })

  if (error) return friendlyError('initiate_batch_recall', 'Impossible de lancer le rappel.', error)

  revalidatePath('/pharmacy/recalls')
  return { success: true, recallId }
}

export async function resolveRecall(recallId: string, notes: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  if (!notes.trim()) return { error: 'Des notes de résolution sont requises.' }

  const { error } = await supabase.rpc('resolve_batch_recall', {
    p_recall_id: recallId,
    p_resolved_by: staff.staffId,
    p_resolution_notes: notes,
  })

  if (error) return friendlyError('resolve_batch_recall', 'Impossible de résoudre ce rappel.', error)

  revalidatePath('/pharmacy/recalls')
  revalidatePath(`/pharmacy/recalls/${recallId}`)
  return { success: true }
}
