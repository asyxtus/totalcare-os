'use client'

// components/WardForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createWard } from '@/lib/actions/admissions'
import { useLang } from '@/lib/i18n/LangContext'

export default function WardForm() {
  const lang = useLang()
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
    const result = await createWard(formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      router.refresh()
    }
  }

  return (
    <form action={handleSubmit} style={{ marginBottom: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
        <input name="name" placeholder={lang === "fr" ? "Nom du service *" : "Ward name *"} required style={inputStyle} />
        <input name="code" placeholder={lang === "fr" ? "Code (ex. GW1)" : "Code (e.g. GW1)"} style={inputStyle} />
        <input name="ward_type" placeholder={lang === "fr" ? "Type (ex. Médecine générale)" : "Type (e.g. General medicine)"} style={inputStyle} />
        <input name="capacity" type="number" placeholder={lang === "fr" ? "Capacité prévue" : "Planned capacity"} style={inputStyle} />
        <input name="daily_rate_xaf" type="number" step="any" placeholder={lang === "fr" ? "Tarif / nuit (FCFA)" : "Rate / night (FCFA)"} style={inputStyle} />
      </div>
      <button type="submit" disabled={submitting} style={{
        fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : '+ Ajouter un service'}
      </button>
      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '8px 0 0' }}>{error}</p>}
    </form>
  )
}
