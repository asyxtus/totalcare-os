'use client'

// components/InpatientNoteForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordInpatientNoteAction } from '@/lib/actions/admissions'
import { useLang } from '@/lib/i18n/LangContext'

export default function InpatientNoteForm({ admissionId }: { admissionId: string }) {
  const lang = useLang()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await recordInpatientNoteAction(admissionId, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      router.refresh()
      const textarea = document.getElementById('inpatient-note-textarea') as HTMLTextAreaElement | null
      if (textarea) textarea.value = ''
    }
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <textarea
        id="inpatient-note-textarea"
        name="note" placeholder={lang==="fr"?"Observation, évolution, soins administrés…":"Observation, progress, care administered…"} required rows={2}
        style={{
          flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
          fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', resize: 'vertical',
        }}
      />
      <button type="submit" disabled={submitting} style={{
        fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : (lang==='fr'?'Ajouter':'Add')}
      </button>
      {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)' }}>{error}</p>}
    </form>
  )
}
