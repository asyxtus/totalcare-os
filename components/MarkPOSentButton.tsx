'use client'

// components/MarkPOSentButton.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markPOSent } from '@/lib/actions/procurement'
import { useLang } from '@/lib/i18n/LangContext'

export default function MarkPOSentButton({ poId }: { poId: string }) {
  const lang = useLang()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleClick() {
    setSubmitting(true)
    await markPOSent(poId)
    router.refresh()
  }

  return (
    <button onClick={handleClick} disabled={submitting} style={{
      fontSize: '12px', padding: '5px 12px', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)', background: 'var(--color-surface)',
      color: 'var(--color-text-primary)', cursor: 'pointer',
    }}>
      {submitting ? '…' : lang==='fr'?'Marquer comme envoyé':'Mark as sent'}
    </button>
  )
}
