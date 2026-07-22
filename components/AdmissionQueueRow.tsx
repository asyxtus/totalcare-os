'use client'

// components/AdmissionQueueRow.tsx

import { useState } from 'react'
import AssignBedForm from '@/components/AssignBedForm'
import { useLang } from '@/lib/i18n/LangContext'

interface Ward { id: string; name: string; beds: { id: string; bed_number: string }[] }
interface Admission {
  id: string
  admission_number: string
  patient_name: string
  source: string
  admission_reason: string | null
  recommended_at: string
}

export default function AdmissionQueueRow({ admission, wards }: { admission: Admission; wards: Ward[] }) {
  const lang = useLang()
  const [assigning, setAssigning] = useState(false)

  return (
    <div style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1.5fr 1fr 1fr', gap: '10px', padding: '12px 14px', alignItems: 'center', fontSize: '13px', minWidth: '580px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{admission.admission_number}</span>
        <div>
          <div>{admission.patient_name}</div>
          {admission.admission_reason && <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{admission.admission_reason}</div>}
        </div>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{admission.source}</span>
        <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '999px', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', textAlign: 'center' }}>
          En attente de lit
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{new Date(admission.recommended_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</span>
        <button onClick={() => setAssigning((a) => !a)} style={{
          fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
        }}>
          Assigner un lit
        </button>
      </div>
      {assigning && <AssignBedForm admissionId={admission.id} wards={wards} onDone={() => setAssigning(false)} />}
    </div>
  )
}
