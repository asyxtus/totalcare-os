'use client'

// components/ApplyDepositButton.tsx

import { useState } from 'react'
import { applyDepositAction } from '@/lib/actions/deposits'
import { useLang } from '@/lib/i18n/LangContext'

export default function ApplyDepositButton({
  patientId, invoiceId, maxAmount, onSuccess,
}: {
  patientId: string
  invoiceId: string
  maxAmount: number
  onSuccess: () => void
}) {
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await applyDepositAction(patientId, invoiceId, formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      setOpen(false)
      onSuccess()
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
        background: 'none', color: 'var(--color-accent)', cursor: 'pointer',
      }}>
        {lang === 'fr' ? 'Payer avec le dépôt' : 'Pay with deposit'}
      </button>
    )
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        name="amount_xaf" type="number" step="any" defaultValue={maxAmount} max={maxAmount} required
        style={{ fontSize: '12px', padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '90px' }}
      />
      <button type="submit" disabled={submitting} style={{ fontSize: '11px', padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
        {submitting ? '…' : 'Appliquer'}
      </button>
      <button type="button" onClick={() => setOpen(false)} style={{ fontSize: '11px', padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
        {lang === 'fr' ? 'Annuler' : 'Cancel'}
      </button>
      {error && <span style={{ fontSize: '10px', color: 'var(--color-critical-text)' }}>{error}</span>}
    </form>
  )
}
