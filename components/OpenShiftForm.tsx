'use client'

// components/OpenShiftForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { openShift } from '@/lib/actions/billing'

export default function OpenShiftForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await openShift(formData)
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
        fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
        color: 'var(--color-text-primary)', cursor: 'pointer',
      }}>
        Ouvrir la caisse
      </button>
    )
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <div>
        <input
          name="opening_cash_xaf" type="number" step="any" placeholder="Fonds de caisse initial (FCFA)" required
          style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
        />
        {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '4px 0 0' }}>{error}</p>}
      </div>
      <button type="submit" disabled={submitting} style={{
        fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : 'Confirmer'}
      </button>
    </form>
  )
}
