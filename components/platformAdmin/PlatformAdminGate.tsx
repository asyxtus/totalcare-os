'use client'

// components/platformAdmin/PlatformAdminGate.tsx

import { useState } from 'react'
import { useLang } from '@/lib/i18n/LangContext'
import { useRouter } from 'next/navigation'
import { platformAdminSignInAction, bootstrapFirstAdminAction } from '@/lib/actions/platformAdmin'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontSize: '14px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', marginBottom: '10px',
}
const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }

export default function PlatformAdminGate({ needsBootstrap }: { needsBootstrap: boolean }) {
  const lang = useLang()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSignIn(formData: FormData) {
    setError(null); setSubmitting(true)
    const result = await platformAdminSignInAction(formData)
    if (result && 'error' in result && result.error) { setError(result.error); setSubmitting(false) }
    else router.refresh()
  }

  async function handleBootstrap(formData: FormData) {
    setError(null); setSubmitting(true)
    const result = await bootstrapFirstAdminAction(formData)
    if (result && 'error' in result && result.error) { setError(result.error); setSubmitting(false) }
    else router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px', textAlign: 'center' }}>
          {lang === 'fr' ? 'Administration plateforme' : 'Platform administration'}
        </h1>

        {needsBootstrap ? (
          <>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.5rem', textAlign: 'center' }}>
              {lang === 'fr'
                ? 'Aucun administrateur — créez le premier compte pour commencer.'
                : 'No administrators yet — create the first account to get started.'}
            </p>
            <form action={handleBootstrap} style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', padding: '1.5rem',
            }}>
              <label style={labelStyle}>{lang === 'fr' ? "Code d'amorçage (une seule fois)" : 'Bootstrap code (one time only)'}</label>
              <input name="secret" type="password" required style={inputStyle} />

              <label style={labelStyle}>{lang === 'fr' ? 'Votre nom complet' : 'Your full name'}</label>
              <input name="full_name" required style={inputStyle} />

              <label style={labelStyle}>{lang === 'fr' ? 'Votre email' : 'Your email'}</label>
              <input name="email" type="email" required style={inputStyle} />

              <label style={labelStyle}>{lang === 'fr' ? 'Choisissez un mot de passe (8+ caractères)' : 'Choose a password (8+ characters)'}</label>
              <input name="password" type="password" required minLength={8} style={inputStyle} />

              {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '0 0 1rem' }}>{error}</p>}

              <button type="submit" disabled={submitting} style={{
                width: '100%', padding: '10px', border: 'none', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
                fontSize: '13px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
              }}>
                {submitting ? (lang === 'fr' ? 'Création…' : 'Creating…') : (lang === 'fr' ? 'Créer mon compte' : 'Create my account')}
              </button>
            </form>
          </>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.5rem', textAlign: 'center' }}>
              {lang === 'fr' ? "Réservé aux administrateurs de la plateforme" : 'Reserved for platform administrators'}
            </p>
            <form action={handleSignIn} style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', padding: '1.5rem',
            }}>
              <label style={labelStyle}>Email</label>
              <input name="email" type="email" required autoFocus style={inputStyle} />

              <label style={labelStyle}>{lang === 'fr' ? 'Mot de passe' : 'Password'}</label>
              <input name="password" type="password" required style={inputStyle} />

              {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '0 0 1rem' }}>{error}</p>}

              <button type="submit" disabled={submitting} style={{
                width: '100%', padding: '10px', border: 'none', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
                fontSize: '13px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
              }}>
                {submitting ? (lang === 'fr' ? 'Connexion…' : 'Signing in…') : (lang === 'fr' ? 'Se connecter' : 'Sign in')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
