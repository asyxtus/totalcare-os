'use client'

// components/BedsTable.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBed, toggleBedStatus } from '@/lib/actions/admissions'
import { useLang } from '@/lib/i18n/LangContext'

interface Ward { id: string; name: string }
interface Bed { id: string; bed_number: string; bed_type: string | null; status: string; ward_id: string; ward_name: string }

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  available: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
  occupied: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
  reserved: { bg: 'var(--color-info-bg, #DCEBF5)', text: 'var(--color-info-text, #2A6D9E)' },
  maintenance: { bg: 'var(--color-critical-bg)', text: 'var(--color-critical-text)' },
}

export default function BedsTable({ wards, beds }: { wards: Ward[]; beds: Bed[] }) {
  const lang = useLang()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleAddBed(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const wardId = formData.get('ward_id') as string
    const result = await createBed(wardId, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setShowForm(false)
      setSubmitting(false)
      router.refresh()
    }
  }

  async function handleStatusChange(bedId: string, newStatus: string) {
    await toggleBedStatus(bedId, newStatus)
    router.refresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button onClick={() => setShowForm((s) => !s)} style={{
          fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
        }}>
          {showForm ? (lang==='fr'?'Annuler':'Cancel') : (lang==='fr'?'+ Nouveau lit':'+ New bed')}
        </button>
      </div>

      {showForm && (
        <form action={handleAddBed} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select name="ward_id" required style={inputStyle}>
            <option value="">{lang==="fr"?"Service *":"Ward *"}</option>
            {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <input name="bed_number" placeholder={lang==="fr"?"N° de lit *":"Bed no. *"} required style={inputStyle} />
          <input name="bed_type" placeholder={lang==="fr"?"Type (optionnel)":"Type (optional)"} style={inputStyle} />
          <button type="submit" disabled={submitting} style={{
            fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
          }}>
            {submitting ? '…' : (lang==='fr'?'Créer':'Create')}
          </button>
          {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', width: '100%', margin: 0 }}>{error}</p>}
        </form>
      )}

      {beds.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucun lit créé.':'No beds created.'}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1.3fr', gap: '10px', padding: '10px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', minWidth: '520px' }}>
            <span>{lang==='fr'?'Service':'Ward'}</span><span>{lang==='fr'?'N° de lit':'Bed no.'}</span><span>Type</span><span>{lang==='fr'?'Statut':'Status'}</span><span>{lang==='fr'?'Changer le statut':'Change status'}</span>
          </div>
          {beds.map((b, i) => {
            const colors = STATUS_COLORS[b.status] ?? STATUS_COLORS.available
            const isOccupied = b.status === 'occupied'
            return (
              <div key={b.id} style={{
                display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1.3fr', gap: '10px', padding: '10px 14px', fontSize: '13px', alignItems: 'center', minWidth: '520px',
                borderBottom: i < beds.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <span>{b.ward_name}</span>
                <span>{b.bed_number}</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{b.bed_type ?? '—'}</span>
                <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '999px', background: colors.bg, color: colors.text, textAlign: 'center', width: 'fit-content' }}>
                  {b.status}
                </span>
                {isOccupied ? (
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }} title={lang === 'fr' ? 'Occupé par un patient admis — se libère automatiquement à la sortie' : 'Occupied by an admitted patient — frees automatically on discharge'}>
                    {lang === 'fr' ? "Géré par l'admission" : 'Managed by admission'}
                  </span>
                ) : (
                  <select
                    value={b.status}
                    onChange={(e) => handleStatusChange(b.id, e.target.value)}
                    style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
                  >
                    <option value="available">available</option>
                    <option value="reserved">reserved</option>
                    <option value="maintenance">maintenance</option>
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '10px' }}>
        « lang==='fr'?'« Occupé » ne peut pas être défini manuellement':'"Occupied" cannot be set manually ici — il vient uniquement d'une vraie admission, pour éviter qu'un lit affiche un statut qui ne correspond à aucun patient réel.
      </p>
    </div>
  )
}
