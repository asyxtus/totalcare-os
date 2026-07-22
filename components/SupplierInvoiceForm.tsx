'use client'

// components/SupplierInvoiceForm.tsx

import { useState } from 'react'
import { recordSupplierInvoice } from '@/lib/actions/procurement'
import { useLang } from '@/lib/i18n/LangContext'

interface Supplier { id: string; name: string }

export default function SupplierInvoiceForm({ suppliers }: { suppliers: Supplier[] }) {
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
    const result = await recordSupplierInvoice(formData)
    if (result && 'error' in result && result.error) setError(result.error)
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
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 10px' }}>{lang==='fr'?'Nouvelle facture fournisseur':'New supplier invoice'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <select name="supplier_id" required style={inputStyle} defaultValue="">
          <option value="" disabled>{lang==="fr"?"Fournisseur *":"Supplier *"}</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input name="invoice_number" placeholder={lang==="fr"?"N° de facture fournisseur":"Supplier invoice no."} style={inputStyle} />
        <input name="invoice_date" type="date" style={inputStyle} />
        <input name="total_amount_xaf" type="number" step="any" placeholder={lang==="fr"?"Montant total (FCFA) *":"Total amount (FCFA) *"} required style={inputStyle} />
      </div>
      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}
      {success && <p style={{ fontSize: '12px', color: 'var(--color-success-text)', marginBottom: '8px' }}>✓ {lang==='fr'?'Facture enregistrée':'Invoice recorded'}</p>}
      <button type="submit" disabled={submitting} style={{
        fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : (lang==='fr'?'Enregistrer la facture':'Save invoice')}
      </button>
    </form>
  )
}
