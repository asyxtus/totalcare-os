'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

export async function correctBatchExpiryDate(batchId: string, newExpiryDate: string, reason: string) {
  const staff = await getCurrentStaff()

  if (staff.role !== 'admin') {
    return { error: 'Seul un administrateur peut corriger la date d’expiration.' }
  }

  if (!batchId || !newExpiryDate) {
    return { error: 'Le lot et la nouvelle date d’expiration sont requis.' }
  }

  const trimmedReason = reason?.trim()
  if (!trimmedReason) {
    return { error: 'Un motif est obligatoire pour corriger une date d’expiration.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('correct_batch_expiry_date', {
    p_batch_id: batchId,
    p_new_expiry_date: newExpiryDate,
    p_corrected_by: staff.staffId,
    p_reason: trimmedReason,
  })

  if (error) {
    console.error('correct_batch_expiry_date failed:', error)
    return { error: error.message || 'Impossible de corriger la date d’expiration.' }
  }

  revalidatePath('/pharmacy/inventory')
  revalidatePath('/pharmacy')
  revalidatePath('/pharmacy/adjustments')

  return { success: true, data }
}
