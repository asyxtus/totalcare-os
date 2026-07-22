'use client'

// components/PharmacyReportsTabs.tsx

import { useState } from 'react'
import { useLang } from '@/lib/i18n/LangContext'

const TABS = [
  { id: 'daily', fr: 'Tableau quotidien', en: 'Tableau quotidien' },
  { id: 'profitability', fr: 'Rentabilité', en: 'Profitability' },
  { id: 'stock', fr: 'Produits vendeurs / dormants', en: 'Produits vendeurs / dormants' },
  { id: 'unavailable', fr: 'TVA · Historique', en: 'TVA · Historique' },
]

interface Props {
  dailyContent: React.ReactNode
  profitabilityContent: React.ReactNode
  stockContent: React.ReactNode
  unavailableContent: React.ReactNode
}

// NOTE: content is passed as already-rendered React nodes (props), not
// as a render-prop function — a Server Component can't pass a function
// as children/props to a Client Component (functions aren't
// serializable across that boundary), but pre-rendered JSX is fine.
export default function PharmacyReportsTabs({
  dailyContent, profitabilityContent, stockContent, unavailableContent,
}: Props) {
  const lang = useLang()
  const [activeTab, setActiveTab] = useState('daily')

  const contentByTab: Record<string, React.ReactNode> = {
    daily: dailyContent,
    profitability: profitabilityContent,
    stock: stockContent,
    unavailable: unavailableContent,
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border)', marginBottom: '1.25rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              fontSize: '13px', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
              fontWeight: activeTab === tab.id ? 500 : 400, marginBottom: '-1px',
            }}
          >
            {tab[lang] ?? tab.fr}
          </button>
        ))}
      </div>
      {contentByTab[activeTab]}
    </div>
  )
}
