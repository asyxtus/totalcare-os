'use client'

// components/RoleSwitcher.tsx
//
// Only renders anything when the signed-in person holds more than one
// role — the common case (one role) sees nothing extra at all. Lets
// someone with e.g. nurse + receptionist flip which one they're
// currently "working as," which changes what the nav shows and what
// every RLS-protected action they take is allowed to touch.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { switchActiveRoleAction } from '@/lib/actions/staffAdmin'
import { ROLE_META } from '@/lib/roleMeta'
import type { StaffRole } from '@/lib/types'

export default function RoleSwitcher({
  currentRole, availableRoles, lang,
}: {
  currentRole: StaffRole
  availableRoles: StaffRole[]
  lang: 'fr' | 'en'
}) {
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  if (availableRoles.length <= 1) return null

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as StaffRole
    if (newRole === currentRole) return
    setSwitching(true)
    const result = await switchActiveRoleAction(newRole)
    if (!result || !('error' in result && result.error)) {
      router.refresh()
    }
    setSwitching(false)
  }

  return (
    <select
      value={currentRole}
      onChange={handleChange}
      disabled={switching}
      title={lang === 'fr' ? 'Changer de rôle actif' : 'Switch active role'}
      style={{
        fontSize: '11px', padding: '4px 8px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
        color: 'var(--color-text-secondary)', cursor: switching ? 'wait' : 'pointer',
      }}
    >
      {availableRoles.map((r) => (
        <option key={r} value={r}>
          {lang === 'fr' ? 'Rôle : ' : 'Role: '}{ROLE_META[r][lang === 'fr' ? 'labelFr' : 'labelEn']}
        </option>
      ))}
    </select>
  )
}
