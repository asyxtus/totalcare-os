'use client'

// components/InlineEditProductPanel.tsx

import { useState } from 'react'
import { updateProduct } from '@/lib/actions/pharmacy'
import { useLang } from '@/lib/i18n/LangContext'

interface DrugClass { id: string; name_fr: string }
interface Product {
  product_id: string
  name: string
  barcode: string | null
  sale_price_xaf: number
  cost_price_xaf: number | null
  reorder_threshold: number
}

export default function InlineEditProductPanel({
  product, drugClasses, onDone,
}: {
  product: Product
  drugClasses: DrugClass[]
  onDone: () => void
}) {
  const lang = useLang()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '12px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await updateProduct(product.product_id, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      onDone()
    }
  }

  return (
    <form action={handleSubmit} style={{ padding: '10px 14px', background: 'var(--color-bg)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
        <input name="name" defaultValue={product.name} placeholder={lang==="fr"?"Nom *":"Name *"} required style={inputStyle} />
        <select name="drug_class_id" style={inputStyle} defaultValue="">
          <option value="">{lang==="fr"?"Classe thérapeutique":"Drug class"}</option>
          {drugClasses.map((d) => <option key={d.id} value={d.id}>{d.name_fr}</option>)}
        </select>
        <input name="barcode" defaultValue={product.barcode ?? ''} placeholder={lang==="fr"?"Code-barres":"Barcode"} style={inputStyle} />
        <input name="reorder_threshold" type="number" defaultValue={product.reorder_threshold} placeholder={lang==="fr"?"Seuil":"Threshold"} style={inputStyle} />
        <input name="cost_price_xaf" type="number" step="any" defaultValue={product.cost_price_xaf ?? ''} placeholder={lang==="fr"?"Coût (FCFA)":"Cost (FCFA)"} style={inputStyle} />
        <input name="sale_price_xaf" type="number" step="any" defaultValue={product.sale_price_xaf} placeholder="Prix de vente *" required style={inputStyle} />
      </div>
      {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', marginBottom: '6px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={submitting} style={{
          fontSize: '11px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
        }}>
          {submitting ? '…' : (lang === 'fr' ? 'Enregistrer' : 'Save')}
        </button>
        <button type="button" onClick={onDone} style={{
          fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
        }}>
          {lang === 'fr' ? 'Annuler' : 'Cancel'}
        </button>
      </div>
    </form>
  )
}
