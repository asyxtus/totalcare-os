// components/Skeleton.tsx
// Skeleton loading states for each major module. Each one mirrors the
// real layout closely enough that the page feels stable during load
// rather than flashing from blank to full content.

function Bar({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: 'var(--radius-sm)' }} />
  )
}
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '10px',
    }}>
      {children}
    </div>
  )
}
function Row() {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 0',
      borderBottom: '1px solid var(--color-border-subtle)' }}>
      <Bar w="35%" />
      <Bar w="20%" />
      <Bar w="15%" />
      <Bar w="10%" />
    </div>
  )
}

export function PageSkeleton({ rows = 5, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div style={{ maxWidth: '900px' }}>
      {title && (
        <div style={{ marginBottom: '1.25rem' }}>
          <Bar w={180} h={18} />
          <div style={{ marginTop: '6px' }}><Bar w={140} h={12} /></div>
        </div>
      )}
      <Card>
        {Array.from({ length: rows }).map((_, i) => <Row key={i} />)}
      </Card>
    </div>
  )
}

export function QueueSkeleton() {
  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <Bar w={160} h={18} />
        <div style={{ marginTop: '6px' }}><Bar w={120} h={12} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
        {[0,1,2].map(i => (
          <Card key={i}>
            <Bar w={40} h={22} />
            <div style={{ marginTop: '6px' }}><Bar w="70%" h={11} /></div>
          </Card>
        ))}
      </div>
      <Card>{Array.from({ length: 6 }).map((_, i) => <Row key={i} />)}</Card>
    </div>
  )
}

export function AdminSkeleton() {
  return (
    <div style={{ maxWidth: '960px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Bar w={200} h={18} />
        <div style={{ marginTop: '6px' }}><Bar w={150} h={12} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
        {[0,1,2,3,4].map(i => (
          <Card key={i}>
            <Bar w={36} h={22} />
            <div style={{ marginTop: '6px' }}><Bar w="80%" h={11} /></div>
          </Card>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border)', marginBottom: '1.25rem' }}>
        {[0,1,2,3,4].map(i => <div key={i} className="skeleton" style={{ width: 90, height: 36, borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', marginBottom: -1 }} />)}
      </div>
      <Card>{Array.from({ length: 8 }).map((_, i) => <Row key={i} />)}</Card>
    </div>
  )
}

export function PatientDetailSkeleton() {
  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        <div style={{ flex: 1 }}>
          <Bar w="50%" h={18} />
          <div style={{ marginTop: '6px' }}><Bar w="30%" h={12} /></div>
        </div>
      </div>
      <Card><Bar w="100%" h={80} /></Card>
      <Card>{Array.from({ length: 5 }).map((_, i) => <Row key={i} />)}</Card>
    </div>
  )
}
