'use client'

// components/AcknowledgeResultButton.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acknowledgeCriticalResultAction } from '@/lib/actions/clinicalAlerts'

export default function AcknowledgeResultButton({ resultId }: { resultId: string }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setSubmitting(true)
    setError(null)
    const result = await acknowledgeCriticalResultAction(resultId)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={submitting} style={{
        fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        {submitting ? '…' : 'Pris en compte'}
      </button>
      {error && <p style={{ fontSize: '10px', color: 'var(--color-critical-text)', margin: '4px 0 0' }}>{error}</p>}
    </div>
  )
}
