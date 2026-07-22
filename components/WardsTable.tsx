'use client'

// components/WardsTable.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createWard } from '@/lib/actions/admissions'
import { useLang } from '@/lib/i18n/LangContext'

interface Ward {
  id: string; name: string; code: string | null; ward_type: string | null
  capacity: number | null; daily_rate_xaf: number | null; is_active: boolean; bed_count: number
}

export default function WardsTable({ wards }: { wards: Ward[] }) {
  const lang = useLang()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await createWard(formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setShowForm(false)
      setSubmitting(false)
      router.refresh()
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button onClick={() => setShowForm((s) => !s)} style={{
          fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
        }}>
          {showForm ? (lang === 'fr' ? 'Annuler' : 'Cancel') : (lang === 'fr' ? '+ Nouveau service' : '+ New ward')}
        </button>
      </div>

      {showForm && (
        <form action={handleSubmit} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
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
            {submitting ? '…' : (lang === 'fr' ? 'Créer' : 'Create')}
          </button>
          {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '8px 0 0' }}>{error}</p>}
        </form>
      )}

      {wards.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucun service créé.' : 'No wards created.'}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.5fr 1.5fr 1fr 1fr 0.6fr', gap: '10px', padding: '10px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', minWidth: '560px' }}>
            <span>Code</span><span>{lang==='fr'?'Nom':'Name'}</span><span>Type</span><span>{lang==='fr'?'Lits créés':'Beds'}</span><span>{lang==='fr'?'Tarif / nuit':'Rate/night'}</span><span>{lang==='fr'?'Actif':'Active'}</span>
          </div>
          {wards.map((w, i) => (
            <div key={w.id} style={{
              display: 'grid', gridTemplateColumns: '0.8fr 1.5fr 1.5fr 1fr 1fr 0.6fr', gap: '10px', padding: '10px 14px', fontSize: '13px', alignItems: 'center', minWidth: '560px',
              borderBottom: i < wards.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{w.code ?? '—'}</span>
              <span>{w.name}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{w.ward_type ?? '—'}</span>
              <span>{w.bed_count}{w.capacity ? ` / ${w.capacity}` : ''}</span>
              <span>{w.daily_rate_xaf != null ? `${Number(w.daily_rate_xaf).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA` : '—'}</span>
              <span style={{ color: w.is_active ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}>{w.is_active ? '✓' : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
