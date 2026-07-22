'use client'

// components/NewAdmissionForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDirectAdmission } from '@/lib/actions/admissions'
import { useLang } from '@/lib/i18n/LangContext'

interface Patient { id: string; full_name: string; patient_code: string }

export default function NewAdmissionForm({ patients }: { patients: Patient[] }) {
  const router = useRouter()
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const matches = query.trim().length > 1
    ? patients.filter((p) => p.full_name.toLowerCase().includes(query.toLowerCase()) || p.patient_code.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  async function handleSubmit(formData: FormData) {
    if (!selectedPatient) {
      setError(lang === 'fr' ? 'Sélectionnez un patient dans la liste.' : 'Select a patient from the list.')
      return
    }
    setError(null)
    setSubmitting(true)
    formData.set('patient_id', selectedPatient.id)
    const result = await createDirectAdmission(formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setOpen(false)
      setSelectedPatient(null)
      setQuery('')
      setSubmitting(false)
      router.refresh()
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', width: '100%', boxSizing: 'border-box',
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        + Nouvelle admission
      </button>
    )
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
      <form action={handleSubmit}>
        {!selectedPatient ? (
          <div style={{ marginBottom: '8px', position: 'relative' }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={lang === "fr" ? "Rechercher un patient…" : "Search patient…"} style={inputStyle} />
            {matches.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                {matches.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setSelectedPatient(p); setQuery('') }} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px',
                  }}>
                    {p.full_name} <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>({p.patient_code})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '13px', margin: '0 0 8px' }}>
            Patient : <strong>{selectedPatient.full_name}</strong>{' '}
            <button type="button" onClick={() => setSelectedPatient(null)} style={{ fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>{lang === 'fr' ? 'changer' : 'change'}</button>
          </p>
        )}

        <textarea name="admission_reason" placeholder={lang === "fr" ? "Motif de l'admission (obligatoire)" : "Reason for admission (required)"} required rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: '8px' }} />

        {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" disabled={submitting} style={{ fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
            {submitting ? '…' : (lang === 'fr' ? "Créer l'admission" : 'Create admission')}
          </button>
          <button type="button" onClick={() => setOpen(false)} style={{ fontSize: '13px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            {lang === 'fr' ? 'Annuler' : 'Cancel'}
          </button>
        </div>
      </form>
    </div>
  )
}
