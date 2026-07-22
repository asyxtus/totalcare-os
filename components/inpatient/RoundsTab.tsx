'use client'

// components/inpatient/RoundsTab.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordRoundNoteAction } from '@/lib/actions/inpatientCare'
import { useLang } from '@/lib/i18n/LangContext'

interface Note { id: string; note: string; round_type: string; recorded_at: string; staff_name: string }

const ROUND_TYPES = [
  { value: 'doctor_round', fr: 'Visite médecin', en: 'Doctor Round' },
  { value: 'nurse_round', fr: 'Visite infirmière', en: 'Nurse Round' },
  { value: 'specialist_review', fr: 'Avis spécialiste', en: 'Specialist Review' },
]

const STR = {
  fr: { notePh: 'Évolution, évaluation, plan…', addNote: 'Ajouter une note', empty: 'Aucune note enregistrée.', locale: 'fr-FR' },
  en: { notePh: 'Progress, assessment, plan…', addNote: 'Add Note', empty: 'No notes recorded.', locale: 'en-US' },
} as const

export default function RoundsTab({ admissionId, notes, canEdit }: { admissionId: string; notes: Note[]; canEdit: boolean }) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await recordRoundNoteAction(admissionId, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      router.refresh()
      const textarea = document.getElementById('round-note-textarea') as HTMLTextAreaElement | null
      if (textarea) textarea.value = ''
    }
  }

  return (
    <div>
      {canEdit && (
        <form action={handleSubmit} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
          <select name="round_type" style={{ ...inputStyle, marginBottom: '8px' }}>
            {ROUND_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt[lang]}</option>)}
          </select>
          <textarea
            id="round-note-textarea"
            name="note" placeholder={t.notePh} required rows={4}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', marginBottom: '8px' }}
          />
          {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}
          <button type="submit" disabled={submitting} style={{
            fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
          }}>
            {submitting ? '…' : t.addNote}
          </button>
        </form>
      )}

      {notes.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t.empty}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {notes.map((n, i) => (
            <div key={n.id} style={{ padding: '10px 14px', borderBottom: i < notes.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '999px', background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                  {ROUND_TYPES.find((rt) => rt.value === n.round_type)?.[lang] ?? n.round_type}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{new Date(n.recorded_at).toLocaleString(t.locale)}</span>
              </div>
              <p style={{ fontSize: '13px', margin: '0 0 2px' }}>{n.note}</p>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>{n.staff_name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
