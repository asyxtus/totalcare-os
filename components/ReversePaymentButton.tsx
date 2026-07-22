'use client'

// components/ReversePaymentButton.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { reversePaymentAction } from '@/lib/actions/billing'
import { useLang } from '@/lib/i18n/LangContext'

export default function ReversePaymentButton({ paymentId, onSuccess }: { paymentId: string; onSuccess?: () => void }) {
  const lang = useLang()
  const router = useRouter()
  const [showReason, setShowReason] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    const result = await reversePaymentAction(paymentId, reason)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      router.refresh()
      onSuccess?.()
    }
  }

  if (!showReason) {
    return (
      <button onClick={() => setShowReason(true)} style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--color-critical-text)', cursor: 'pointer' }}>
        {lang === 'fr' ? 'Annuler' : 'Cancel'}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        value={reason} onChange={(e) => setReason(e.target.value)} placeholder={lang === 'fr' ? 'Motif obligatoire' : 'Reason required'}
        style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '140px' }}
      />
      <button onClick={handleConfirm} disabled={submitting || !reason.trim()} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-critical-text)', color: 'white', cursor: 'pointer' }}>
        {lang === 'fr' ? 'Confirmer' : 'Confirm'}
      </button>
      {error && <span style={{ fontSize: '10px', color: 'var(--color-critical-text)' }}>{error}</span>}
    </div>
  )
}
