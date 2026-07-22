'use client'

// components/admin/pricing/InpatientPricingSection.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateWardRateAction, updateNursingRateAction } from '@/lib/actions/pricingAdmin'

interface Ward { id: string; name: string; code: string | null; daily_rate_xaf: number | null; is_active: boolean }

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
}
function fmt(n: number, lang: 'fr' | 'en') { return n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') + ' FCFA' }

function NursingRateCard({ currentRate, lang }: { currentRate: number | null; lang: 'fr' | 'en' }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(formData: FormData) {
    setError(null); setPending(true)
    const result = await updateNursingRateAction(formData)
    if (result && 'error' in result && result.error) setError(result.error)
    else { router.refresh(); setEditing(false) }
    setPending(false)
  }

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>
            {lang === 'fr' ? 'Soins infirmiers — forfait journalier' : 'Nursing care — daily flat rate'}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {lang === 'fr'
              ? 'Un seul tarif pour toute la clinique, quel que soit le service.'
              : 'One rate for the whole clinic, regardless of ward.'}
          </p>
          {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '4px 0 0' }}>{error}</p>}
        </div>

        {editing ? (
          <form action={handleSave} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input name="nursing_daily_rate_xaf" type="number" min="0" step="1" defaultValue={currentRate ?? ''} required
                   style={{ ...inputStyle, width: '120px' }} autoFocus />
            <button type="submit" disabled={pending} style={{
              fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
            }}>{lang === 'fr' ? 'Enreg.' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(false)} style={{
              fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
          </form>
        ) : (
          <button onClick={() => setEditing(true)} style={{
            fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '8px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer',
          }}>
            {currentRate ? fmt(currentRate, lang) : (lang === 'fr' ? 'Non défini' : 'Not set')}
          </button>
        )}
      </div>
    </div>
  )
}

function WardRateRow({ ward, lang }: { ward: Ward; lang: 'fr' | 'en' }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(formData: FormData) {
    setError(null); setPending(true)
    const result = await updateWardRateAction(ward.id, formData)
    if (result && 'error' in result && result.error) setError(result.error)
    else { router.refresh(); setEditing(false) }
    setPending(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', marginBottom: '6px', opacity: ward.is_active ? 1 : 0.55,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>
          {ward.name}{ward.code ? <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}> · {ward.code}</span> : ''}
        </p>
        {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '2px 0 0' }}>{error}</p>}
      </div>

      {editing ? (
        <form action={handleSave} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input name="daily_rate_xaf" type="number" min="0" step="1" defaultValue={ward.daily_rate_xaf ?? ''} required
                 style={{ ...inputStyle, width: '110px' }} autoFocus />
          <button type="submit" disabled={pending} style={{
            fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
          }}>{lang === 'fr' ? 'Enreg.' : 'Save'}</button>
          <button type="button" onClick={() => setEditing(false)} style={{
            fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer',
          }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
        </form>
      ) : (
        <button onClick={() => setEditing(true)} style={{
          fontSize: '13px', fontFamily: 'var(--font-mono)', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer',
        }}>
          {ward.daily_rate_xaf ? fmt(ward.daily_rate_xaf, lang) : (lang === 'fr' ? 'Non défini' : 'Not set')}
        </button>
      )}
    </div>
  )
}

export default function InpatientPricingSection({
  wards, nursingRate, lang,
}: { wards: Ward[]; nursingRate: number | null; lang: 'fr' | 'en' }) {
  return (
    <div>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 1rem', lineHeight: 1.5 }}>
        {lang === 'fr'
          ? "lang==='fr'?'Ces tarifs sont facturés chaque nuit pour tout patient hospitalisé — pas en une seule fois à la sortie.':'These rates are charged every night for every admitted patient — not all at once on discharge.' La création et la gestion des services (lits, capacité) se font depuis le module Admissions ; ici, seul le tarif est modifiable."
          : "These rates are billed every night for any admitted patient — not as one lump sum at discharge. Wards themselves (beds, capacity) are created and managed in the Admissions module; only the rate is editable here."}
      </p>

      <NursingRateCard currentRate={nursingRate} lang={lang} />

      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 8px' }}>
        {lang === 'fr' ? 'Tarifs des services (par nuit)' : 'Ward rates (per night)'}
      </p>

      {wards.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-secondary)',
          fontSize: '13px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
        }}>
          {lang === 'fr' ? 'Aucun service créé. Créez-en un dans le module Admissions.' : 'No wards yet. Create one in the Admissions module.'}
        </div>
      ) : (
        wards.map((w) => <WardRateRow key={w.id} ward={w} lang={lang} />)
      )}
    </div>
  )
}
