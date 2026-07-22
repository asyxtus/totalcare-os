'use client'

// components/ShiftVarianceRow.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { reviewShiftVarianceAction } from '@/lib/actions/billing'
import { useLang } from '@/lib/i18n/LangContext'

interface Shift {
  id: string
  staff_name: string
  opening_cash_xaf: number
  closing_cash_xaf: number
  expected_cash_xaf: number
  variance_xaf: number
  closed_at: string
  notes: string | null
}

export default function ShiftVarianceRow({ shift }: { shift: Shift }) {
  const lang = useLang()
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    const result = await reviewShiftVarianceAction(shift.id, notes)
    if (result?.error) { setError(result.error); setSubmitting(false) }
    else router.refresh()
  }

  const varianceColor = Math.abs(shift.variance_xaf) > 0 ? 'var(--color-critical-text)' : 'var(--color-success-text)'

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{shift.staff_name}</p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>{new Date(shift.closed_at).toLocaleString(lang==='fr'?'fr-FR':'en-US')}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '10px', fontSize: '12px' }}>
        <div><span style={{ color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Ouverture':'Opening'}</span><br />{Number(shift.opening_cash_xaf).toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA</div>
        <div><span style={{ color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Attendu':'Expected'}</span><br />{Number(shift.expected_cash_xaf).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA</div>
        <div><span style={{ color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Compté':'Counted'}</span><br />{Number(shift.closing_cash_xaf).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA</div>
        <div><span style={{ color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Écart':'Variance'}</span><br /><strong style={{ color: varianceColor }}>{Number(shift.variance_xaf).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA</strong></div>
      </div>
      {shift.notes && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>{lang === 'fr' ? 'Notes de clôture' : 'Closing notes'} : {shift.notes}</p>}

      {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={lang==="fr"?"Notes d'examen (obligatoire)":"Review notes (required)"}
          style={{ fontSize: '12px', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', flex: 1 }}
        />
        <button onClick={handleSubmit} disabled={submitting || !notes.trim()} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
          Marquer examiné
        </button>
      </div>
    </div>
  )
}
