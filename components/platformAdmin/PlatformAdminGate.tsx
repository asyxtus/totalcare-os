'use client'

// components/platformAdmin/PlatformAdminGate.tsx

import { useState } from 'react'
import { useLang } from '@/lib/i18n/LangContext'
import { useRouter } from 'next/navigation'
import { unlockPlatformAdminAction } from '@/lib/actions/platformAdmin'

export default function PlatformAdminGate() {
  const lang = useLang()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null); setSubmitting(true)
    const result = await unlockPlatformAdminAction(formData)
    if (result?.error) { setError(result.error); setSubmitting(false) }
    else router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px', textAlign: 'center' }}>
          Administration plateforme
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.5rem', textAlign: 'center' }}>
          {lang==='fr'?"Réservé à l'intégration de nouvelles cliniques":'Reserved for new clinic onboarding'}
        </p>

        <form action={handleSubmit} style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: '1.5rem',
        }}>
          <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
            Code d'accès
          </label>
          <input
            name="secret" type="password" required autoFocus
            style={{
              width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              fontSize: '14px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', marginBottom: '1rem',
            }}
          />
          {error && (
            <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '0 0 1rem' }}>{error}</p>
          )}
          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: '10px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
            fontSize: '13px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? (lang==='fr'?'Vérification…':'Verifying…') : (lang==='fr'?'Déverrouiller':'Unlock')}
          </button>
        </form>
      </div>
    </div>
  )
}
