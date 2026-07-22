'use client'

// components/SupplierPaymentInline.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordSupplierPayment } from '@/lib/actions/procurement'
import { useLang } from '@/lib/i18n/LangContext'

export default function SupplierPaymentInline({ invoiceId }: { invoiceId: string }) {
  const lang = useLang()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '11px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await recordSupplierPayment(invoiceId, formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setOpen(false)
      setSubmitting(false)
      router.refresh()
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
      }}>
        Payer
      </button>
    )
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input name="amount_xaf" type="number" step="any" placeholder={lang==="fr"?"Montant":"Amount"} required style={{ ...inputStyle, width: '90px' }} />
      <select name="payment_method" style={inputStyle}>
        <option value="cash">{lang==="fr"?"Comptant":"Cash"}</option>
        <option value="momo">MoMo</option>
        <option value="bank_transfer">{lang==="fr"?"Virement":"Bank transfer"}</option>
      </select>
      <input name="reference" placeholder={lang==="fr"?"Réf.":"Ref."} style={{ ...inputStyle, width: '80px' }} />
      <button type="submit" disabled={submitting} style={{
        fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : 'OK'}
      </button>
      {error && <span style={{ fontSize: '10px', color: 'var(--color-critical-text)' }}>{error}</span>}
    </form>
  )
}
