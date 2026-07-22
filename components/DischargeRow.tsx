'use client'

// components/DischargeRow.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { dischargePatientAction } from '@/lib/actions/admissions'
import { useLang } from '@/lib/i18n/LangContext'

interface Admission { id: string; admission_number: string; patient_name: string; ward_name: string; bed_number: string }

const DISCHARGE_TYPES = [
  { value: 'routine', fr: 'Routine', en: 'Routine' },
  { value: 'transfer_out', fr: 'Transfert vers un autre établissement', en: 'Transfer to another facility' },
  { value: 'against_medical_advice', fr: 'Contre avis médical', en: 'Against medical advice' },
  { value: 'deceased', fr: 'Décès', en: 'Deceased' },
]

export default function DischargeRow({ admission, startExpanded = false, hideHeader = false }: { admission: Admission; startExpanded?: boolean; hideHeader?: boolean }) {
  const lang = useLang()
  const router = useRouter()
  const [discharging, setDischarging] = useState(startExpanded)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    fontSize: '12px', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await dischargePatientAction(admission.id, formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div>
      {!hideHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontSize: '13px' }}>
          <span>{admission.patient_name} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>({admission.admission_number})</span></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>{admission.ward_name} — Lit {admission.bed_number}</span>
            <button onClick={() => setDischarging((d) => !d)} style={{
              fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
              background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}>
              Sortie
            </button>
          </span>
        </div>
      )}
      {discharging && (
        <form action={handleSubmit} style={{ padding: '0 14px 12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select name="discharge_type" style={inputStyle}>
            {DISCHARGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t[lang]}</option>)}
          </select>
          <input name="outcome" placeholder={lang === "fr" ? "Résultat (optionnel)" : "Outcome (optional)"} style={{ ...inputStyle, width: '140px' }} />
          <input
            name="discharge_summary" placeholder={lang === "fr" ? "Résumé de sortie (obligatoire)" : "Discharge summary (required)"} required
            style={{ ...inputStyle, flex: 1, minWidth: '160px' }}
          />
          <button type="submit" disabled={submitting} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
            {submitting ? '…' : (lang === 'fr' ? 'Confirmer la sortie' : 'Confirm discharge')}
          </button>
          {error && <span style={{ fontSize: '11px', color: 'var(--color-critical-text)', width: '100%' }}>{error}</span>}
        </form>
      )}
    </div>
  )
}
