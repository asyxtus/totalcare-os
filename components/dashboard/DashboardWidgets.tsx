// components/dashboard/DashboardWidgets.tsx
// Shared building blocks for every productivity/analytics panel in the
// app — extracted from ExecutiveDashboard rather than copy-pasted, so
// the audit fixes applied there (comparison baselines, honest "no
// reference yet" state) automatically apply everywhere else too.

export function Bar({ label, value, max, lang = 'fr' }: { label: string; value: number; max: number; lang?: 'fr' | 'en' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', width: '32px' }}>{label}</span>
      <div style={{ flex: 1, background: 'var(--color-bg)', borderRadius: '3px', height: '14px', position: 'relative' }}>
        <div style={{ width: `${pct}%`, background: 'var(--color-accent)', height: '100%', borderRadius: '3px', minWidth: value > 0 ? '3px' : 0 }} />
      </div>
      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', width: '48px', textAlign: 'right' }}>
        {value.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}
      </span>
    </div>
  )
}

export function DeltaBadge({ pct, labelFr = 'vs semaine précédente', labelEn = 'vs previous week', lang = 'fr' }: { pct: number | null; labelFr?: string; labelEn?: string; lang?: 'fr' | 'en' }) {
  if (pct === null) {
    return <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?`${labelFr} : pas de référence`:`${labelEn}: no reference`}</span>
  }
  const isUp = pct >= 0
  return (
    <span style={{ fontSize: '11px', fontWeight: 500, color: isUp ? 'var(--color-success-text)' : 'var(--color-critical-text)' }}>
      {isUp ? '▲' : '▼'} {Math.abs(pct)}% <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>{labelFr}</span>
    </span>
  )
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>{title}</p>
      {children}
    </div>
  )
}

export function computeDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
