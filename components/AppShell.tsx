'use client'

// components/AppShell.tsx

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Siren, ConciergeBell, HeartPulse, Stethoscope,
  Users, Pill, Microscope, Receipt, BedDouble, ShieldCheck, BookOpen,
  type LucideIcon,
} from 'lucide-react'
import { useNetworkStatus, usePendingSyncCount } from '@/lib/hooks/useNetworkStatus'
import PreferenceToggles from '@/components/PreferenceToggles'
import { LangProvider } from '@/lib/i18n/LangContext'
import type { StaffRole } from '@/lib/types'

// Every nav item declares which roles can see it. A receptionist never
// sees a "Controlled Drugs" link even hidden-but-present in the DOM —
// this list controls what renders at all, matching (not replacing) the
// RLS enforcement already in the database. UI hiding is a UX convenience;
// RLS is the actual security boundary.
//
// Icons are real lucide components now — the string `icon` field had
// existed on every item since the shell was first built but was never
// actually rendered anywhere, found during the full UX audit.
const NAV_ITEMS: { href: string; labelFr: string; labelEn: string; icon: LucideIcon; roles: StaffRole[] }[] = [
  { href: '/dashboard', labelFr: 'Tableau de bord', labelEn: 'Dashboard', icon: LayoutDashboard,
    roles: ['admin', 'doctor', 'nurse', 'pharmacist', 'lab_technician', 'receptionist', 'billing_clerk', 'auditor'] },
  { href: '/clinical-alerts', labelFr: 'Alertes cliniques', labelEn: 'Clinical Alerts', icon: Siren,
    roles: ['admin', 'doctor', 'nurse'] },
  { href: '/reception', labelFr: 'Réception', labelEn: 'Reception', icon: ConciergeBell,
    roles: ['admin', 'receptionist', 'doctor', 'nurse'] },
  { href: '/nursing', labelFr: 'Soins infirmiers', labelEn: 'Nursing', icon: HeartPulse,
    roles: ['admin', 'nurse'] },
  { href: '/doctor', labelFr: 'Médecin', labelEn: 'Doctor', icon: Stethoscope,
    roles: ['admin', 'doctor'] },
  { href: '/patients', labelFr: 'Patients', labelEn: 'Patients', icon: Users,
    roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
  { href: '/pharmacy', labelFr: 'Pharmacie', labelEn: 'Pharmacy', icon: Pill,
    roles: ['admin', 'pharmacist'] },
  { href: '/laboratory', labelFr: 'Laboratoire', labelEn: 'Laboratory', icon: Microscope,
    roles: ['admin', 'lab_technician'] },
  { href: '/billing', labelFr: 'Facturation', labelEn: 'Billing', icon: Receipt,
    roles: ['admin', 'receptionist', 'billing_clerk'] },
  { href: '/admissions', labelFr: 'Admissions', labelEn: 'Admissions', icon: BedDouble,
    roles: ['admin', 'nurse', 'doctor'] },
  { href: '/admin', labelFr: 'Administration', labelEn: 'Administration', icon: ShieldCheck,
    roles: ['admin', 'auditor'] },
  { href: '/docs', labelFr: 'Documentation', labelEn: 'Documentation', icon: BookOpen,
    roles: ['admin', 'doctor', 'nurse', 'pharmacist', 'lab_technician', 'receptionist', 'billing_clerk', 'auditor'] },
]

interface AppShellProps {
  clinicName: string
  staffName: string
  staffInitials: string
  staffRole: StaffRole
  lang: 'fr' | 'en'
  children: React.ReactNode
}

export default function AppShell({ clinicName, staffName, staffInitials, staffRole, lang, children }: AppShellProps) {
  const pathname = usePathname()
  const isOnline = useNetworkStatus()
  const pendingSync = usePendingSyncCount()

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(staffRole))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: '100vh' }}
         className="shell-grid">

      {/* DESKTOP SIDEBAR — hidden below 768px via CSS below */}
      <nav aria-label={lang === 'fr' ? 'Navigation principale' : 'Main navigation'}
           className="sidebar"
           style={{
             background: 'var(--color-sidebar)',
             padding: '1.25rem 0',
             display: 'flex',
             flexDirection: 'column',
             justifyContent: 'space-between',
           }}>
        <div>
          <p style={{ color: 'var(--color-text-on-dark)', fontSize: '13px', fontWeight: 500, padding: '0 1.25rem', margin: '0 0 1.5rem' }}>
            {clinicName}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {visibleItems.map((item) => {
              const active = pathname?.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} className="nav-link" data-active={active}>
                  {active && (
                    <svg width="3" height="18" aria-hidden="true"
                         style={{ position: 'absolute', left: 0, top: '9px' }}>
                      <polyline points="0,9 1,9 1.5,2 2,16 3,9" stroke="var(--color-accent)" strokeWidth="1.5" fill="none" />
                    </svg>
                  )}
                  <Icon size={16} aria-hidden />
                  <span>{lang === 'fr' ? item.labelFr : item.labelEn}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <PreferenceToggles lang={lang} />
          <NetworkIndicator isOnline={isOnline} lang={lang} />
          {pendingSync > 0 && <SyncBadge count={pendingSync} lang={lang} />}
        </div>
      </nav>

      {/* MOBILE TOP BAR + BOTTOM TAB BAR — shown only below 768px */}
      <div className="mobile-topbar" style={{
        display: 'none', background: 'var(--color-sidebar)', padding: '14px 16px',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ color: 'var(--color-text-on-dark)', fontSize: '13px', fontWeight: 500, margin: 0 }}>{clinicName}</p>
          <NetworkIndicator isOnline={isOnline} lang={lang} compact />
        </div>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-accent)',
          color: 'var(--color-accent-text-on)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '11px', fontWeight: 500,
        }} aria-label={staffName}>
          {staffInitials}
        </div>
      </div>

      {pendingSync > 0 && (
        <div className="mobile-topbar" style={{ display: 'none' }}>
          <SyncBadge count={pendingSync} lang={lang} compact />
        </div>
      )}

      <main style={{ padding: '1.5rem', background: 'var(--color-bg)' }}>
        <LangProvider lang={lang}>
          {children}
        </LangProvider>
      </main>

      <nav aria-label={lang === 'fr' ? 'Navigation mobile' : 'Mobile navigation'}
           className="mobile-tabbar"
           style={{
             display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
             background: 'var(--color-sidebar)', padding: '6px 0 8px',
             borderTop: '1px solid var(--color-sidebar-surface-raised)',
             overflowX: 'auto', WebkitOverflowScrolling: 'touch',
           }}>
        <div style={{
          display: 'flex', gap: '4px', padding: '0 8px',
          minWidth: 'max-content',
        }}>
          {visibleItems.map((item) => {
            const active = pathname?.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                textDecoration: 'none', position: 'relative', padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                color: active ? 'var(--color-text-on-dark)' : 'var(--color-text-on-dark-secondary)',
                background: active ? 'var(--color-sidebar-surface-raised)' : 'transparent',
                minWidth: '52px',
              }}>
                <Icon size={18} aria-hidden />
                <span style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>
                  {lang === 'fr' ? item.labelFr : item.labelEn}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      <style jsx>{`
        @media (max-width: 768px) {
          .shell-grid { grid-template-columns: 1fr !important; }
          .sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-tabbar { display: flex !important; }
          main { padding-bottom: 5rem !important; } /* clear the fixed bottom tab bar */
        }
      `}</style>
    </div>
  )
}

function NetworkIndicator({ isOnline, lang, compact }: { isOnline: boolean; lang: 'fr' | 'en'; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: compact ? '3px' : 0 }}
         role="status">
      <span aria-hidden="true" style={{
        width: '7px', height: '7px', borderRadius: '50%',
        background: isOnline ? 'var(--color-success-text)' : 'var(--color-critical-text)',
        display: 'inline-block',
      }} />
      <span style={{ fontSize: compact ? '10px' : '11px', color: 'var(--color-text-on-dark-secondary)' }}>
        {isOnline
          ? (lang === 'fr' ? 'En ligne' : 'Online')
          : (lang === 'fr' ? 'Hors ligne' : 'Offline')}
      </span>
    </div>
  )
}

function SyncBadge({ count, lang, compact }: { count: number; lang: 'fr' | 'en'; compact?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      background: 'var(--color-sidebar-surface-raised)',
      padding: compact ? '4px 8px' : '5px 8px', borderRadius: 'var(--radius-sm)',
    }}>
      <span style={{ fontSize: compact ? '10px' : '11px', color: 'var(--color-warning-text)' }}>
        {count} {lang === 'fr' ? 'en attente de sync' : 'pending sync'}
      </span>
    </div>
  )
}
