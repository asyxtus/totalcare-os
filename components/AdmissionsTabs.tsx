'use client'

// components/AdmissionsTabs.tsx

import { useState } from 'react'
import {
  LayoutDashboard, ClipboardList, Building2, BedDouble,
  Map, LogOut, BarChart3,
} from 'lucide-react'
import { TabBar, type TabDef } from './ui'

type AdmissionsTab = 'dashboard' | 'admissions' | 'wards' | 'beds' | 'map' | 'discharges' | 'reports'

function admissionsTabs(lang: 'fr' | 'en'): TabDef<AdmissionsTab>[] {
  const fr = lang === 'fr'
  return [
    { id: 'dashboard', label: fr ? 'Tableau de bord' : 'Dashboard', icon: LayoutDashboard },
    { id: 'admissions', label: 'Admissions', icon: ClipboardList },
    { id: 'wards', label: fr ? 'Services' : 'Wards', icon: Building2 },
    { id: 'beds', label: fr ? 'Lits' : 'Beds', icon: BedDouble },
    { id: 'map', label: fr ? 'Carte' : 'Map', icon: Map },
    { id: 'discharges', label: fr ? 'Sorties' : 'Discharges', icon: LogOut },
    { id: 'reports', label: fr ? 'Rapports' : 'Reports', icon: BarChart3 },
  ]
}

interface Props {
  lang?: 'fr' | 'en'
  dashboardContent: React.ReactNode
  admissionsContent: React.ReactNode
  wardsContent: React.ReactNode
  bedsContent: React.ReactNode
  mapContent: React.ReactNode
  dischargesContent: React.ReactNode
  reportsContent: React.ReactNode
}

export default function AdmissionsTabs({
  lang = 'fr', dashboardContent, admissionsContent, wardsContent, bedsContent, mapContent, dischargesContent, reportsContent,
}: Props) {
  const [activeTab, setActiveTab] = useState<AdmissionsTab>('dashboard')
  const TABS = admissionsTabs(lang)

  const contentByTab: Record<AdmissionsTab, React.ReactNode> = {
    dashboard: dashboardContent,
    admissions: admissionsContent,
    wards: wardsContent,
    beds: bedsContent,
    map: mapContent,
    discharges: dischargesContent,
    reports: reportsContent,
  }

  return (
    <div>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {contentByTab[activeTab]}
    </div>
  )
}
