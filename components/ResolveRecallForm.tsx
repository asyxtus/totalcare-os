'use client'

// components/ResolveRecallForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { resolveRecall } from '@/lib/actions/recalls'
import { useLang } from '@/lib/i18n/LangContext'

export default function ResolveRecallForm({ recallId }: { recallId: string }) {
  const lang = useLang()
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    const result = await resolveRecall(recallId, notes)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 8px' }}>{lang==='fr'?'Résoudre ce rappel':'Resolve this recall'}</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={lang==="fr"?"Notes de résolution — ex. lot détruit, patients contactés, retourné au fournisseur…":"Resolution notes — e.g. batch destroyed, patients contacted, returned to supplier…"}
        rows={2}
        style={{
          width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
          fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', marginBottom: '8px', resize: 'vertical',
        }}
      />
      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}
      <button onClick={handleSubmit} disabled={submitting} style={{
        fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : (lang==='fr'?'Marquer comme résolu':'Mark as resolved')}
      </button>
    </div>
  )
}
