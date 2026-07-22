'use client'

// components/ProductForm.tsx

import { useState } from 'react'
import { createProduct } from '@/lib/actions/pharmacy'
import { useLang } from '@/lib/i18n/LangContext'

interface DrugClass { id: string; name_fr: string }

export default function ProductForm({ drugClasses }: { drugClasses: DrugClass[] }) {
  const lang = useLang()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '100%',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await createProduct(formData)
    if (result?.error) setError(result.error)
    else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    }
    setSubmitting(false)
  }

  return (
    <form action={handleSubmit} style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 10px' }}>{lang==='fr'?'Nouveau produit':'New product'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <input name="name" placeholder={lang==="fr"?"Nom du produit *":"Product name *"} required style={inputStyle} />
        <input name="name_fr" placeholder={lang==="fr"?"Nom (français, si différent)":"Name (French, if different)"} style={inputStyle} />
        <select name="drug_class_id" style={inputStyle} defaultValue="">
          <option value="">{lang==="fr"?"Classe thérapeutique (optionnel)":"Drug class (optional)"}</option>
          {drugClasses.map((d) => <option key={d.id} value={d.id}>{d.name_fr}</option>)}
        </select>
        <input name="barcode" placeholder={lang==="fr"?"Code-barres (optionnel)":"Barcode (optional)"} style={inputStyle} />
        <input name="form" placeholder={lang==="fr"?"Forme (comprimé, sirop…)":"Form (tablet, syrup…)"} style={inputStyle} />
        <input name="strength" placeholder="Dosage (ex. 500mg)" style={inputStyle} />
        <input name="unit" placeholder={lang==="fr"?"Unité (boîte, flacon…)":"Unit (box, bottle…)"} style={inputStyle} />
        <input name="reorder_threshold" type="number" placeholder={lang==="fr"?"Seuil de réapprovisionnement":"Reorder threshold"} style={inputStyle} />
        <input name="cost_price_xaf" type="number" step="any" placeholder={lang==="fr"?"Coût de revient (FCFA)":"Purchase cost (FCFA)"} style={inputStyle} />
        <input name="sale_price_xaf" type="number" step="any" placeholder="Prix de vente (FCFA) *" required style={inputStyle} />
      </div>

      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}
      {success && <p style={{ fontSize: '12px', color: 'var(--color-success-text)', marginBottom: '8px' }}>✓ Produit ajouté au catalogue.</p>}

      <button type="submit" disabled={submitting} style={{
        fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : 'Ajouter le produit'}
      </button>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
        Le coût de revient est nécessaire pour calculer la marge bénéficiaire réelle sur le tableau de bord.
      </p>
    </form>
  )
}
