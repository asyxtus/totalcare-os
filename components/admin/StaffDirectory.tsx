'use client'

// components/admin/StaffDirectory.tsx

import { useMemo, useState } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import InviteStaffForm from './InviteStaffForm'
import StaffRow, { type StaffMember } from './StaffRow'
import { ALL_ROLES, ROLE_META, roleLabel } from '@/lib/roleMeta'
import type { StaffRole } from '@/lib/types'

export default function StaffDirectory({
  staff, currentStaffId, lang,
}: { staff: StaffMember[]; currentStaffId: string; lang: 'fr' | 'en' }) {
  const [inviting, setInviting] = useState(false)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all')
  const [showInactive, setShowInactive] = useState(false)

  // Role composition — the thing an admin actually needs at a glance:
  // not just a headcount, but which roles the clinic is thin on. Real
  // information, not decoration, which is why it's counts-per-role
  // rather than a generic total.
  const composition = useMemo(() => {
    const counts = new Map<StaffRole, number>()
    for (const s of staff) {
      if (!s.is_active) continue
      counts.set(s.role, (counts.get(s.role) ?? 0) + 1)
    }
    return ALL_ROLES.filter((r) => (counts.get(r) ?? 0) > 0).map((r) => ({ role: r, count: counts.get(r)! }))
  }, [staff])

  const activeCount = staff.filter((s) => s.is_active).length
  const inactiveCount = staff.length - activeCount

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      if (!showInactive && !s.is_active) return false
      if (roleFilter !== 'all' && s.role !== roleFilter) return false
      if (query.trim() && !s.full_name.toLowerCase().includes(query.trim().toLowerCase())) return false
      return true
    })
  }, [staff, query, roleFilter, showInactive])

  return (
    <div>
      {/* Role composition strip — the signature element for this screen */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {composition.map(({ role, count }) => {
          const meta = ROLE_META[role]
          return (
            <button
              key={role}
              onClick={() => setRoleFilter((f) => (f === role ? 'all' : role))}
              style={{
                display: 'flex', alignItems: 'baseline', gap: '6px', padding: '6px 12px',
                borderRadius: '999px', border: roleFilter === role ? `1px solid var(${meta.textVar})` : '1px solid transparent',
                background: `var(${meta.bgVar})`, cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 700, color: `var(${meta.textVar})` }}>{count}</span>
              <span style={{ fontSize: '11px', color: `var(${meta.textVar})` }}>{roleLabel(role, lang)}</span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'fr' ? 'Rechercher par nom…' : 'Search by name…'}
            style={{
              padding: '7px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', flex: 1, maxWidth: '280px',
            }}
          />
          {roleFilter !== 'all' && (
            <button onClick={() => setRoleFilter('all')} style={{
              fontSize: '11px', padding: '0 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}>
              {lang === 'fr' ? 'Effacer le filtre' : 'Clear filter'}
            </button>
          )}
          {inactiveCount > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              {lang === 'fr' ? `Afficher désactivés (${inactiveCount})` : `Show deactivated (${inactiveCount})`}
            </label>
          )}
        </div>

        {!inviting && (
          <Button icon={UserPlus} onClick={() => setInviting(true)}>
            {lang === 'fr' ? 'Inviter' : 'Invite'}
          </Button>
        )}
      </div>

      {inviting && <InviteStaffForm lang={lang} onDone={() => setInviting(false)} />}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={staff.length === 0
            ? (lang === 'fr' ? 'Aucun membre du personnel pour le moment.' : 'No staff yet.')
            : (lang === 'fr' ? 'Aucun résultat pour ce filtre.' : 'No results for this filter.')}
        />
      ) : (
        <div>
          {filtered.map((member) => (
            <StaffRow key={member.id} member={member} isSelf={member.id === currentStaffId} lang={lang} />
          ))}
        </div>
      )}

      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '1rem' }}>
        {lang === 'fr' ? `${activeCount} actif(s)` : `${activeCount} active`}
        {inactiveCount > 0 ? ` · ${inactiveCount} ${lang === 'fr' ? 'désactivé(s)' : 'deactivated'}` : ''}
      </p>
    </div>
  )
}
