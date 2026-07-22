// app/(authenticated)/admissions/wards/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import WardForm from '@/components/WardForm'
import WardCard from '@/components/WardCard'

export default async function WardsPage() {
  const supabase = await createClient()

  const { data: wards, error } = await supabase
    .from('wards')
    .select('id, name, code, ward_type, capacity, daily_rate_xaf, beds(id, bed_number, status, bed_type)')
    .eq('is_active', true)
    .order('name')

  return (
    <div style={{ maxWidth: '650px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/admissions" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Services et lits</h1>
      </div>

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontFamily: 'var(--font-mono)' }}>
          {error.message}
        </p>
      )}

      <WardForm />

      {(!wards || wards.length === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Aucun service créé — ajoutez-en un ci-dessus.</p>
      )}

      {(wards ?? []).map((w: any) => (
        <WardCard key={w.id} ward={{
          id: w.id, name: w.name, code: w.code, ward_type: w.ward_type,
          capacity: w.capacity, daily_rate_xaf: w.daily_rate_xaf, beds: w.beds ?? [],
        }} />
      ))}
    </div>
  )
}
