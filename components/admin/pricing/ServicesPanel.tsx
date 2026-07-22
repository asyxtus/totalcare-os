'use client'

// components/admin/pricing/ServicesPanel.tsx

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createServicePriceAction, updateServicePriceAction, toggleServicePriceActiveAction } from '@/lib/actions/pricingAdmin'

interface ServicePrice {
  id: string; service_name: string; category: string; price_xaf: number; is_active: boolean
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
}

function fmt(n: number, lang: 'fr' | 'en') {
  return n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') + ' FCFA'
}

function ServiceRow({ service, lang }: { service: ServicePrice; lang: 'fr' | 'en' }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSavePrice(formData: FormData) {
    setError(null); setPending(true)
    const result = await updateServicePriceAction(service.id, formData)
    if (result?.error) setError(result.error)
    else { router.refresh(); setEditing(false) }
    setPending(false)
  }

  async function handleToggle() {
    setError(null); setPending(true)
    const result = await toggleServicePriceActiveAction(service.id, !service.is_active)
    if (result?.error) setError(result.error)
    else router.refresh()
    setPending(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', marginBottom: '6px', opacity: service.is_active ? 1 : 0.55,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{service.service_name}</p>
        {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '2px 0 0' }}>{error}</p>}
      </div>

      {editing ? (
        <form action={handleSavePrice} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input name="price_xaf" type="number" min="0" step="1" defaultValue={service.price_xaf} required
                 style={{ ...inputStyle, width: '110px' }} autoFocus />
          <button type="submit" disabled={pending} style={{
            fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
          }}>
            {lang === 'fr' ? 'Enreg.' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} style={{
            fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer',
          }}>
            {lang === 'fr' ? 'Annuler' : 'Cancel'}
          </button>
        </form>
      ) : (
        <button onClick={() => setEditing(true)} style={{
          fontSize: '13px', fontFamily: 'var(--font-mono)', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer',
        }}>
          {fmt(service.price_xaf, lang)}
        </button>
      )}

      <button onClick={handleToggle} disabled={pending} style={{
        fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
        background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
        color: service.is_active ? 'var(--color-critical-text)' : 'var(--color-success-text)',
      }}>
        {service.is_active ? (lang === 'fr' ? 'Désactiver' : 'Deactivate') : (lang === 'fr' ? 'Réactiver' : 'Reactivate')}
      </button>
    </div>
  )
}

function slugifyCode(name: string) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

function NewServiceForm({ categories, lang, onDone }: { categories: string[]; lang: 'fr' | 'en'; onDone: () => void }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeTouched, setCodeTouched] = useState(false)

  function handleNameChange(v: string) {
    setName(v)
    if (!codeTouched) setCode(slugifyCode(v))
  }

  async function handleSubmit(formData: FormData) {
    setError(null); setPending(true)
    const result = await createServicePriceAction(formData)
    if (result?.error) setError(result.error)
    else { router.refresh(); onDone() }
    setPending(false)
  }

  return (
    <form action={handleSubmit} style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 10px' }}>
        {lang === 'fr' ? 'Nouveau service' : 'New service'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <input
          name="service_name" placeholder={lang === 'fr' ? 'Nom du service *' : 'Service name *'} required
          value={name} onChange={(e) => handleNameChange(e.target.value)} style={inputStyle}
        />
        <input name="category" placeholder={lang === 'fr' ? 'Catégorie *' : 'Category *'} required list="service-categories" style={inputStyle} />
        <input name="price_xaf" type="number" min="0" step="1" placeholder="Prix (FCFA) *" required style={inputStyle} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <input
          name="service_code" placeholder={lang === 'fr' ? 'Code (généré automatiquement, modifiable) *' : 'Code (auto-generated, editable) *'}
          required value={code}
          onChange={(e) => { setCodeTouched(true); setCode(e.target.value.toUpperCase()) }}
          style={{ ...inputStyle, width: '100%', fontFamily: 'var(--font-mono)' }}
        />
        <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
          {lang === 'fr'
            ? "lang==='fr'?'Utilisé en interne pour identifier ce service de façon unique — doit être différent pour chaque service.':'Used internally to uniquely identify this service — must be different for each service.'"
            : 'Used internally to uniquely identify this service — must be different for every service.'}
        </p>
      </div>
      <datalist id="service-categories">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>
      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '0 0 10px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={pending} style={{
          fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
        }}>
          {pending ? '…' : (lang === 'fr' ? 'Créer' : 'Create')}
        </button>
        <button type="button" onClick={onDone} style={{
          fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
          background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer',
        }}>
          {lang === 'fr' ? 'Annuler' : 'Cancel'}
        </button>
      </div>
    </form>
  )
}

export default function ServicesPanel({ services, lang }: { services: ServicePrice[]; lang: 'fr' | 'en' }) {
  const [adding, setAdding] = useState(false)

  const categories = useMemo(() => [...new Set(services.map((s) => s.category))].sort(), [services])

  const grouped = useMemo(() => {
    const map = new Map<string, ServicePrice[]>()
    for (const s of services) {
      if (!map.has(s.category)) map.set(s.category, [])
      map.get(s.category)!.push(s)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [services])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{
            fontSize: '12px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
          }}>
            + {lang === 'fr' ? 'Nouveau service' : 'New service'}
          </button>
        )}
      </div>

      {adding && <NewServiceForm categories={categories} lang={lang} onDone={() => setAdding(false)} />}

      {grouped.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--color-text-secondary)',
          fontSize: '13px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
        }}>
          {lang === 'fr' ? 'Aucun tarif de service pour le moment.' : 'No service prices yet.'}
        </div>
      ) : (
        grouped.map(([category, items]) => (
          <div key={category} style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 8px' }}>
              {category}
            </p>
            {items.map((s) => <ServiceRow key={s.id} service={s} lang={lang} />)}
          </div>
        ))
      )}
    </div>
  )
}
