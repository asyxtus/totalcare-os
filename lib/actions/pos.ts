// lib/actions/pos.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

type PosCartLine = {
  product_id: string
  quantity: number
}

/**
 * POS-specific checkout action.
 *
 * Unlike the generic pharmacy action, this deliberately preserves the
 * database exception message. record_pos_sale() only raises controlled,
 * pharmacist-safe messages (invalid cart, inactive product, insufficient
 * stock, expired/usable stock issues, etc.), so hiding the message behind
 * "Impossible de finaliser la vente" makes diagnosis unnecessarily hard.
 */
export async function checkoutPosSaleDetailed(formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const paymentMethod = formData.get('payment_method') as string
  const cartJson = formData.get('cart') as string

  if (!cartJson) return { error: 'Le panier est vide.' }

  let cart: PosCartLine[]
  try {
    cart = JSON.parse(cartJson)
  } catch {
    return { error: 'Panier invalide.' }
  }

  if (!Array.isArray(cart) || cart.length === 0) {
    return { error: 'Le panier est vide.' }
  }

  const { data: saleId, error } = await supabase.rpc('record_pos_sale', {
    p_clinic_id: staff.clinicId,
    p_patient_id: null,
    p_sold_by: staff.staffId,
    p_payment_method: paymentMethod,
    p_cart: cart,
  })

  if (error) {
    console.error('record_pos_sale failed:', error)
    return {
      error: error.message || 'Impossible de finaliser la vente.',
    }
  }

  revalidatePath('/pharmacy')
  revalidatePath('/pharmacy/pos')
  revalidatePath('/pharmacy/inventory')

  return { success: true, saleId }
}
