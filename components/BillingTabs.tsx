'use client'

// components/BillingTabs.tsx

import { useState } from 'react'
import {
  ListOrdered, Siren, UserSearch, ShieldPlus, BadgeCheck,
  Scale, TrendingUp, ReceiptText, Clock,
} from 'lucide-react'
import { TabBar, type TabDef } from './ui'

type BillingTab = 'queue' | 'emergency' | 'account' | 'insurance' | 'aging' | 'approvals' | 'reconciliation' | 'revenue' | 'receipts'

function billingTabs(lang: 'fr' | 'en'): TabDef<BillingTab>[] {
  const fr = lang === 'fr'
  return [
    { id: 'queue', label: fr ? "File d'attente caisse" : 'Cashier queue', icon: ListOrdered },
    { id: 'emergency', label: fr ? 'Urgences' : 'Emergency', icon: Siren },
    { id: 'account', label: fr ? 'Compte patient' : 'Patient account', icon: UserSearch },
    { id: 'insurance', label: fr ? 'Assurance' : 'Insurance', icon: ShieldPlus },
    { id: 'aging', label: fr ? 'Créances assureurs' : 'Insurer aging', icon: Clock },
    { id: 'approvals', label: fr ? 'Approbations' : 'Approvals', icon: BadgeCheck },
    { id: 'reconciliation', label: fr ? 'Réconciliation' : 'Reconciliation', icon: Scale },
    { id: 'revenue', label: fr ? 'Recettes' : 'Revenue', icon: TrendingUp },
    { id: 'receipts', label: fr ? 'Reçus' : 'Receipts', icon: ReceiptText },
  ]
}

interface Props {
  lang?: 'fr' | 'en'
  queueContent: React.ReactNode
  emergencyContent: React.ReactNode
  accountContent: React.ReactNode
  insuranceContent: React.ReactNode
  agingContent: React.ReactNode
  approvalsContent: React.ReactNode
  reconciliationContent: React.ReactNode
  revenueContent: React.ReactNode
  receiptsContent: React.ReactNode
}

export default function BillingTabs({
  lang = 'fr', queueContent, emergencyContent, accountContent, insuranceContent, agingContent, approvalsContent, reconciliationContent, revenueContent, receiptsContent,
}: Props) {
  const [activeTab, setActiveTab] = useState<BillingTab>('queue')
  const TABS = billingTabs(lang)

  const contentByTab: Record<BillingTab, React.ReactNode> = {
    queue: queueContent,
    emergency: emergencyContent,
    account: accountContent,
    insurance: insuranceContent,
    aging: agingContent,
    approvals: approvalsContent,
    reconciliation: reconciliationContent,
    revenue: revenueContent,
    receipts: receiptsContent,
  }

  return (
    <div>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {contentByTab[activeTab]}
    </div>
  )
}
