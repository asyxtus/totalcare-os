'use client'

// components/InventoryTableRow.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n/LangContext'
import InlineAdjustPanel from '@/components/InlineAdjustPanel'
import InlineEditProductPanel from '@/components/InlineEditProductPanel'
import { toggleProductActive } from '@/lib/actions/pharmacy'

interface DrugClass { id: string; name_fr: string; name_en?: string; is_antibiotic?: boolean }
interface Product {
  product_id: string
  sku: string | null
  name: string
  dosage_form?: string | null   // e.g. "500mg", "250mg/5ml", "10mg/tab"
  drug_class_name: string | null
  drug_class_id?: string | null
  is_antibiotic?: boolean
  barcode: string | null
  sale_price_xaf: number
  cost_price_xaf: number | null
  reorder_threshold: number
  is_active: boolean
  on_hand: number
}

export default function InventoryTableRow({ product, drugClasses }: { product: Product; drugClasses: DrugClass[] }) {
  const lang = useLang()
  const router = useRouter()
  const [mode, setMode] = useState<'none' | 'adjust' | 'edit'>('none')
  const [togglingActive, setTogglingActive] = useState(false)

  const isOut = product.on_hand === 0
  const isLow = !isOut && product.on_hand < product.reorder_threshold

  const status = isOut
    ? { fr: 'Épuisé', en: 'Out',  bg: 'var(--color-critical-bg)', text: 'var(--color-critical-text)' }
    : isLow
    ? { fr: 'Faible', en: 'Low',  bg: 'var(--color-warning-bg)',  text: 'var(--color-warning-text)' }
    : { fr: 'OK',     en: 'OK',   bg: 'var(--color-success-bg)',  text: 'var(--color-success-text)' }

  const stockColor = isOut
    ? 'var(--color-critical-text)'
    : isLow ? 'var(--color-warning-text)' : 'var(--color-text-primary)'

  async function handleToggleActive() {
    setTogglingActive(true)
    await toggleProductActive(product.product_id, product.is_active)
    router.refresh()
  }

  const iconBtn = (active: boolean): React.CSSProperties => ({
    width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    border: '1px solid var(--color-border)', background: active ? 'var(--color-accent)' : 'none',
    color: active ? 'var(--color-accent-text-on)' : 'var(--color-text-secondary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
  })

  return (
    <div style={{ borderBottom: '1px solid var(--color-border-subtle)', opacity: product.is_active ? 1 : 0.5 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '0.6fr 2.2fr 1.4fr 1fr 1fr 0.7fr 1.2fr',
        gap: '10px', padding: '10px 14px', alignItems: 'center', minWidth: '640px',
      }}>
        {/* SKU */}
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
          {product.sku ?? '—'}
        </span>

        {/* Name + dosage + barcode */}
        <div>
          <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {product.name}
            {/* Antibiotic badge — important for stewardship visibility */}
            {product.is_antibiotic && (
              <span style={{
                fontSize: '9px', padding: '1px 5px', borderRadius: '999px',
                background: 'color-mix(in srgb, var(--color-warning-text) 12%, transparent)',
                color: 'var(--color-warning-text)', fontWeight: 700, letterSpacing: '0.04em',
              }}>
                {lang === 'fr' ? 'ANTIBIOTIQUE' : 'ANTIBIOTIC'}
              </span>
            )}
          </div>
          {/* Dosage form is the key clinical identifier — what distinguishes
              Amoxicillin 250mg caps from Amoxicillin 500mg caps or 125mg/5ml susp */}
          {product.dosage_form && (
            <div style={{ fontSize: '11px', color: 'var(--color-accent)', marginTop: '1px', fontWeight: 500 }}>
              {product.dosage_form}
            </div>
          )}
          {product.barcode && (
            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
              {product.barcode}
            </div>
          )}
        </div>

        {/* Drug class */}
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
          {product.drug_class_name ?? '—'}
        </span>

        {/* Stock / threshold — tooltip explains what the numbers mean */}
        <div title={lang === 'fr' ? `Stock actuel / Seuil de réapprovisionnement` : `Current stock / Reorder threshold`}>
          <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: stockColor, fontWeight: isOut || isLow ? 600 : 400 }}>
            {product.on_hand}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {' '}/ {product.reorder_threshold}
          </span>
          {(isOut || isLow) && (
            <div style={{ fontSize: '10px', color: stockColor, marginTop: '1px' }}>
              {isOut
                ? (lang === 'fr' ? 'Commander' : 'Reorder')
                : (lang === 'fr' ? `Seuil: ${product.reorder_threshold}` : `Min: ${product.reorder_threshold}`)}
            </div>
          )}
        </div>

        {/* Price */}
        <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
          {product.sale_price_xaf.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
        </span>

        {/* Status */}
        <span style={{
          fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
          background: status.bg, color: status.text, textAlign: 'center',
        }}>
          {lang === 'fr' ? status.fr : status.en}
        </span>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setMode((m) => m === 'edit' ? 'none' : 'edit')}
            title={lang === 'fr' ? 'Modifier le produit' : 'Edit product'}
            style={iconBtn(mode === 'edit')}
          >
            ✎
          </button>
          <button
            onClick={() => setMode((m) => m === 'adjust' ? 'none' : 'adjust')}
            title={lang === 'fr'
              ? 'Ajuster le stock — corriger une erreur de comptage ou un écart physique'
              : 'Adjust stock — correct a counting error or physical discrepancy'}
            style={iconBtn(mode === 'adjust')}
          >
            ⇄
          </button>
          <button
            onClick={handleToggleActive}
            disabled={togglingActive}
            title={product.is_active
              ? (lang === 'fr' ? 'Désactiver ce produit' : 'Deactivate product')
              : (lang === 'fr' ? 'Réactiver ce produit' : 'Reactivate product')}
            style={iconBtn(false)}
          >
            {product.is_active ? '⏻' : '○'}
          </button>
        </div>
      </div>

      {/* Stock adjustment panel — shown inline when ⇄ is clicked */}
      {mode === 'adjust' && (
        <div style={{ padding: '0 14px 12px' }}>
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px',
          }}>
            {lang === 'fr'
              ? '⇄ Ajustement de stock — utilisez + Augmenter pour ajouter des unités manquantes après un inventaire physique, ou − Diminuer pour retirer des unités abîmées, périmées ou perdues. Un motif est obligatoire. Chaque ajustement est tracé dans le journal d\'audit.'
              : '⇄ Stock adjustment — use + Increase to add units found during a physical count, or − Decrease to remove damaged, expired, or lost units. A reason is required. Every adjustment is recorded in the audit log.'}
          </div>
          <InlineAdjustPanel productId={product.product_id} onDone={() => { setMode('none'); router.refresh() }} />
        </div>
      )}
      {mode === 'edit' && (
        <InlineEditProductPanel product={product} drugClasses={drugClasses} onDone={() => { setMode('none'); router.refresh() }} />
      )}
    </div>
  )
}
