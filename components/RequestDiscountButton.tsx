'use client'

// components/RequestDiscountButton.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestDiscountAction } from '@/lib/actions/billing'

export default function RequestDiscountButton({ serviceChargeId, onSuccess }: { serviceChargeId: string; onSuccess?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await requestDiscountAction(serviceChargeId, formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setOpen(false)
      setSubmitting(false)
      router.refresh()
      onSuccess?.()
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: 0 }}>
        Demander une remise
      </button>
    )
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
      <input name="discount_amount_xaf" type="number" step="any" placeholder="Montant" required style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '80px' }} />
      <input name="reason" placeholder="Motif" required style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '140px' }} />
      <button type="submit" disabled={submitting} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
        {submitting ? '…' : 'Envoyer'}
      </button>
      {error && <span style={{ fontSize: '10px', color: 'var(--color-critical-text)' }}>{error}</span>}
    </form>
  )
}
