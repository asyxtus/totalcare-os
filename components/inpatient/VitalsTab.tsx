'use client'

// components/inpatient/VitalsTab.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordVitalSignsAction } from '@/lib/actions/inpatientCare'
import { useLang } from '@/lib/i18n/LangContext'

const STR = {
  fr: {
    bpSys: 'TA systolique', bpDia: 'TA diastolique', hr: 'Fréq. cardiaque',
    temp: 'Température (°C)', rr: 'Fréq. respiratoire',
    notesPh: 'Notes (optionnel)', save: 'Enregistrer les signes vitaux',
    empty: 'Aucun signe vital enregistré.',
    date: 'Date', by: 'Par', locale: 'fr-FR', triage: 'Triage', inpatient: 'Hospitalisation',
  },
  en: {
    bpSys: 'BP systolic', bpDia: 'BP diastolic', hr: 'Heart rate',
    temp: 'Temperature (°C)', rr: 'Respiratory rate',
    notesPh: 'Notes (optional)', save: 'Record vital signs',
    empty: 'No vital signs recorded.',
    date: 'Date', by: 'By', locale: 'en-US', triage: 'Triage', inpatient: 'Inpatient',
  },
} as const

interface Vital {
  id: string; recorded_at: string; staff_name: string
  blood_pressure_systolic: number | null; blood_pressure_diastolic: number | null
  heart_rate: number | null; temperature_celsius: number | null
  respiratory_rate: number | null; oxygen_saturation: number | null; notes: string | null
  weight_kg?: number | null; height_cm?: number | null; source?: 'triage' | 'inpatient'
}

export default function VitalsTab({ admissionId, vitals }: { admissionId: string; vitals: Vital[] }) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', width: '100%', boxSizing: 'border-box',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await recordVitalSignsAction(admissionId, formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      router.refresh()
    }
  }

  return (
    <div>
      <form action={handleSubmit} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.bpSys}</label>
            <input name="bp_systolic" type="number" placeholder="120" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.bpDia}</label>
            <input name="bp_diastolic" type="number" placeholder="80" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.hr}</label>
            <input name="heart_rate" type="number" placeholder="72" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.temp}</label>
            <input name="temperature_celsius" type="number" step="0.1" placeholder="37.0" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.rr}</label>
            <input name="respiratory_rate" type="number" placeholder="16" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>SpO2 (%)</label>
            <input name="oxygen_saturation" type="number" placeholder="98" style={inputStyle} />
          </div>
        </div>
        <input name="notes" placeholder={t.notesPh} style={{ ...inputStyle, marginBottom: '8px' }} />
        {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{
          fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
        }}>
          {submitting ? '…' : t.save}
        </button>
      </form>

      {vitals.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t.empty}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.8fr 0.7fr 0.7fr 0.7fr 0.6fr 0.9fr 0.8fr', gap: '8px', padding: '8px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', minWidth: '680px' }}>
            <span>{t.date}</span><span>TA</span><span>FC</span><span>Temp</span><span>FR</span><span>SpO2</span><span>{t.by}</span><span></span>
          </div>
          {vitals.map((v, i) => (
            <div key={v.id} style={{
              display: 'grid', gridTemplateColumns: '1.3fr 0.8fr 0.7fr 0.7fr 0.7fr 0.6fr 0.9fr 0.8fr', gap: '8px', padding: '8px 14px', fontSize: '12px', minWidth: '680px',
              borderBottom: i < vitals.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <span>{new Date(v.recorded_at).toLocaleString(t.locale)}</span>
              <span>{v.blood_pressure_systolic && v.blood_pressure_diastolic ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}` : '—'}</span>
              <span>{v.heart_rate ?? '—'}</span>
              <span>{v.temperature_celsius ? `${v.temperature_celsius}°C` : '—'}</span>
              <span>{v.respiratory_rate ?? '—'}</span>
              <span>{v.oxygen_saturation ? `${v.oxygen_saturation}%` : '—'}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{v.staff_name}</span>
              <span>
                {v.source && (
                  <span style={{
                    fontSize: '10px', padding: '1px 7px', borderRadius: '999px',
                    background: v.source === 'triage' ? 'var(--color-accent)' : 'var(--color-bg)',
                    color: v.source === 'triage' ? 'var(--color-accent-text-on)' : 'var(--color-text-secondary)',
                  }}>
                    {v.source === 'triage' ? t.triage : t.inpatient}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
