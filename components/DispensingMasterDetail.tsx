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
  const [search, setSearch] = useState('')

  const selected = prescriptions.find((p) => p.id === selectedId) ?? null

  // The queue and detail panel scroll independently. This keeps the selected
  // prescription visible while the pharmacist searches a long queue.
  const groups = useMemo(() => {
    const query = search.trim().toLowerCase()
    const map = new Map<string, QueuePrescription[]>()

    for (const rx of prescriptions) {
      const haystack = [
        rx.patient_name,
        rx.patient_code,
        rx.prescribing_doctor_name,
        rx.id,
        ...rx.items.map((it) => it.product_name ?? it.drug_name_freetext ?? ''),
      ].join(' ').toLowerCase()

      if (query && !haystack.includes(query)) continue

      const key = rx.patient_code || rx.patient_name
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(rx)
    }

    return Array.from(map.values())
  }, [prescriptions, search])

  if (prescriptions.length === 0) {
    return <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucune ordonnance en attente.':'No pending prescriptions.'}</p>
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)',
      gap: '1rem',
      alignItems: 'start',
    }}>
      <section style={{ position: 'sticky', top: '12px', alignSelf: 'start', minWidth: 0 }}>
        <div style={{
          background: 'var(--color-bg)',
          paddingBottom: '8px',
        }}>
          <label htmlFor="dispensing-queue-search" style={{
            display: 'block', fontSize: '11px', fontWeight: 600,
            color: 'var(--color-text-secondary)', marginBottom: '5px',
          }}>
            {lang === 'fr' ? 'Rechercher une ordonnance' : 'Find a prescription'}
          </label>
          <input
            id="dispensing-queue-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'fr' ? 'Nom, code patient, médecin ou médicament…' : 'Patient, code, doctor or medicine…'}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 11px',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface)', color: 'var(--color-text-primary)',
              fontSize: '12px', outline: 'none',
            }}
          />
          <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '5px 2px 0' }}>
            {search
              ? groups.length + ' ' + (lang === 'fr' ? 'patient(s) trouvé(s)' : 'patient(s) found')
              : prescriptions.length + ' ' + (lang === 'fr' ? 'ordonnance(s) en attente' : 'prescription(s) waiting')}
          </p>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: '8px',
          maxHeight: 'calc(100vh - 190px)', overflowY: 'auto', paddingRight: '4px',
        }}>
          {groups.length === 0 ? (
            <div style={{
              padding: '16px 12px', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', background: 'var(--color-surface)',
              fontSize: '12px', color: 'var(--color-text-secondary)',
            }}>
              {lang === 'fr' ? 'Aucune correspondance.' : 'No matching prescriptions.'}
            </div>
          ) : groups.map((group) => {
            const first = group[0]
            const totalRemaining = group.reduce(
              (sum, rx) => sum + rx.items.filter((it) => it.quantity_dispensed < it.quantity_prescribed).length,
              0
            )
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
                <div style={{
                  padding: '9px 12px', borderBottom: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                      {first.patient_name}
                    </p>
                    <span style={{
                      fontSize: '10px', padding: '2px 7px', borderRadius: '999px', flexShrink: 0,
                      background: meta.bg, color: meta.text,
                    }}>
                      {lang === 'fr' ? meta.fr : meta.en}
                    </span>
                  </div>
                  <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                    {first.patient_code} · {totalRemaining} {lang === 'fr' ? 'article(s)' : 'item(s)'}
                    {group.length > 1 && ' · ' + group.length + ' ' + (lang === 'fr' ? 'ordonnances' : 'prescriptions')}
                  </p>
                </div>

                {group.map((rx) => {
                  const remaining = rx.items.filter((it) => it.quantity_dispensed < it.quantity_prescribed).length
                  const isSelected = rx.id === selectedId
                  const rxMeta = STATUS_META[statusOf(rx)]
                  return (
                    <button
                      key={rx.id}
                      onClick={() => setSelectedId(rx.id)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', cursor: 'pointer',
                        border: 'none', borderBottom: '1px solid var(--color-border-subtle)',
                        background: isSelected ? 'var(--color-success-bg)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          {rx.id.slice(0, 8)}
                        </span>
                        {group.length > 1 && (
                          <span style={{ fontSize: '9px', color: rxMeta.text }}>
                            {lang === 'fr' ? rxMeta.fr : rxMeta.en}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                        {remaining} {lang === 'fr' ? (remaining === 1 ? 'article' : 'articles') : (remaining === 1 ? 'item' : 'items')} · {rx.prescribing_doctor_name}
                      </p>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </section>

      <section style={{
        position: 'sticky', top: '12px', alignSelf: 'start', minWidth: 0,
        maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '1.25rem', boxSizing: 'border-box',
      }}>
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
      </section>
    </div>
  )
}
