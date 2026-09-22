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
      <div style={{
        position: 'sticky',
        top: '-18px',
        zIndex: 3,
        margin: '-18px -18px 14px',
        padding: '16px 18px 13px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '18px', fontWeight: 650, margin: 0, color: 'var(--color-text-primary)' }}>
              {prescription.patient_name}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
              {prescription.patient_code} · Rx {prescription.id.slice(0, 8)}
            </p>
          </div>
          <span style={{
            fontSize: '10px', padding: '4px 8px', borderRadius: '999px',
            background: prescription.requires_review ? 'var(--color-critical-bg)' : 'var(--color-success-bg)',
            color: prescription.requires_review ? 'var(--color-critical-text)' : 'var(--color-success-text)',
            flexShrink: 0,
          }}>
            {prescription.requires_review
              ? (lang === 'fr' ? 'Révision requise' : 'Review required')
              : (lang === 'fr' ? 'À dispenser' : 'Ready to dispense')}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '7px',
          marginTop: '11px',
        }}>
          <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)' }}>
            <div style={{ fontSize: '9px', color: 'var(--color-text-secondary)' }}>
              {lang === 'fr' ? 'Prescripteur' : 'Prescriber'}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 550, marginTop: '2px' }}>
              {prescription.prescribing_doctor_name}
            </div>
          </div>
          <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)' }}>
            <div style={{ fontSize: '9px', color: 'var(--color-text-secondary)' }}>
              {lang === 'fr' ? 'Médicaments' : 'Medications'}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 550, marginTop: '2px' }}>
              {items.length} {lang === 'fr' ? (items.length === 1 ? 'article' : 'articles') : (items.length === 1 ? 'item' : 'items')}
            </div>
          </div>
        </div>
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
          {/* Remaining medication value — only the quantity still outstanding is included.
              Actual dispensing charges are created from the quantity the pharmacist enters. */}
          {(() => {
            const remainingTotal = items
              .filter(i => i.sale_price_xaf)
              .reduce((sum, i) => sum + (i.sale_price_xaf! * Math.max(0, i.quantity_prescribed - i.quantity_dispensed)), 0)
            if (remainingTotal === 0) return null
            return (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', marginTop: '8px',
                background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
              }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {lang === 'fr' ? 'Valeur restante à dispenser' : 'Remaining value to dispense'}
                </span>
                <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                  {remainingTotal.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
                </span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
