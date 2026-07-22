'use client'

// components/AdmissionListRow.tsx

import { useState } from 'react'
import Link from 'next/link'
import AssignBedForm from '@/components/AssignBedForm'
import TransferForm from '@/components/TransferForm'
import DischargeRow from '@/components/DischargeRow'
import { useLang } from '@/lib/i18n/LangContext'

interface Ward { id: string; name: string; beds: { id: string; bed_number: string }[] }
interface Admission {
  id: string
  admission_number: string
  patient_name: string
  source: string
  ward_name: string | null
  bed_number: string | null
  status: string
  recommended_at: string
}

const STATUS_LABELS: Record<string, { fr: string; en: string; bg: string; text: string }> = {
  awaiting_bed: { fr: 'En attente de lit', en: 'Awaiting bed', bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
  admitted: { fr: 'Admis', en: 'Admitted', bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
  discharged: { fr: 'Sorti', en: 'Discharged', bg: 'var(--color-bg)', text: 'var(--color-text-secondary)' },
  cancelled: { fr: 'Annulé', en: 'Cancelled', bg: 'var(--color-bg)', text: 'var(--color-text-secondary)' },
}

export default function AdmissionListRow({ admission, wards }: { admission: Admission; wards: Ward[] }) {
  const lang = useLang()
  const [mode, setMode] = useState<'none' | 'assign' | 'transfer' | 'discharge'>('none')
  const status = STATUS_LABELS[admission.status] ?? STATUS_LABELS.discharged

  return (
    <div style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr 1.3fr 1fr 1.5fr', gap: '10px', padding: '12px 14px', alignItems: 'center', fontSize: '13px', minWidth: '760px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{admission.admission_number}</span>
        <span>{admission.patient_name}</span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{admission.source}</span>
        <span>{admission.ward_name ?? '—'}</span>
        <span>{admission.bed_number ?? '—'}</span>
        <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '999px', background: status.bg, color: status.text, textAlign: 'center' }}>
          {status[lang] ?? status.fr}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{new Date(admission.recommended_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</span>

        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          {admission.status === 'awaiting_bed' && (
            <button onClick={() => setMode((m) => m === 'assign' ? 'none' : 'assign')} style={{
              fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
            }}>
              Assigner un lit
            </button>
          )}
          {admission.status === 'admitted' && (
            <>
              <Link href={`/admissions/${admission.id}/care`} style={{
                fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', textDecoration: 'none',
              }}>
                Suivi
              </Link>
              <button onClick={() => setMode((m) => m === 'transfer' ? 'none' : 'transfer')} title={lang==='fr'?'Transférer':'Transfer'} style={{
                width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                background: mode === 'transfer' ? 'var(--color-accent)' : 'none',
                color: mode === 'transfer' ? 'var(--color-accent-text-on)' : 'var(--color-text-secondary)', cursor: 'pointer',
              }}>
                ⇄
              </button>
              <button onClick={() => setMode((m) => m === 'discharge' ? 'none' : 'discharge')} title={lang==="fr"?"Sortie":"Discharge"} style={{
                width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                background: mode === 'discharge' ? 'var(--color-accent)' : 'none',
                color: mode === 'discharge' ? 'var(--color-accent-text-on)' : 'var(--color-text-secondary)', cursor: 'pointer',
              }}>
                →
              </button>
            </>
          )}
        </div>
      </div>

      {mode === 'assign' && <AssignBedForm admissionId={admission.id} wards={wards} onDone={() => setMode('none')} />}
      {mode === 'transfer' && <TransferForm admissionId={admission.id} wards={wards} onDone={() => setMode('none')} />}
      {mode === 'discharge' && (
        <div style={{ padding: '0 14px 10px' }}>
          <DischargeRow
            startExpanded
            hideHeader
            admission={{
              id: admission.id, admission_number: admission.admission_number, patient_name: admission.patient_name,
              ward_name: admission.ward_name ?? '—', bed_number: admission.bed_number ?? '—',
            }}
          />
        </div>
      )}
    </div>
  )
}
