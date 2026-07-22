// app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Friendly-error mapping: Supabase's raw auth error text is written for
// developers, not a receptionist at 7am. Translate the common cases;
// fall back to a generic message rather than surfacing raw error text.
function friendlyAuthError(message: string, lang: 'fr' | 'en'): string {
  if (message.includes('Invalid login credentials')) {
    return lang === 'fr'
      ? 'E-mail ou mot de passe incorrect.'
      : 'Incorrect email or password.'
  }
  if (message.includes('Email not confirmed')) {
    return lang === 'fr'
      ? 'Ce compte n\'est pas encore activé. / Account not yet activated. Contact your administrator.'
      : 'This account is not yet activated. Contact your administrator.'
  }
  return lang === 'fr'
    ? 'Une erreur est survenue. / An error occurred. Please try again.'
    : 'Something went wrong. Please try again.'
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const copy = {
    fr: {
      tagline: 'Conçu pour le fonctionnement réel d\'une clinique. / Built for how clinics actually work.',
      heading: 'Connexion',
      email: 'Adresse e-mail',
      password: 'Mot de passe',
      submit: 'Se connecter',
      submitting: 'Connexion en cours…',
    },
    en: {
      tagline: 'Built for how a clinic actually runs.',
      heading: 'Sign in',
      email: 'Email address',
      password: 'Password',
      submit: 'Sign in',
      submitting: 'Signing in…',
    },
  }[lang]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(friendlyAuthError(authError.message, lang))
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'row' }}
         className="login-shell">
      <div style={{
        flex: 1,
        background: 'var(--color-sidebar)',
        padding: '2.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '280px',
      }}>
        <div>
          <p style={{
            color: 'var(--color-text-on-dark)',
            fontSize: '13px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            opacity: 0.6,
            margin: '0 0 6px',
          }}>
            TotalCare OS
          </p>
          <p style={{
            color: 'var(--color-text-on-dark)',
            fontSize: '20px',
            fontWeight: 500,
            margin: 0,
            maxWidth: '320px',
            lineHeight: 1.4,
          }}>
            {copy.tagline}
          </p>
        </div>
        {/* Signature pulse-line — the one deliberate visual flourish,
            respects prefers-reduced-motion via the global CSS rule. */}
        <svg width="180" height="32" viewBox="0 0 180 32" aria-hidden="true" style={{ opacity: 0.7 }}>
          <polyline
            points="0,16 36,16 45,16 52,5 60,27 68,16 81,16 90,16 97,8 105,24 113,16 180,16"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div style={{
        flex: 1,
        padding: '2.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '1rem',
        background: 'var(--color-bg)',
        maxWidth: '480px',
      }}>
        <p style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{copy.heading}</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="email" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
              {copy.email}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
              {copy.password}
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          {error && (
            <p role="alert" style={{
              fontSize: '13px',
              color: 'var(--color-critical-text)',
              background: 'var(--color-critical-bg)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              margin: 0,
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-text-on)',
              border: 'none',
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: '4px',
            }}
          >
            {loading ? copy.submitting : copy.submit}
          </button>
        </form>

        <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          <button
            type="button"
            onClick={() => setLang('fr')}
            aria-pressed={lang === 'fr'}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: lang === 'fr' ? 600 : 400, color: 'inherit' }}
          >
            FR
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: lang === 'en' ? 600 : 400, color: 'inherit' }}
          >
            EN
          </button>
        </div>
      </div>

      {/* Mobile: stack vertically instead of side-by-side */}
      <style jsx>{`
        @media (max-width: 640px) {
          .login-shell {
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
  )
}
