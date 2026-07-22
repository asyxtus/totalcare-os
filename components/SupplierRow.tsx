'use client'

// components/SupplierRow.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateSupplier, toggleSupplierActive } from '@/lib/actions/pharmacy'
import { useLang } from '@/lib/i18n/LangContext'

interface Supplier {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  payment_terms_days: number
  is_active: boolean
}

// WhatsApp deep link — needs digits only, no spaces/dashes/plus.
function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}`
}

export default function SupplierRow({ supplier, outstandingXaf }: { supplier: Supplier; outstandingXaf: number }) {
  const lang = useLang()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '12px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await updateSupplier(supplier.id, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setEditing(false)
      router.refresh()
    }
  }

  async function handleToggle() {
    await toggleSupplierActive(supplier.id, supplier.is_active)
    router.refresh()
  }

  if (editing) {
    return (
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
        <form action={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
            <input name="name" defaultValue={supplier.name} placeholder={lang==="fr"?"Nom *":"Name *"} required style={inputStyle} />
            <input name="contact_name" defaultValue={supplier.contact_name ?? ''} placeholder={lang==="fr"?"Contact":"Contact"} style={inputStyle} />
            <input name="phone" defaultValue={supplier.phone ?? ''} placeholder={lang==="fr"?"Téléphone":"Phone"} style={inputStyle} />
            <input name="email" defaultValue={supplier.email ?? ''} placeholder="Email" style={inputStyle} />
            <input name="address" defaultValue={supplier.address ?? ''} placeholder={lang==="fr"?"Adresse":"Address"} style={inputStyle} />
            <input name="payment_terms_days" type="number" defaultValue={supplier.payment_terms_days} placeholder={lang === 'fr' ? 'Délai (jours)' : 'Terms (days)'} style={inputStyle} />
          </div>
          {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', marginBottom: '6px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={submitting} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
              {submitting ? '…' : (lang === 'fr' ? 'Enregistrer' : 'Save')}
            </button>
            <button type="button" onClick={() => setEditing(false)} style={{ fontSize: '12px', padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              {lang === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  const isClear = outstandingXaf === 0

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
      padding: '1.1rem', opacity: supplier.is_active ? 1 : 0.5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <p style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{supplier.name}</p>
        <span style={{
          fontSize: '11px', padding: '2px 10px', borderRadius: '999px',
          background: isClear ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
          color: isClear ? 'var(--color-success-text)' : 'var(--color-warning-text)',
        }}>
          {isClear ? 'Réglé' : `${outstandingXaf.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA dû`}
        </span>
      </div>

      {supplier.contact_name && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>{supplier.contact_name}</p>}
      {supplier.address && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>{supplier.address}</p>}
      {supplier.email && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{supplier.email}</p>}

      {supplier.phone && (
        <div style={{ display: 'flex', gap: '14px', marginBottom: '10px' }}>
          <a href={`tel:${supplier.phone}`} style={{ fontSize: '13px', color: 'var(--color-accent)', textDecoration: 'none' }}>
            📞 {supplier.phone}
          </a>
          <a href={whatsappLink(supplier.phone)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#25D366', textDecoration: 'none', fontWeight: 500 }}>
            WhatsApp
          </a>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Link href={`/pharmacy/purchase-orders?supplier=${supplier.id}`} style={{
          flex: 1, textAlign: 'center', fontSize: '12px', padding: '8px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', textDecoration: 'none',
        }}>
          Voir les commandes
        </Link>
        <button onClick={() => setEditing(true)} title="Modifier" style={{
          width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
          background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
        }}>
          ✎
        </button>
        <button onClick={handleToggle} title={supplier.is_active ? 'Désactiver' : 'Activer'} style={{
          width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
          background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
        }}>
          {supplier.is_active ? '⏻' : '○'}
        </button>
      </div>
    </div>
  )
}
