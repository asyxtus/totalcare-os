'use client'

// app/accept-invite/page.tsx
//
// Where every invite link (staff, clinic admin, platform admin) lands.
// Supabase's browser client auto-detects the access/refresh tokens in the
// URL fragment on load and establishes a session from them — that's what
// lets an invited-but-never-logged-in-before user land here "signed in"
// enough to set their own password, which is the one thing every invite
// flow in this app was missing before: there was no page that did this
// at all, so every invite link led nowhere no matter how correctly the
// email itself was configured.

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AcceptInviteForm() {
  const router = useRouter()
  const supabase = createClient()
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const [checking, setChecking] = useState(true)
  const [linkValid, setLinkValid] = useState(false)
  const [fullName, setFullName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setLang(navigator.language.startsWith('fr') ? 'fr' : 'en')

    // CRITICAL: don't just check "is there any session" — if this browser
    // already has an active session (e.g. an admin testing invites while
    // still logged into their own console session), that stale session
    // would pass a generic getSession() check, and the password form
    // below would silently update THAT account instead of the person
    // this link was actually sent to. Extract the token from the URL's
    // own hash and explicitly set it as the session, so the link itself
    // — not whatever happened to already be logged in — determines whose
    // password gets changed. Any pre-existing session is deliberately
    // discarded first.
    async function establishSessionFromLink() {
      const hash = window.location.hash
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (!accessToken || !refreshToken) {
        // No token in the URL at all — sign out any stale session too,
        // so this never falls back to "whatever was already logged in."
        await supabase.auth.signOut()
        setLinkValid(false)
        setChecking(false)
        return
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error || !data.session) {
        setLinkValid(false)
      } else {
        setLinkValid(true)
        setFullName((data.session.user?.user_metadata?.full_name as string) ?? null)
        setUserEmail(data.session.user?.email ?? null)
      }
      setChecking(false)
    }

    establishSessionFromLink()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(lang === 'fr' ? 'Le mot de passe doit contenir au moins 8 caractères.' : 'Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError(lang === 'fr' ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(lang === 'fr' ? `Impossible de définir le mot de passe. (${updateError.message})` : `Could not set password. (${updateError.message})`)
      setSubmitting(false)
      return
    }
    setDone(true)
    setSubmitting(false)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '14px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', marginBottom: '12px',
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Vérification…' : 'Checking…'}</p>
      </div>
    )
  }

  if (!linkValid) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '1rem' }}>
        <div style={{ maxWidth: '380px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 10px' }}>
            {lang === 'fr' ? "Ce lien d'invitation n'est plus valide" : 'This invite link is no longer valid'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
            {lang === 'fr'
              ? "Il a peut-être expiré ou déjà été utilisé. Demandez à la personne qui vous a invité de vous envoyer une nouvelle invitation."
              : 'It may have expired or already been used. Ask whoever invited you to send a new invitation.'}
          </p>
          <a href="/login" style={{ fontSize: '13px', color: 'var(--color-accent)' }}>
            {lang === 'fr' ? "Aller à la page de connexion" : 'Go to sign-in page'}
          </a>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <p style={{ fontSize: '14px', color: 'var(--color-success-text)' }}>
          ✓ {lang === 'fr' ? 'Mot de passe défini — redirection…' : 'Password set — redirecting…'}
        </p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px', textAlign: 'center' }}>
          {lang === 'fr' ? 'Bienvenue' : 'Welcome'}{fullName ? `, ${fullName}` : ''}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 4px', textAlign: 'center' }}>
          {lang === 'fr' ? 'Choisissez votre mot de passe pour finaliser votre compte.' : 'Choose your password to finish setting up your account.'}
        </p>
        {userEmail && (
          <p style={{ fontSize: '12px', color: 'var(--color-accent)', margin: '0 0 1.5rem', textAlign: 'center', fontWeight: 600 }}>
            {userEmail}
          </p>
        )}
        <form onSubmit={handleSubmit} style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: '1.5rem',
        }}>
          <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
            {lang === 'fr' ? 'Mot de passe (8+ caractères)' : 'Password (8+ characters)'}
          </label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus style={inputStyle} />

          <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
            {lang === 'fr' ? 'Confirmez le mot de passe' : 'Confirm password'}
          </label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} style={inputStyle} />

          {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '0 0 1rem' }}>{error}</p>}

          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: '10px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
            fontSize: '13px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? (lang === 'fr' ? 'Création…' : 'Setting up…') : (lang === 'fr' ? 'Créer mon compte' : 'Complete account setup')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  )
}
