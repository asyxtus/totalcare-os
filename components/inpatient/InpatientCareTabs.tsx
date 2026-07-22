'use client'

// components/inpatient/InpatientCareTabs.tsx

import { useState } from 'react'

const TABS = [
  { id: 'rounds', label: 'Rounds' },
  { id: 'mar', label: 'MAR' },
  { id: 'care', label: 'Care' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'labs', label: 'Labs' },
]

interface Props {
  roundsContent: React.ReactNode
  marContent: React.ReactNode
  careContent: React.ReactNode
  vitalsContent: React.ReactNode
  labsContent: React.ReactNode
}

export default function InpatientCareTabs({ roundsContent, marContent, careContent, vitalsContent, labsContent }: Props) {
  const [activeTab, setActiveTab] = useState('rounds')

  const contentByTab: Record<string, React.ReactNode> = {
    rounds: roundsContent, mar: marContent, care: careContent, vitals: vitalsContent, labs: labsContent,
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
              color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-primary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
              fontWeight: activeTab === tab.id ? 500 : 400, marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {contentByTab[activeTab]}
    </div>
  )
}
