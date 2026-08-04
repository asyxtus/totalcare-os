'use client'

// components/DispensingMasterDetail.tsx

import { useState, useMemo } from 'react'
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

const STATUS_META: Record<'review' | 'partial' | 'pending', { fr: string; en: string; bg: string; text: string }> = {
  review:  { fr: 'Révision',  en: 'Review',  bg: 'var(--color-critical-bg)', text: 'var(--color-critical-text)' },
  partial: { fr: 'Partiel',   en: 'Partial', bg: 'var(--color-info-bg, #DCEBF5)', text: 'var(--color-info-text, #2A6D9E)' },
  pending: { fr: 'En attente', en: 'Pending', bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
}

function statusOf(rx: QueuePrescription): 'review' | 'partial' | 'pending' {
  if (rx.requires_review) return 'review'
  if (rx.status === 'partially_dispensed') return 'partial'
  return 'pending'
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

  // Groups prescriptions under one header per patient (by patient_code —
  // already unique per patient, no server change needed to get a real
  // patient id). A patient with several separate prescriptions — common
  // for an admitted patient, since inpatient prescriptions are sent to
  // pharmacy one medication at a time — previously repeated their name
  // once per prescription card with no visual link between them.
  // Grouping is purely visual: each prescription row still maps 1:1 to
  // the existing selection/detail behavior, nothing about how dispensing
  // itself works changes.
  const groups = useMemo(() => {
    const map = new Map<string, QueuePrescription[]>()
    for (const rx of prescriptions) {
      const key = rx.patient_code || rx.patient_name
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(rx)
    }
    return Array.from(map.values())
  }, [prescriptions])

  if (prescriptions.length === 0) {
    return <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucune ordonnance en attente.':'No pending prescriptions.'}</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {groups.map((group) => {
          const first = group[0]
          const totalRemaining = group.reduce(
            (sum, rx) => sum + rx.items.filter((it) => it.quantity_dispensed < it.quantity_prescribed).length,
            0
          )
          // Most urgent status across the whole group wins the header badge —
          // a patient with one prescription needing review shouldn't look
          // like a routine "pending" case just because their other
          // prescription happens to be ordinary.
          const groupStatus: 'review' | 'partial' | 'pending' =
            group.some((rx) => statusOf(rx) === 'review') ? 'review'
            : group.some((rx) => statusOf(rx) === 'partial') ? 'partial'
            : 'pending'
          const meta = STATUS_META[groupStatus]

          return (
            <div key={first.patient_code || first.patient_name} style={{
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)', overflow: 'hidden',
            }}>
              {/* Patient header — shown once per patient, not once per
                  prescription */}
              <div style={{
                padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)',
                background: 'var(--color-bg)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                    {first.patient_name}
                  </p>
                  <span style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: '999px', flexShrink: 0,
                    background: meta.bg, color: meta.text,
                  }}>
                    {lang === 'fr' ? meta.fr : meta.en}
                  </span>
                </div>
                <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                  {first.patient_code} · {totalRemaining} {lang === 'fr' ? 'article(s) au total' : 'item(s) total'}
                  {group.length > 1 && ` · ${group.length} ${lang === 'fr' ? 'ordonnances' : 'prescriptions'}`}
                </p>
              </div>

              {/* One row per prescription within the group */}
              {group.map((rx) => {
                const remaining = rx.items.filter((it) => it.quantity_dispensed < it.quantity_prescribed).length
                const isSelected = rx.id === selectedId
                const rxMeta = STATUS_META[statusOf(rx)]
                return (
                  <button
                    key={rx.id}
                    onClick={() => setSelectedId(rx.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', cursor: 'pointer',
                      border: 'none', borderBottom: '1px solid var(--color-border-subtle)',
                      background: isSelected ? 'var(--color-success-bg)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                        {rx.id.slice(0, 8)}
                      </span>
                      {group.length > 1 && (
                        <span style={{ fontSize: '10px', color: rxMeta.text }}>
                          {lang === 'fr' ? rxMeta.fr : rxMeta.en}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                      {remaining} article{remaining !== 1 ? 's' : ''} · {rx.prescribing_doctor_name}
                    </p>
                  </button>
                )
              })}
            </div>
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
