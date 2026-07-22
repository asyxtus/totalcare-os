'use client'

// components/DispenseItemForm.tsx

import { useState } from 'react'
import { dispensePrescriptionItem } from '@/lib/actions/pharmacy'
import RequestDiscountButton from '@/components/RequestDiscountButton'
import { useLang } from '@/lib/i18n/LangContext'

interface StaffOption { id: string; full_name: string }
interface Alternative {
  product_id: string
  name: string
  dosage_form?: string | null
  on_hand: number
  sale_price_xaf: number
}

export default function DispenseItemForm({
  prescriptionId, itemId, remaining, isControlled, needsManualPrice, staffOptions,
  onHand, salePriceXaf, alternatives = [],
}: {
  prescriptionId: string
  itemId: string
  remaining: number
  isControlled: boolean
  needsManualPrice: boolean
  staffOptions: StaffOption[]
  onHand?: number
  salePriceXaf?: number
  alternatives?: Alternative[]
}) {
  const lang = useLang()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [dispensedChargeId, setDispensedChargeId] = useState<string | null>(null)
  // Product override — when pharmacist selects a different dosage
  const [overrideProductId, setOverrideProductId] = useState<string>('')

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  // The "effective" product for display: the override if selected, else the prescribed one
  const selectedAlt = alternatives.find(a => a.product_id === overrideProductId)
  const effectiveOnHand = selectedAlt?.on_hand ?? onHand
  const effectivePriceXaf = selectedAlt?.sale_price_xaf ?? salePriceXaf

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    // Inject the override product ID if the pharmacist selected one
    if (overrideProductId) formData.set('product_id_override', overrideProductId)
    const result = await dispensePrescriptionItem(prescriptionId, itemId, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      if (result?.serviceChargeId) setDispensedChargeId(result.serviceChargeId)
    }
  }

  const unitLabel = lang === 'fr' ? 'unité' : 'unit'
  const stockLabel = lang === 'fr' ? 'Disponible' : 'Available'

  return (
    <div>
      {/* Product selector — shown when there are alternatives with stock */}
      {alternatives.length > 1 && (
        <div style={{ marginBottom: '8px' }}>
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>
            {lang === 'fr'
              ? '⚠ Plusieurs dosages disponibles — sélectionnez ce que vous dispensez réellement :'
              : '⚠ Multiple dosages available — select what you are actually dispensing:'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {alternatives.map(alt => (
              <label key={alt.product_id} style={{
                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px',
                padding: '6px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: overrideProductId === alt.product_id
                  ? '1px solid var(--color-accent)'
                  : '1px solid var(--color-border)',
                background: overrideProductId === alt.product_id
                  ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)'
                  : 'var(--color-surface)',
              }}>
                <input
                  type="radio"
                  name={`product_override_${itemId}`}
                  value={alt.product_id}
                  checked={overrideProductId === alt.product_id}
                  onChange={() => setOverrideProductId(alt.product_id)}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <span style={{ fontWeight: 500 }}>{alt.name}</span>
                {alt.dosage_form && (
                  <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{alt.dosage_form}</span>
                )}
                <span style={{ color: alt.on_hand < remaining ? 'var(--color-critical-text)' : 'var(--color-text-secondary)', marginLeft: 'auto' }}>
                  {stockLabel}: {alt.on_hand} · {alt.sale_price_xaf.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA/{unitLabel}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Stock and price display for single product */}
      {(effectiveOnHand !== undefined || effectivePriceXaf !== undefined) && (
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
          {effectiveOnHand !== undefined && (
            <span style={{ color: effectiveOnHand < remaining ? 'var(--color-critical-text)' : 'var(--color-text-secondary)' }}>
              {stockLabel} : {effectiveOnHand}
            </span>
          )}
          {effectiveOnHand !== undefined && effectivePriceXaf !== undefined && ' · '}
          {effectivePriceXaf !== undefined && (
            <span>{effectivePriceXaf.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA/{unitLabel}</span>
          )}
        </p>
      )}

      <form action={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
        <input
          name="quantity"
          type="number"
          min={1}
          max={remaining}
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder={lang === 'fr' ? `Qté (max ${remaining})` : `Qty (max ${remaining})`}
          required
          style={{ ...inputStyle, width: '110px' }}
        />
        <button type="button" onClick={() => setQuantity(String(remaining))} style={{
          fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)', background: 'none',
          color: 'var(--color-text-secondary)', cursor: 'pointer',
        }}>
          {lang === 'fr' ? 'Totalité' : 'Full qty'}
        </button>

        {isControlled && (
          <select name="witness_id" required style={{ ...inputStyle, minWidth: '160px' }} defaultValue="">
            <option value="" disabled>
              {lang === 'fr' ? 'Témoin (requis)' : 'Witness (required)'}
            </option>
            {staffOptions.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        )}

        {needsManualPrice && (
          <input
            name="manual_unit_price_xaf"
            type="number"
            step="any"
            placeholder={lang === 'fr' ? 'Prix unitaire (FCFA)' : 'Unit price (FCFA)'}
            required
            style={{ ...inputStyle, width: '160px' }}
          />
        )}

        <input
          name="counseling_notes"
          placeholder={lang === 'fr' ? 'Conseils au patient (optionnel)' : 'Patient instructions (optional)'}
          style={{ ...inputStyle, flex: 1, minWidth: '180px' }}
        />

        <button type="submit" disabled={submitting} style={{
          fontSize: '13px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
          cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
        }}>
          {submitting ? '…' : (lang === 'fr' ? 'Dispenser' : 'Dispense')}
        </button>

        <a href={`/print/dispensing-labels/${itemId}`} target="_blank" rel="noopener noreferrer" style={{
          fontSize: '12px', padding: '7px 12px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', textDecoration: 'none',
        }}>
          {lang === 'fr' ? 'Étiquette' : 'Label'}
        </a>

        {error && (
          <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '4px 0 0', flexBasis: '100%' }}>
            {error}
          </p>
        )}
      </form>

      {dispensedChargeId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--color-success-text)' }}>
          <span>{lang === 'fr' ? '✓ Dispensé' : '✓ Dispensed'}</span>
          <RequestDiscountButton serviceChargeId={dispensedChargeId} />
        </div>
      )}
    </div>
  )
}
