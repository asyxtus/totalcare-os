'use client'

// components/admin/InviteStaffForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inviteStaffAction } from '@/lib/actions/staffAdmin'
import { ALL_ROLES, roleLabel } from '@/lib/roleMeta'

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '100%',
}
const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px',
}

export default function InviteStaffForm({ lang, onDone }: { lang: 'fr' | 'en'; onDone: () => void }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await inviteStaffAction(formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      router.refresh()
      onDone()
    }
  }

  return (
    <form action={handleSubmit} style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 10px' }}>
        {lang === 'fr' ? 'Inviter un membre du personnel' : 'Invite a staff member'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Nom complet' : 'Full name'} *</label>
          <input name="full_name" required style={inputStyle} placeholder={lang === 'fr' ? 'Ex. Aïcha Ndongo' : 'e.g. Aïcha Ndongo'} />
        </div>
        <div>
          <label style={labelStyle}>Email *</label>
          <input name="email" type="email" required style={inputStyle} placeholder="nom@exemple.com" />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Rôle' : 'Role'} *</label>
          <select name="role" required defaultValue="" style={inputStyle}>
            <option value="" disabled>{lang === 'fr' ? 'Choisir…' : 'Choose…'}</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel(r, lang)}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Langue préférée' : 'Preferred language'}</label>
          <select name="preferred_language" defaultValue={lang} style={inputStyle}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
        {lang === 'fr'
          ? "Un email d'invitation sera envoyé pour créer le mot de passe."
          : 'An invite email will be sent to set up their password.'}
      </p>

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', margin: '0 0 10px' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={submitting} style={{
          fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
        }}>
          {submitting ? (lang === 'fr' ? 'Envoi…' : 'Sending…') : (lang === 'fr' ? "Envoyer l'invitation" : 'Send invite')}
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
