// lib/actions/pos.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

type PosCartLine = {
  product_id: string
  quantity: number
}

export type PosStockDiagnostic = {
  productName: string
  requested: number
  sellable: number
  physical: number
  reason: 'expired' | 'quarantined' | 'inactive_batches' | 'insufficient'
  expiryLots?: string
}

/** Convert the authoritative database stock message into UI-friendly data. */
function parsePosStockDiagnostic(message: string): PosStockDiagnostic | null {
  const expired = message.match(
    /Stock insuffisant pour (.+?) : demandé (\d+), stock vendable 0\. Stock physique (\d+), dont (\d+) unité\(s\) expirée\(s\)\. Lots expirés : (.+)$/i,
  )
  if (expired) {
    return {
      productName: expired[1].trim(),
      requested: Number(expired[2]),
      sellable: 0,
      physical: Number(expired[3]),
      reason: 'expired',
      expiryLots: expired[5].trim(),
    }
  }

  const quarantined = message.match(
    /Stock insuffisant pour (.+?) : demandé (\d+), stock vendable 0\. Stock physique (\d+), dont (\d+) unité\(s\) en quarantaine\. Lots en quarantaine : (.+)$/i,
  )
  if (quarantined) {
    return {
      productName: quarantined[1].trim(),
      requested: Number(quarantined[2]),
      sellable: 0,
      physical: Number(quarantined[3]),
      reason: 'quarantined',
      expiryLots: quarantined[5].trim(),
    }
  }

  const mixed = message.match(
    /Stock vendable insuffisant pour (.+?) : demandé (\d+), vendable (\d+)\. Stock physique (\d+), dont (\d+) unité\(s\) expirée\(s\)\. Lots expirés : (.+)$/i,
  )
  if (mixed) {
    return {
      productName: mixed[1].trim(),
      requested: Number(mixed[2]),
      sellable: Number(mixed[3]),
      physical: Number(mixed[4]),
      reason: 'expired',
      expiryLots: mixed[6].trim(),
    }
  }

  const inactive = message.match(
    /Stock vendable insuffisant pour (.+?) : demandé (\d+), vendable (\d+)\. Stock physique, avec (\d+) unité\(s\) dans des lots non actifs/i,
  )
  if (inactive) {
    return {
      productName: inactive[1].trim(),
      requested: Number(inactive[2]),
      sellable: Number(inactive[3]),
      physical: Number(inactive[3]) + Number(inactive[4]),
      reason: 'inactive_batches',
    }
  }

  const insufficient = message.match(
    /Stock réellement insuffisant pour (.+?) : demandé (\d+), stock vendable (\d+), stock physique (\d+)/i,
  )
  if (insufficient) {
    return {
      productName: insufficient[1].trim(),
      requested: Number(insufficient[2]),
      sellable: Number(insufficient[3]),
      physical: Number(insufficient[4]),
      reason: 'insufficient',
    }
  }

  return null
}

/**
 * POS-specific checkout action.
 *
 * The database function record_pos_sale() remains the authoritative
 * validation/transaction boundary. This action preserves its detailed
 * diagnostic and additionally returns structured stock information when the
 * failure is a stock-availability problem.
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

      const stockDiagnostic = parsePosStockDiagnostic(error.message ?? '')
      const parts = [
        error.message,
        error.code ? `Code: ${error.code}` : null,
        error.details ? `Details: ${error.details}` : null,
        error.hint ? `Hint: ${error.hint}` : null,
      ].filter(Boolean)

      return {
        error: parts.join(' | ') || 'Impossible de finaliser la vente.',
        stockDiagnostic,
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
      revalidatePath('/pharmacy/pos/sales')
    } catch (revalidateError) {
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
    return { error: message || 'Impossible de finaliser la vente.' }
  }
}

export async function savePosDailyReconciliation(date: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  if (staff.role !== 'admin') {
    return { error: 'Seul un administrateur peut enregistrer le rapprochement POS.' }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: 'Date de rapprochement invalide.' }
  }

  const cash = Number(formData.get('cash_counted_xaf'))
  const momo = Number(formData.get('momo_counted_xaf'))
  const orange = Number(formData.get('orange_money_counted_xaf'))
  const notes = ((formData.get('notes') as string) ?? '').trim() || null

  if (![cash, momo, orange].every((value) => Number.isFinite(value) && value >= 0)) {
    return { error: 'Les montants comptés doivent être des nombres positifs ou nuls.' }
  }

  const { error } = await supabase
    .from('pos_daily_reconciliations')
    .upsert({
      clinic_id: staff.clinicId,
      reconciliation_date: date,
      cash_counted_xaf: cash,
      momo_counted_xaf: momo,
      orange_money_counted_xaf: orange,
      notes,
      reconciled_by: staff.staffId,
      reconciled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'clinic_id,reconciliation_date' })

  if (error) {
    console.error('[POS RECONCILIATION] save failed', {
      clinicId: staff.clinicId,
      date,
      staffId: staff.staffId,
      error,
    })
    return { error: `Impossible d'enregistrer le rapprochement : ${error.message}` }
  }

  revalidatePath('/pharmacy/pos/sales')
  return { success: true }
}
