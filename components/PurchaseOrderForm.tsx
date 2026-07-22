'use client'

// components/PurchaseOrderForm.tsx

import { useState } from 'react'
import { createPurchaseOrder } from '@/lib/actions/procurement'
import { useLang } from '@/lib/i18n/LangContext'

interface Supplier { id: string; name: string }
interface Product { id: string; name: string }
interface Row { productId: string; quantity: string; unitCost: string }

function emptyRow(): Row { return { productId: '', quantity: '', unitCost: '' } }

export default function PurchaseOrderForm({ suppliers, products }: { suppliers: Supplier[]; products: Product[] }) {
  const lang = useLang()
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '7px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '12px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '100%',
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await createPurchaseOrder(formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setRows([emptyRow()])
      setTimeout(() => setSuccess(false), 2500)
    }
    setSubmitting(false)
  }

  return (
    <form action={handleSubmit} style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <select name="supplier_id" required style={inputStyle} defaultValue="">
          <option value="" disabled>{lang==="fr"?"Fournisseur *":"Supplier *"}</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input name="expected_delivery_date" type="date" style={inputStyle} />
      </div>

      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 6px', textTransform: 'uppercase' }}>{lang==='fr'?'Articles commandés':'Ordered items'}</p>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
          <select name="item_product_id" value={row.productId} onChange={(e) => updateRow(i, { productId: e.target.value })} style={inputStyle}>
            <option value="">{lang==="fr"?"Produit":"Product"}</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input name="item_quantity" type="number" value={row.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })} placeholder={lang==="fr"?"Qté":"Qty"} style={inputStyle} />
          <input name="item_unit_cost" type="number" step="any" value={row.unitCost} onChange={(e) => updateRow(i, { unitCost: e.target.value })} placeholder={lang==="fr"?"Coût unitaire prévu":"Expected unit cost"} style={inputStyle} />
        </div>
      ))}
      <button type="button" onClick={() => setRows((r) => [...r, emptyRow()])} style={{
        background: 'none', border: '1px dashed var(--color-border)', color: 'var(--color-text-secondary)',
        padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontSize: '11px', cursor: 'pointer', marginBottom: '10px',
      }}>
        {lang === 'fr' ? '+ Ajouter un article' : '+ Add item'}
      </button>

      <textarea name="notes" placeholder="Notes (optionnel)" rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: '10px' }} />

      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}
      {success && <p style={{ fontSize: '12px', color: 'var(--color-success-text)', marginBottom: '8px' }}>✓ {lang==='fr'?'Bon de commande créé':'Purchase order created'}.</p>}

      <button type="submit" disabled={submitting} style={{
        fontSize: '13px', padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : lang==='fr'?'Créer le bon de commande':'Create purchase order'}
      </button>
    </form>
  )
}
