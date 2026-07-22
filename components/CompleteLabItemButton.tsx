'use client'

// components/CompleteLabItemButton.tsx

import { useState } from 'react'
import { markSampleCollected } from '@/lib/actions/lab'
import { useLang } from '@/lib/i18n/LangContext'

// Now only handles the sample-collection step — actual completion
// happens via LabResultsForm's combined "Enregistrer et terminer"
// action, which is the fix for the silently-dropped-values bug.
export default function MarkSampleCollectedButton({ itemId }: { itemId: string }) {
  const lang = useLang()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setSubmitting(true)
    const result = await markSampleCollected(itemId)
    if (result?.error) setError(result.error)
    setSubmitting(false)
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      {error && (
        <p style={{ fontSize: '13px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '10px' }}>
          {error}
        </p>
      )}
      <button onClick={handleClick} disabled={submitting} style={{
        fontSize: '13px', padding: '9px 16px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
        color: 'var(--color-text-primary)', cursor: 'pointer',
      }}>
        {submitting ? '…' : (lang==='fr'?'Marquer comme prélevé':'Mark as collected')}
      </button>
    </div>
  )
}
