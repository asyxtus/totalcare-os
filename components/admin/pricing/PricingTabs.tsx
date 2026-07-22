// components/admin/pricing/PricingTabs.tsx
'use client'

import { useState } from 'react'

export default function PricingTabs({
  servicesContent, labContent, lang,
}: { servicesContent: React.ReactNode; labContent: React.ReactNode; lang: 'fr' | 'en' }) {
  const [tab, setTab] = useState<'services' | 'lab'>('services')

  const tabs: { id: 'services' | 'lab'; label: string }[] = [
    { id: 'services', label: lang === 'fr' ? 'Services' : 'Services' },
    { id: 'lab', label: lang === 'fr' ? 'Laboratoire' : 'Laboratory' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border)', marginBottom: '1.25rem' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              fontSize: '13px', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
              color: tab === t.id ? 'var(--color-accent)' : 'var(--color-text-primary)',
              borderBottom: tab === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
              fontWeight: tab === t.id ? 500 : 400, marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'services' ? servicesContent : labContent}
    </div>
  )
}
