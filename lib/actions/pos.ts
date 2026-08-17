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
 * The whole server-side checkout path is wrapped so that failures from
 * authentication/staff lookup, Supabase RPC execution, or path revalidation
 * cannot collapse into the generic "Impossible de finaliser la vente."
 *
 * This is intentionally diagnostic-friendly while we trace the POS checkout
 * failure. The database function record_pos_sale() remains the authoritative
 * validation/transaction boundary.
 */
export async function checkoutPosSaleDetailed(formData: FormData) {
  let diagnosticContext: Record<string, unknown> = {}

  try {
    const staff = await getCurrentStaff()
    const supabase = await createClient()

    const paymentMethod = formData.get('payment_method') as string
    const cartJson = formData.get('cart') as string

    diagnosticContext = {
      staffId: staff.staffId,
      clinicId: staff.clinicId,
      paymentMethod,
    }

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

    diagnosticContext.cart = cart

    console.info('[POS CHECKOUT] Starting checkout', diagnosticContext)

    const { data: saleId, error } = await supabase.rpc('record_pos_sale', {
      p_clinic_id: staff.clinicId,
      p_patient_id: null,
      p_sold_by: staff.staffId,
      p_payment_method: paymentMethod,
      p_cart: cart,
    })

    if (error) {
      const rpcDiagnostic = {
        ...diagnosticContext,
        stage: 'record_pos_sale_rpc',
        error: {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        },
      }

      console.error('[POS CHECKOUT] record_pos_sale failed', rpcDiagnostic)

      const parts = [
        error.message,
        error.code ? `Code: ${error.code}` : null,
        error.details ? `Details: ${error.details}` : null,
        error.hint ? `Hint: ${error.hint}` : null,
      ].filter(Boolean)

      return {
        error: parts.join(' | ') || 'Impossible de finaliser la vente.',
      }
    }

    console.info('[POS CHECKOUT] record_pos_sale succeeded', {
      ...diagnosticContext,
      stage: 'record_pos_sale_rpc_success',
      saleId,
    })

    try {
      revalidatePath('/pharmacy')
      revalidatePath('/pharmacy/pos')
      revalidatePath('/pharmacy/inventory')
    } catch (revalidateError) {
      // A successful database sale must not be reported as a failed sale just
      // because cache invalidation failed after the transaction committed.
      console.error('[POS CHECKOUT] Revalidation failed after successful sale', {
        ...diagnosticContext,
        saleId,
        stage: 'revalidate_paths',
        error: revalidateError instanceof Error
          ? revalidateError.message
          : String(revalidateError),
      })
    }

    return { success: true, saleId }
  } catch (err) {
    const unexpectedDiagnostic = {
      ...diagnosticContext,
      stage: 'unexpected_server_action_error',
      error: err instanceof Error
        ? {
            name: err.name,
            message: err.message,
            stack: err.stack,
          }
        : String(err),
    }

    console.error('[POS CHECKOUT] Unexpected server action failure', unexpectedDiagnostic)

    const message = err instanceof Error ? err.message : String(err)

    return {
      error: message || 'Impossible de finaliser la vente.',
    }
  }
}
