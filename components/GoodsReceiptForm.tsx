'use client'

// components/GoodsReceiptForm.tsx

import { useState } from 'react'
import { recordGoodsReceipt } from '@/lib/actions/pharmacy'
import { useLang } from '@/lib/i18n/LangContext'

interface Supplier { id: string; name: string }
interface Product { id: string; name: string }

interface ReceiptRow {
  productId: string
  batchNumber: string
  expiryDate: string
  quantity: string
  unitCost: string
}

function emptyRow(): ReceiptRow {
  return { productId: '', batchNumber: '', expiryDate: '', quantity: '', unitCost: '' }
}

export default function GoodsReceiptForm({
  suppliers, products, matchedPO,
}: {
  suppliers: Supplier[]
  products: Product[]
  matchedPO?: { id: string; supplierId: string; supplierName: string } | null
}) {
  const lang = useLang()
  const [rows, setRows] = useState<ReceiptRow[]>([emptyRow()])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '7px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '12px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '100%',
  }

  function updateRow(index: number, patch: Partial<ReceiptRow>) {
    setRows((r) => r.map((row, i) => i === index ? { ...row, ...patch } : row))
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await recordGoodsReceipt(formData)
    if (result?.error) {
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
        <select name="supplier_id" style={inputStyle} defaultValue={matchedPO?.supplierId ?? ''}>
          <option value="">{lang==="fr"?"Fournisseur (optionnel)":"Supplier (optional)"}</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input name="invoice_reference" placeholder={lang==="fr"?"Réf. bon de livraison":"Delivery note ref."} style={inputStyle} />
      </div>
      {matchedPO && <input type="hidden" name="purchase_order_id" value={matchedPO.id} />}

      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {lang==='fr'?'Articles reçus':'Items received'}
      </p>

      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '6px', marginBottom: '6px' }}>
          <select
            name="item_product_id"
            value={row.productId}
            onChange={(e) => updateRow(i, { productId: e.target.value })}
            style={inputStyle}
          >
            <option value="">{lang==="fr"?"Produit":"Product"}</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input
            name="item_batch_number"
            value={row.batchNumber}
            onChange={(e) => updateRow(i, { batchNumber: e.target.value })}
            placeholder={lang==="fr"?"N° de lot":"Batch no."}
            style={inputStyle}
          />
          <input
            name="item_expiry_date"
            type="date"
            value={row.expiryDate}
            onChange={(e) => updateRow(i, { expiryDate: e.target.value })}
            style={inputStyle}
          />
          <input
            name="item_quantity"
            type="number"
            value={row.quantity}
            onChange={(e) => updateRow(i, { quantity: e.target.value })}
            placeholder={lang==="fr"?"Qté":"Qty"}
            style={inputStyle}
          />
          <input
            name="item_unit_cost"
            type="number"
            step="any"
            value={row.unitCost}
            onChange={(e) => updateRow(i, { unitCost: e.target.value })}
            placeholder={lang === 'fr' ? 'Coût unitaire' : 'Unit cost'}
            style={inputStyle}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => setRows((r) => [...r, emptyRow()])}
        style={{
          background: 'none', border: '1px dashed var(--color-border)', color: 'var(--color-text-secondary)',
          padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontSize: '11px', cursor: 'pointer',
          marginBottom: '12px',
        }}
      >
        {lang === 'fr' ? '+ Ajouter un article' : '+ Add item'}
      </button>

      <textarea name="notes" placeholder="Notes (optionnel)" rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: '10px' }} />

      {error && (
        <p style={{ fontSize: '13px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '10px' }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ fontSize: '13px', color: 'var(--color-success-text)', marginBottom: '10px' }}>
          ✓ Réception enregistrée — le stock est à jour.
        </p>
      )}

      <button type="submit" disabled={submitting} style={{
        fontSize: '13px', padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
        cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
      }}>
        {submitting ? (lang === 'fr' ? 'Enregistrement…' : 'Saving…') : (lang === 'fr' ? 'Enregistrer la réception' : 'Save receipt')}
      </button>
    </form>
  )
}
