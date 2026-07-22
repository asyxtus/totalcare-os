'use client'

// components/ApproveReviewForm.tsx

import { useState } from 'react'
import { approvePrescriptionReview } from '@/lib/actions/pharmacy'
import { useLang } from '@/lib/i18n/LangContext'

export default function ApproveReviewForm({ prescriptionId }: { prescriptionId: string }) {
  const lang = useLang()
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [approved, setApproved] = useState(false)

  async function handleApprove() {
    setSubmitting(true)
    setError(null)
    const result = await approvePrescriptionReview(prescriptionId, notes)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setApproved(true)
    }
  }

  if (approved) {
    return <p style={{ fontSize: '13px', color: 'var(--color-success-text)' }}>✓ Approuvée — actualisez la page pour dispenser.</p>
  }

  return (
    <div>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={lang==="fr"?"Notes de révision (optionnel)":"Review notes (optional)"}
        style={{
          width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)', fontSize: '13px', marginBottom: '8px',
          background: 'var(--color-bg)', color: 'var(--color-text-primary)',
        }}
      />
      <button onClick={handleApprove} disabled={submitting} style={{
        fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : 'Approuver cette ordonnance'}
      </button>
      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginTop: '6px' }}>{error}</p>}
    </div>
  )
}
