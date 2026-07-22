'use client'

// components/SupplierForm.tsx

import { useState } from 'react'
import { useLang } from '@/lib/i18n/LangContext'
import { createSupplier } from '@/lib/actions/pharmacy'

export default function SupplierForm() {
  const lang = useLang()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', width: '100%',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await createSupplier(formData)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    }
    setSubmitting(false)
  }

  return (
    <form action={handleSubmit} style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 10px' }}>{lang==='fr'?'Nouveau fournisseur':'New supplier'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <input name="name" placeholder={lang==="fr"?"Nom du fournisseur *":"Supplier name *"} required style={inputStyle} />
        <input name="contact_name" placeholder={lang==="fr"?"Personne à contacter":"Contact person"} style={inputStyle} />
        <input name="phone" placeholder={lang==="fr"?"Téléphone":"Phone"} style={inputStyle} />
        <input name="email" placeholder="Email" style={inputStyle} />
      </div>
      <input name="address" placeholder="Adresse" style={{ ...inputStyle, marginBottom: '8px' }} />
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input name="payment_terms_days" type="number" placeholder={lang==="fr"?"Délai de paiement (jours, 0 = comptant)":"Payment terms (days, 0 = cash)"} style={{ ...inputStyle, flex: 1 }} />
        <button type="submit" disabled={submitting} style={{
          fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          {submitting ? '…' : 'Ajouter'}
        </button>
      </div>
      {success && <p style={{ fontSize: '12px', color: 'var(--color-success-text)', marginTop: '8px' }}>✓ Fournisseur ajouté</p>}
      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginTop: '8px' }}>{error}</p>}
    </form>
  )
}
