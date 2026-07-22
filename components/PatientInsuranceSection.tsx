'use client'

// components/PatientInsuranceSection.tsx

import { useState } from 'react'
import { addPatientInsuranceAction } from '@/lib/actions/insurance'
import { useLang } from '@/lib/i18n/LangContext'

interface Insurance {
  id: string; policy_number: string; policyholder_name: string | null
  insurer_name: string; payer_type: string; coverage_percentage: number
}
interface InsurerOption { id: string; name: string; payer_type: string }

export default function PatientInsuranceSection({
  patientId, activeInsurance, allInsurers, onSuccess,
}: {
  patientId: string
  activeInsurance: Insurance | null
  allInsurers: InsurerOption[]
  onSuccess: () => void
}) {
  const lang = useLang()
  const PAYER_TYPE_LABELS: Record<string, string> = {
    private_insurance: lang==='fr'?'Assurance privée':'Private insurance',
    employer_scheme: lang==='fr'?'Régime employeur':'Employer scheme',
    cnps: 'CNPS',
  }
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await addPatientInsuranceAction(patientId, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      setOpen(false)
      onSuccess()
    }
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 6px' }}>{lang==='fr'?'Couverture':'Coverage'}</p>
          {activeInsurance ? (
            <>
              <p style={{ fontSize: '13px', margin: '0 0 2px' }}>
                {activeInsurance.insurer_name} · {PAYER_TYPE_LABELS[activeInsurance.payer_type]} · {activeInsurance.coverage_percentage}% couvert
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                Police n° {activeInsurance.policy_number}
                {activeInsurance.policyholder_name ? ` · Titulaire : ${activeInsurance.policyholder_name}` : ''}
              </p>
            </>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{lang==='fr'?'Aucune couverture — patient en comptant.':'No coverage — cash patient.'}</p>
          )}
        </div>
        <button onClick={() => setOpen((o) => !o)} style={{
          fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
          background: 'none', color: 'var(--color-text-primary)', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          {activeInsurance ? 'Changer' : '+ Ajouter'}
        </button>
      </div>

      {open && (
        <form action={handleSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)' }}>
          <select name="insurer_id" required style={inputStyle} defaultValue="">
            <option value="" disabled>{lang==="fr"?"Assureur…":"Insurer…"}</option>
            {allInsurers.map((i) => <option key={i.id} value={i.id}>{i.name} ({PAYER_TYPE_LABELS[i.payer_type]})</option>)}
          </select>
          <input name="policy_number" placeholder={lang==="fr"?"N° de police":"Policy no."} required style={inputStyle} />
          <input name="policyholder_name" placeholder={lang==="fr"?"Titulaire (si différent)":"Policyholder (if different)"} style={inputStyle} />
          <button type="submit" disabled={submitting} style={{
            fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
          }}>
            {submitting ? '…' : 'Confirmer'}
          </button>
          {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', width: '100%', margin: 0 }}>{error}</p>}
        </form>
      )}
    </div>
  )
}
