'use client'

// components/DispensingMasterDetail.tsx

import { useState } from 'react'
import PrescriptionDispenseDetail from '@/components/PrescriptionDispenseDetail'
import { useLang } from '@/lib/i18n/LangContext'

interface Item {
  id: string
  product_id: string | null
  drug_name_freetext: string | null
  dose: string | null
  frequency: string | null
  duration_days: number | null
  quantity_prescribed: number
  quantity_dispensed: number
  product_name: string | null
  sale_price_xaf: number | null
  is_controlled: boolean
  on_hand: number | undefined
}

interface QueuePrescription {
  id: string
  requires_review: boolean
  status: string
  patient_name: string
  patient_code: string
  allergies: string | null
  prescribing_doctor_name: string
  items: Item[]
}

export default function DispensingMasterDetail({
  prescriptions, staffOptions, currentStaffRole,
}: {
  prescriptions: QueuePrescription[]
  staffOptions: { id: string; full_name: string }[]
  currentStaffRole: string
}) {
  const lang = useLang()
  const [selectedId, setSelectedId] = useState<string | null>(prescriptions[0]?.id ?? null)

  const selected = prescriptions.find((p) => p.id === selectedId) ?? null

  if (prescriptions.length === 0) {
    return <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucune ordonnance en attente.':'No pending prescriptions.'}</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {prescriptions.map((rx) => {
          const remaining = rx.items.filter((it) => it.quantity_dispensed < it.quantity_prescribed).length
          const isSelected = rx.id === selectedId
          const isPartial = rx.status === 'partially_dispensed'
          return (
            <button
              key={rx.id}
              onClick={() => setSelectedId(rx.id)}
              style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                border: isSelected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: isSelected ? 'var(--color-success-bg)' : 'var(--color-surface)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                  {rx.id.slice(0, 8)}
                </span>
                <span style={{
                  fontSize: '10px', padding: '2px 8px', borderRadius: '999px',
                  background: rx.requires_review ? 'var(--color-critical-bg)' : isPartial ? 'var(--color-info-bg, #DCEBF5)' : 'var(--color-warning-bg)',
                  color: rx.requires_review ? 'var(--color-critical-text)' : isPartial ? 'var(--color-info-text, #2A6D9E)' : 'var(--color-warning-text)',
                }}>
                  {rx.requires_review ? 'Révision' : isPartial ? 'Partiel' : 'En attente'}
                </span>
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 2px', color: 'var(--color-text-primary)' }}>{rx.patient_name}</p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                {remaining} article{remaining !== 1 ? 's' : ''}
              </p>
            </button>
          )
        })}
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
        {selected ? (
          <PrescriptionDispenseDetail
            prescription={selected}
            items={selected.items}
            staffOptions={staffOptions}
            currentStaffRole={currentStaffRole}
          />
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Sélectionnez une ordonnance à gauche.':'Select a prescription on the left.'}</p>
        )}
      </div>
    </div>
  )
}
