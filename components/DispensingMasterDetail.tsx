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
    <div className="dispensing-master-detail" style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(300px, 360px) minmax(0, 1fr)',
      gap: '14px',
      height: 'calc(100vh - 155px)',
      minHeight: '560px',
      alignItems: 'stretch',
    }}>
      <style>{`
        .dispensing-queue-panel { min-height: 0; }
        .dispensing-queue-list { scrollbar-width: thin; }
        .dispensing-detail-panel { min-height: 0; }
        @media (max-width: 900px) {
          .dispensing-master-detail {
            grid-template-columns: 1fr !important;
            height: auto !important;
            min-height: 0 !important;
          }
          .dispensing-queue-panel {
            height: 420px !important;
          }
          .dispensing-detail-panel {
            height: auto !important;
            max-height: none !important;
          }
        }
      `}</style>

      <section className="dispensing-queue-panel" style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: '100%',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}>
        <div style={{
          flex: '0 0 auto',
          padding: '13px',
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 650, color: 'var(--color-text-primary)' }}>
                {lang === 'fr' ? 'File de dispensation' : 'Dispensing queue'}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                {search
                  ? groups.length + ' ' + (lang === 'fr' ? 'patient(s) trouvé(s)' : 'patient(s) found')
                  : prescriptions.length + ' ' + (lang === 'fr' ? 'ordonnance(s) en attente' : 'prescription(s) waiting')}
              </p>
            </div>
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '4px 7px',
              borderRadius: '999px', background: 'var(--color-warning-bg)',
              color: 'var(--color-warning-text)', whiteSpace: 'nowrap',
            }}>
              {lang === 'fr' ? 'À traiter' : 'To dispense'}
            </span>
          </div>

          <input
            id="dispensing-queue-search"
            aria-label={lang === 'fr' ? 'Rechercher une ordonnance' : 'Find a prescription'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'fr' ? 'Nom, code patient, médecin ou médicament…' : 'Patient, code, doctor or medicine…'}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 11px',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg)', color: 'var(--color-text-primary)',
              fontSize: '12px', outline: 'none',
            }}
          />
        </div>

        <div className="dispensing-queue-list" style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '7px',
        }}>
          {groups.length === 0 ? (
            <div style={{
              padding: '18px 12px',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg)',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
            }}>
              {lang === 'fr' ? 'Aucune ordonnance correspondante.' : 'No matching prescriptions.'}
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
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                overflow: 'hidden',
                flex: '0 0 auto',
              }}>
                <div style={{
                  padding: '10px 11px',
                  background: 'var(--color-bg)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        fontSize: '12px', fontWeight: 650, margin: 0,
                        color: 'var(--color-text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {first.patient_name}
                      </p>
                      <p style={{
                        fontSize: '9px', fontFamily: 'var(--font-mono)',
                        color: 'var(--color-text-secondary)', margin: '3px 0 0',
                      }}>
                        {first.patient_code}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '9px', padding: '3px 7px', borderRadius: '999px',
                      flexShrink: 0, background: meta.bg, color: meta.text,
                    }}>
                      {lang === 'fr' ? meta.fr : meta.en}
                    </span>
                  </div>
                </div>

                {group.map((rx) => {
                  const remainingItems = rx.items.filter((it) => it.quantity_dispensed < it.quantity_prescribed)
                  const isSelected = rx.id === selectedId
                  const rxMeta = STATUS_META[statusOf(rx)]
                  const itemNames = rx.items.map((it) => it.product_name ?? it.drug_name_freetext ?? 'Medication')
                  return (
                    <button
                      key={rx.id}
                      type="button"
                      onClick={() => setSelectedId(rx.id)}
                      aria-pressed={isSelected}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 11px',
                        cursor: 'pointer',
                        border: 'none',
                        borderTop: '1px solid var(--color-border-subtle)',
                        background: isSelected ? 'var(--color-success-bg)' : 'var(--color-surface)',
                        boxShadow: isSelected ? 'inset 3px 0 0 var(--color-accent)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          Rx {rx.id.slice(0, 8)}
                        </span>
                        <span style={{ fontSize: '9px', color: rxMeta.text }}>
                          {lang === 'fr' ? rxMeta.fr : rxMeta.en}
                        </span>
                      </div>

                      <p style={{
                        fontSize: '11px', fontWeight: 550,
                        color: 'var(--color-text-primary)', margin: '5px 0 3px',
                        lineHeight: 1.35,
                      }}>
                        {itemNames.slice(0, 2).join(' · ')}
                        {itemNames.length > 2 ? ' +' + (itemNames.length - 2) : ''}
                      </p>

                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        gap: '8px', fontSize: '9px', color: 'var(--color-text-secondary)',
                      }}>
                        <span>
                          {remainingItems.length} {lang === 'fr'
                            ? (remainingItems.length === 1 ? 'article restant' : 'articles restants')
                            : (remainingItems.length === 1 ? 'item remaining' : 'items remaining')}
                        </span>
                        <span>{rx.prescribing_doctor_name}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </section>

      <section className="dispensing-detail-panel" style={{
        height: '100%',
        minWidth: 0,
        overflowY: 'auto',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '18px',
        boxSizing: 'border-box',
      }}>
        {selected ? (
          <PrescriptionDispenseDetail
            prescription={selected}
            items={selected.items}
            staffOptions={staffOptions}
            currentStaffRole={currentStaffRole}
          />
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {lang === 'fr' ? 'Sélectionnez une ordonnance à gauche.' : 'Select a prescription on the left.'}
          </p>
        )}
      </section>
    </div>
  )
}
