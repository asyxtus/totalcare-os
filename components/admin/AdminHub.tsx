'use client'

// components/admin/AdminHub.tsx

import { useMemo, useState } from 'react'
import { Users, Tags, FlaskConical, BedDouble, ScrollText, type LucideIcon } from 'lucide-react'
import { TabBar } from '@/components/ui'
import StaffDirectory from './StaffDirectory'
import type { StaffMember } from './StaffRow'
import ServicesPanel from './pricing/ServicesPanel'
import LabTestsSection from './pricing/LabTestsSection'
import LabPanelsSection from './pricing/LabPanelsSection'
import InpatientPricingSection from './pricing/InpatientPricingSection'
import AuditLogViewer from './AuditLogViewer'
import type { AuditLogEntry } from '@/lib/actions/auditLog'

type Tab = 'users' | 'services' | 'lab' | 'inpatient' | 'audit'

interface ServicePrice { id: string; service_name: string; category: string; price_xaf: number; is_active: boolean }
interface ClinicTest {
  id: string; price_xaf: number; is_active: boolean
  lab_test_catalog: { id: string; name_fr: string; name_en: string; category: string; result_type: string }
}
interface ClinicPanel {
  id: string; price_xaf: number; is_active: boolean
  lab_panels: { id: string; name_fr: string; name_en: string; category: string; lab_panel_items: { lab_test_catalog_id: string; lab_test_catalog: { name_fr: string } }[] }
}
interface CatalogTest { id: string; name_fr: string; name_en: string; category: string }
interface Ward { id: string; name: string; code: string | null; daily_rate_xaf: number | null; is_active: boolean }

export default function AdminHub({
  role, staff, currentStaffId, services, clinicTests, clinicPanels, fullCatalog, wards, nursingRate, auditEntries, lang,
}: {
  role: 'admin' | 'auditor'
  staff: StaffMember[]; currentStaffId: string
  services: ServicePrice[]; clinicTests: ClinicTest[]; clinicPanels: ClinicPanel[]; fullCatalog: CatalogTest[]
  wards: Ward[]; nursingRate: number | null
  auditEntries: AuditLogEntry[]
  lang: 'fr' | 'en'
}) {
  // Auditors get exactly one tab — the audit log itself — and nothing
  // else, since the other four are privileged write surfaces (invite
  // staff, change prices) an oversight role has no business acting on,
  // and no reason to even see given it can't act on it anyway.
  const [tab, setTab] = useState<Tab>(role === 'auditor' ? 'audit' : 'users')

  const activeStaffCount = useMemo(() => staff.filter((s) => s.is_active).length, [staff])
  const activeServiceCount = useMemo(() => services.filter((s) => s.is_active).length, [services])
  const activeLabCount = useMemo(
    () => clinicTests.filter((t) => t.is_active).length + clinicPanels.filter((p) => p.is_active).length,
    [clinicTests, clinicPanels]
  )
  const activeWardCount = useMemo(() => wards.filter((w) => w.is_active && w.daily_rate_xaf).length, [wards])

  const allTabs: { id: Tab; label: string; stat: number; statLabel: string; icon: LucideIcon }[] = [
    { id: 'users', label: lang === 'fr' ? 'Personnel' : 'Users', stat: activeStaffCount, statLabel: lang === 'fr' ? 'actifs' : 'active', icon: Users },
    { id: 'services', label: lang === 'fr' ? 'Services' : 'Services', stat: activeServiceCount, statLabel: lang === 'fr' ? 'tarifés' : 'priced', icon: Tags },
    { id: 'lab', label: lang === 'fr' ? 'Laboratoire' : 'Laboratory', stat: activeLabCount, statLabel: lang === 'fr' ? 'actifs' : 'active', icon: FlaskConical },
    { id: 'inpatient', label: lang === 'fr' ? 'Hospitalisation' : 'Inpatient', stat: activeWardCount, statLabel: lang === 'fr' ? 'tarifés' : 'priced', icon: BedDouble },
    { id: 'audit', label: lang === 'fr' ? "Journal d'audit" : 'Audit Log', stat: auditEntries.length, statLabel: lang === 'fr' ? 'récentes' : 'recent', icon: ScrollText },
  ]

  const tabs = role === 'auditor' ? allTabs.filter((t) => t.id === 'audit') : allTabs

  return (
    <div>
      {tabs.length > 1 && (
        <>
          {/* Overview strip — real counts per section, doubling as tab
              nav. Not decoration: each number is what an admin actually
              wants at a glance before deciding which tab to open. */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, gap: '10px', marginBottom: '1.5rem' }}>
            {tabs.map((t) => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="card card-interactive"
                  style={{
                    textAlign: 'left', padding: '14px 16px', cursor: 'pointer',
                    background: active ? 'var(--color-accent)' : 'var(--color-surface)',
                    borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{
                      fontSize: '20px', fontWeight: 700, margin: 0,
                      color: active ? 'var(--color-accent-text-on)' : 'var(--color-text-primary)',
                    }}>
                      {t.stat}
                    </p>
                    <Icon size={16} aria-hidden style={{
                      color: active ? 'var(--color-accent-text-on)' : 'var(--color-text-secondary)',
                      opacity: active ? 0.9 : 0.6,
                    }} />
                  </div>
                  <p style={{
                    fontSize: '12px', margin: '2px 0 0',
                    color: active ? 'var(--color-accent-text-on)' : 'var(--color-text-secondary)',
                  }}>
                    {t.label} · {t.statLabel}
                  </p>
                </button>
              )
            })}
          </div>

          <TabBar tabs={tabs} active={tab} onChange={setTab} />
        </>
      )}

      {tab === 'users' && (
        <StaffDirectory staff={staff} currentStaffId={currentStaffId} lang={lang} />
      )}

      {tab === 'services' && (
        <ServicesPanel services={services} lang={lang} />
      )}

      {tab === 'lab' && (
        <div>
          <LabTestsSection clinicTests={clinicTests} lang={lang} />
          <div style={{ height: '2rem' }} />
          <LabPanelsSection clinicPanels={clinicPanels} fullCatalog={fullCatalog} lang={lang} />
        </div>
      )}

      {tab === 'inpatient' && (
        <InpatientPricingSection wards={wards} nursingRate={nursingRate} lang={lang} />
      )}

      {tab === 'audit' && (
        <AuditLogViewer initialEntries={auditEntries} />
      )}
    </div>
  )
}
