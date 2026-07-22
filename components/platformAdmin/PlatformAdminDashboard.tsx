'use client'

// components/platformAdmin/PlatformAdminDashboard.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { provisionClinicAction, lockPlatformAdminAction, type ClinicListItem } from '@/lib/actions/platformAdmin'
import { useLang } from '@/lib/i18n/LangContext'

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '100%',
}
const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }

function fmtDate(iso: string | null, lang: 'fr' | 'en' = 'fr') {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PlatformAdminDashboard({ clinics }: { clinics: ClinicListItem[] }) {
  const lang = useLang()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ clinicId: string; adminEmail: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null); setDetail(null); setSuccess(null); setSubmitting(true)
    const result = await provisionClinicAction(formData)
    if (result?.error) {
      setError(result.error)
      setDetail(result.detail ?? null)
    } else if (result?.success) {
      setSuccess({ clinicId: result.clinicId!, adminEmail: result.adminEmail! })
      router.refresh()
    }
    setSubmitting(false)
  }

  async function handleLock() {
    await lockPlatformAdminAction()
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{lang==='fr'?'Administration plateforme':'Platform administration'}</h1>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
              {lang==='fr'?'Intégration de nouvelles cliniques':'New clinic onboarding'}
            </p>
          </div>
          <button onClick={handleLock} style={{
            fontSize: '12px', padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer',
          }}>
            Verrouiller
          </button>
        </div>

        <form action={handleSubmit} style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem',
        }}>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>{lang==='fr'?'Nouvelle clinique':'New clinic'}</p>

          <div style={{ marginBottom: '10px' }}>
            <label style={labelStyle}>Nom de la clinique *</label>
            <input name="clinic_name" required style={inputStyle} placeholder={lang==="fr"?"ex. Clinique Bonapriso Douala":"e.g. Bonapriso Douala Clinic"} />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={labelStyle}>{lang==='fr'?'Cloner le catalogue depuis':'Clone catalog from'}</label>
            <select name="template_clinic_id" style={inputStyle} defaultValue="">
              <option value="">{lang==="fr"?"Clinique vide — aucun service, test, ou lit préconfiguré":"Blank clinic — no services, tests, or beds preconfigured"}</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
              {lang==='fr'
                ? "Copie les services, lits, et tout le catalogue de laboratoire de la clinique choisie — chaque test obtient sa propre fiche, indépendante de l'originale."
                : 'Copies services, beds, and the full lab catalog from the selected clinic — each test gets its own record, independent of the original.'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>{lang==='fr'?"Nom de l'administrateur *":'Admin full name *'}</label>
              <input name="admin_full_name" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{lang==='fr'?"Email de l'administrateur *":'Admin email *'}</label>
              <input name="admin_email" type="email" required style={inputStyle} />
            </div>
          </div>

          {error && (
            <div style={{ background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', marginBottom: '10px' }}>
              <p style={{ margin: 0 }}>{error}</p>
              {detail && <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: '11px', opacity: 0.85 }}>{detail}</p>}
            </div>
          )}
          {success && (
            <div style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', marginBottom: '10px' }}>
              {lang==='fr'?'Clinique créée et invitation envoyée à':'Clinic created and invitation sent to'} {success.adminEmail}.
            </div>
          )}

          <button type="submit" disabled={submitting} style={{
            padding: '9px 16px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
            fontSize: '13px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? (lang==='fr'?'Création…':'Creating…') : (lang==='fr'?'Créer la clinique':'Create clinic')}
          </button>
        </form>

        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 8px' }}>
          Cliniques existantes ({clinics.length})
        </p>
        {clinics.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucune clinique pour le moment.':'No clinics yet.'}</p>
        ) : (
          clinics.map((c) => (
            <div key={c.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', marginBottom: '6px',
            }}>
              <span style={{ fontSize: '13px' }}>{c.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{fmtDate(c.created_at, lang)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
