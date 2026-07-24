'use client'

// components/admin/StaffRow.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateStaffRoleAction, toggleStaffActiveAction, setStaffSecondaryRoleAction } from '@/lib/actions/staffAdmin'
import { ALL_ROLES, ROLE_META, roleLabel, initialsOf } from '@/lib/roleMeta'
import type { StaffRole } from '@/lib/types'

export interface StaffMember {
  id: string
  full_name: string
  role: StaffRole
  is_active: boolean
  preferred_language: 'fr' | 'en'
  email: string | null
  created_at: string
  secondary_roles?: StaffRole[]
}

export default function StaffRow({ member, isSelf, lang }: { member: StaffMember; isSelf: boolean; lang: 'fr' | 'en' }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSecondaryRoles, setShowSecondaryRoles] = useState(false)
  const meta = ROLE_META[member.role]
  const secondaryRoles = member.secondary_roles ?? []

  async function handleRoleChange(newRole: StaffRole) {
    if (newRole === member.role) return
    setError(null)
    setPending(true)
    const result = await updateStaffRoleAction(member.id, newRole)
    if (result && 'error' in result && result.error) setError(result.error)
    else router.refresh()
    setPending(false)
  }

  async function handleToggleActive() {
    setError(null)
    setPending(true)
    const result = await toggleStaffActiveAction(member.id, !member.is_active)
    if (result && 'error' in result && result.error) setError(result.error)
    else router.refresh()
    setPending(false)
  }

  async function handleToggleSecondaryRole(role: StaffRole, currentlyGranted: boolean) {
    setError(null)
    setPending(true)
    const result = await setStaffSecondaryRoleAction(member.id, role, !currentlyGranted)
    if (result && 'error' in result && result.error) setError(result.error)
    else router.refresh()
    setPending(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', marginBottom: '8px', opacity: member.is_active ? 1 : 0.6,
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
        background: `var(${meta.bgVar})`, color: `var(${meta.textVar})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: 600,
      }}>
        {initialsOf(member.full_name)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>
            {member.full_name}{isSelf ? <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}> ({lang === 'fr' ? 'vous' : 'you'})</span> : ''}
          </p>
          {!member.is_active && (
            <span style={{
              fontSize: '10px', padding: '1px 8px', borderRadius: '999px',
              background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
            }}>
              {lang === 'fr' ? 'Désactivé' : 'Deactivated'}
            </span>
          )}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
          {member.email ?? '—'}
        </p>
        {secondaryRoles.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '5px' }}>
            {secondaryRoles.map((r) => {
              const rMeta = ROLE_META[r]
              return (
                <span key={r} style={{
                  fontSize: '10px', padding: '2px 8px', borderRadius: '999px',
                  background: `var(${rMeta.bgVar})`, color: `var(${rMeta.textVar})`, opacity: 0.85,
                }}>
                  + {roleLabel(r, lang)}
                </span>
              )
            })}
          </div>
        )}
        {!isSelf && (
          <button
            onClick={() => setShowSecondaryRoles((v) => !v)}
            style={{ fontSize: '10px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0' }}
          >
            {showSecondaryRoles
              ? (lang === 'fr' ? 'Masquer les rôles supplémentaires' : 'Hide additional roles')
              : (lang === 'fr' ? '+ Gérer les rôles supplémentaires' : '+ Manage additional roles')}
          </button>
        )}
        {showSecondaryRoles && !isSelf && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px', padding: '8px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
            {ALL_ROLES.filter((r) => r !== member.role).map((r) => {
              const granted = secondaryRoles.includes(r)
              const rMeta = ROLE_META[r]
              return (
                <button
                  key={r}
                  onClick={() => handleToggleSecondaryRole(r, granted)}
                  disabled={pending}
                  style={{
                    fontSize: '10px', padding: '3px 9px', borderRadius: '999px', cursor: pending ? 'wait' : 'pointer',
                    border: granted ? `1px solid var(${rMeta.textVar})` : '1px solid var(--color-border)',
                    background: granted ? `var(${rMeta.bgVar})` : 'transparent',
                    color: granted ? `var(${rMeta.textVar})` : 'var(--color-text-secondary)',
                  }}
                >
                  {granted ? '✓ ' : '+ '}{roleLabel(r, lang)}
                </button>
              )
            })}
          </div>
        )}
        {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '4px 0 0' }}>{error}</p>}
      </div>

      <select
        value={member.role}
        disabled={pending || isSelf}
        onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
        aria-label={lang === 'fr' ? `Rôle de ${member.full_name}` : `Role for ${member.full_name}`}
        style={{
          fontSize: '11px', padding: '5px 8px', borderRadius: '999px', border: 'none',
          background: `var(${meta.bgVar})`, color: `var(${meta.textVar})`, fontWeight: 500,
          cursor: isSelf ? 'default' : 'pointer',
        }}
      >
        {ALL_ROLES.map((r) => (
          <option key={r} value={r}>{roleLabel(r, lang)}</option>
        ))}
      </select>

      <button
        onClick={handleToggleActive}
        disabled={pending || isSelf}
        style={{
          fontSize: '11px', padding: '6px 12px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)', cursor: isSelf ? 'not-allowed' : 'pointer',
          background: 'transparent',
          color: member.is_active ? 'var(--color-critical-text)' : 'var(--color-success-text)',
          whiteSpace: 'nowrap',
        }}
      >
        {member.is_active ? (lang === 'fr' ? 'Désactiver' : 'Deactivate') : (lang === 'fr' ? 'Réactiver' : 'Reactivate')}
      </button>
    </div>
  )
}
