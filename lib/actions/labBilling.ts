'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

export async function deferLabOrderItem(itemId: string, reason?: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  if (!itemId) return { error: 'Examen requis.' }

  const { error } = await supabase.rpc('defer_lab_order_item', {
    p_lab_order_item_id: itemId,
    p_staff_id: staff.staffId,
    p_reason: reason?.trim() || null,
  })

  if (error) {
    console.error('deferLabOrderItem failed:', error)
    return { error: error.message || "Impossible de différer l'examen." }
  }

  revalidatePath('/billing')
  revalidatePath('/laboratory')
  revalidatePath('/reception')
  return { success: true }
}

export async function activateDeferredLabOrderItem(
  itemId: string,
  billingMode: 'pay_now' | 'charge_to_encounter' = 'pay_now',
) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  if (!itemId) return { error: 'Examen requis.' }

  const { data, error } = await supabase.rpc('activate_deferred_lab_order_item', {
    p_lab_order_item_id: itemId,
    p_staff_id: staff.staffId,
    p_billing_mode: billingMode,
  })

  if (error) {
    console.error('activateDeferredLabOrderItem failed:', error)
    return { error: error.message || "Impossible de réactiver l'examen." }
  }

  revalidatePath('/billing')
  revalidatePath('/laboratory')
  revalidatePath('/reception')
  return { success: true, chargeId: data }
}
