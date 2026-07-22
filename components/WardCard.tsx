'use client'

// components/WardCard.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBed, toggleBedStatus } from '@/lib/actions/admissions'
import { useLang } from '@/lib/i18n/LangContext'

interface Bed { id: string; bed_number: string; status: string; bed_type: string | null }
interface Ward {
  id: string; name: string; code: string | null; ward_type: string | null
  capacity: number | null; daily_rate_xaf: number | null; beds: Bed[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  available: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
  occupied: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
  reserved: { bg: 'var(--color-info-bg, #DCEBF5)', text: 'var(--color-info-text, #2A6D9E)' },
  maintenance: { bg: 'var(--color-critical-bg)', text: 'var(--color-critical-text)' },
}

export default function WardCard({ ward }: { ward: Ward }) {
  const lang = useLang()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleAddBed(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await createBed(ward.id, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      router.refresh()
    }
  }

  async function handleToggle(bedId: string, currentStatus: string) {
    const newStatus = currentStatus === 'maintenance' ? 'available' : 'maintenance'
    await toggleBedStatus(bedId, newStatus)
    router.refresh()
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
          {ward.name} {ward.code && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>({ward.code})</span>}
        </p>
        {ward.daily_rate_xaf != null && (
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{Number(ward.daily_rate_xaf).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA / nuit</span>
        )}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
        {[ward.ward_type, ward.capacity ? (lang==='fr'?`Capacité ${ward.capacity}`:`Capacity ${ward.capacity}`) : null].filter(Boolean).join(' · ') || '\u00A0'}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        {ward.beds.map((bed) => {
          const colors = STATUS_COLORS[bed.status] ?? STATUS_COLORS.available
          const canToggle = bed.status === 'available' || bed.status === 'maintenance'
          return (
            <button
              key={bed.id}
              onClick={() => canToggle && handleToggle(bed.id, bed.status)}
              disabled={!canToggle}
              title={bed.status}
              style={{
                fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                background: colors.bg, color: colors.text, border: 'none',
                cursor: canToggle ? 'pointer' : 'default',
              }}
            >
              {bed.bed_number}
            </button>
          )
        })}
        {ward.beds.length === 0 && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucun lit dans ce service.':'No beds in this ward.'}</p>}
      </div>

      <form action={handleAddBed} style={{ display: 'flex', gap: '6px' }}>
        <input name="bed_number" placeholder={lang==="fr"?"N° de lit":"Bed no."} required style={{
          fontSize: '12px', padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
          background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '90px',
        }} />
        <input name="bed_type" placeholder={lang==="fr"?"Type (optionnel)":"Type (optional)"} style={{
          fontSize: '12px', padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
          background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '120px',
        }} />
        <button type="submit" disabled={submitting} style={{
          fontSize: '12px', padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--color-border)',
          background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
        }}>
          {lang === 'fr' ? '+ Ajouter un lit' : '+ Add bed'}
        </button>
        {error && <span style={{ fontSize: '11px', color: 'var(--color-critical-text)' }}>{error}</span>}
      </form>
    </div>
  )
}
