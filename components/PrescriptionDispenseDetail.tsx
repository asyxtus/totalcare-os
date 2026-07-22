'use client'

// components/PrescriptionDispenseDetail.tsx
import DispenseItemForm from '@/components/DispenseItemForm'
import ApproveReviewForm from '@/components/ApproveReviewForm'
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
  alternatives?: { product_id: string; name: string; dosage_form?: string | null; on_hand: number; sale_price_xaf: number }[]
}

interface Prescription {
  id: string
  requires_review: boolean
  patient_name: string
  patient_code: string
  allergies: string | null
  prescribing_doctor_name: string
}

export default function PrescriptionDispenseDetail({
  prescription, items, staffOptions, currentStaffRole,
}: {
  prescription: Prescription
  items: Item[]
  staffOptions: { id: string; full_name: string }[]
  currentStaffRole: string
}) {
  const lang = useLang()
  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>{prescription.patient_name}</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
          {prescription.patient_code} · {lang==='fr'?'Prescrit par':'Prescribed by'} {prescription.prescribing_doctor_name}
        </p>
      </div>

      {prescription.allergies && (
        <div style={{
          background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px', fontWeight: 500,
        }}>
          {lang==='fr'?'⚠ Allergies :':'⚠ Allergies:'} {prescription.allergies}
        </div>
      )}

      {prescription.requires_review ? (
        <div style={{
          background: 'var(--color-warning-bg)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-warning-text)', margin: '0 0 8px' }}>
            {lang==='fr'?'Cette ordonnance contient une substance contrôlée et doit être approuvée par un':'This prescription contains a controlled substance and must be approved by a'}
            {lang==='fr'?'administrateur avant toute dispensation.':'administrator before any dispensing.'}
          </p>
          {currentStaffRole === 'admin' ? (
            <ApproveReviewForm prescriptionId={prescription.id} />
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {lang==='fr'?"En attente d'approbation par un administrateur.":'Awaiting approval from an administrator.'}
            </p>
          )}
        </div>
      ) : (
        <div>
          {items.map((item) => {
            const remaining = item.quantity_prescribed - item.quantity_dispensed
            const isFullyDispensed = remaining <= 0
            return (
              <div key={item.id} style={{
                background: 'var(--color-surface)',
                border: item.is_controlled ? '1px solid var(--color-compliance-gold, var(--color-warning-text))' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '10px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 500, margin: 0 }}>
                      {item.product_name ?? item.drug_name_freetext}
                      {item.is_controlled && (
                        <span style={{ fontSize: '10px', marginLeft: '8px', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>
                          {lang==='fr'?'CONTRÔLÉE':'CONTROLLED'}
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                      {[item.dose, item.frequency, item.duration_days ? lang==='fr'?`${item.duration_days} jours`:`${item.duration_days} days` : null].filter(Boolean).join(' — ')}
                    </p>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {item.quantity_dispensed}/{item.quantity_prescribed} {lang==='fr'?'dispensé':'dispensed'}
                  </span>
                </div>

                {isFullyDispensed ? (
                  <p style={{ fontSize: '13px', color: 'var(--color-success-text)', margin: 0 }}>{lang==='fr'?'✓ Entièrement dispensé':'✓ Fully dispensed'}</p>
                ) : (
                  <DispenseItemForm
                    prescriptionId={prescription.id}
                    itemId={item.id}
                    remaining={remaining}
                    isControlled={item.is_controlled}
                    needsManualPrice={!item.product_id}
                    staffOptions={staffOptions}
                    onHand={item.product_id ? item.on_hand : undefined}
                    salePriceXaf={item.sale_price_xaf ?? undefined}
                    alternatives={item.alternatives ?? []}
                  />
                )}
              </div>
            )
          })}
          {/* Total dispensing cost — cashier needs this to set up the invoice */}
          {(() => {
            const total = items
              .filter(i => i.sale_price_xaf)
              .reduce((sum, i) => sum + (i.sale_price_xaf! * i.quantity_prescribed), 0)
            if (total === 0) return null
            return (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', marginTop: '8px',
                background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
              }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {lang === 'fr' ? 'Total ordonnance (indicatif)' : 'Prescription total (indicative)'}
                </span>
                <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                  {total.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
                </span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
