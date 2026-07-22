// components/dashboard/StatCard.tsx
// Current-state snapshot (e.g. "3 waiting right now"), distinct from the
// week-over-week productivity trend cards. Both have real value: this
// answers "what does my queue look like right now," the trend answers
// "how has my week gone."

export function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: 'warning' | 'critical' }) {
  const color = accent === 'critical' ? 'var(--color-critical-text)' : accent === 'warning' ? 'var(--color-warning-text)' : 'var(--color-text-primary)'
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderLeft: accent ? `3px solid ${color}` : '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', minWidth: '120px',
    }}>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
        {label}
      </p>
      <p style={{ fontSize: '22px', fontWeight: 500, margin: 0, color, fontFamily: 'var(--font-mono)' }}>
        {value}
      </p>
    </div>
  )
}

export function StatCardRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
      {children}
    </div>
  )
}
