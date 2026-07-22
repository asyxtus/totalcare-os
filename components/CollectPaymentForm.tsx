'use client'

// components/CollectPaymentForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { collectPayment, collectChargesDirectly } from '@/lib/actions/billing'
import { useLang } from '@/lib/i18n/LangContext'

export default function CollectPaymentForm({
  invoiceId, chargeIds, balance, totalOwed, onSuccess, lang: langProp,
}: {
  invoiceId: string | null
  chargeIds?: string[]
  balance?: number
  totalOwed?: number
  onSuccess?: () => void
  lang?: 'fr' | 'en'
  locale?: string
}) {
  const langCtx = useLang()
  const lang = langProp ?? langCtx
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const defaultAmount = balance ?? totalOwed ?? 0

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '12px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    let result
    if (invoiceId) {
      result = await collectPayment(invoiceId, formData)
    } else if (chargeIds && chargeIds.length > 0) {
      result = await collectChargesDirectly(chargeIds, formData)
    } else {
      setError('No invoice or charges to collect.')
      setSubmitting(false)
      return
    }
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      // Open the printable receipt in a new tab
      if (result?.paymentId) {
        window.open(`/print/payments/${result.paymentId}`, '_blank')
      }
      router.refresh()
      onSuccess?.()
    }
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      <input name="amount_xaf" type="number" step="any" defaultValue={defaultAmount || undefined}
        placeholder={lang === 'fr' ? 'Montant' : 'Amount'} required style={{ ...inputStyle, width: '110px' }} />
      <select name="payment_method" style={inputStyle}>
        <option value="cash">{lang === 'fr' ? 'Comptant' : 'Cash'}</option>
        <option value="momo">MTN MoMo</option>
        <option value="orange_money">Orange Money</option>
      </select>
      <input name="reference" placeholder={lang === 'fr' ? 'Réf. transaction (optionnel)' : 'Transaction ref. (optional)'}
        style={{ ...inputStyle, width: '160px' }} />
      <button type="submit" disabled={submitting} style={{
        fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : (lang === 'fr' ? 'Encaisser' : 'Collect')}
      </button>
      {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', width: '100%', margin: 0 }}>{error}</p>}
    </form>
  )
}
