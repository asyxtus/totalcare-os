import Link from 'next/link'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff()
  const fr = staff.preferredLanguage === 'fr'

  return (
    <div>
      <nav aria-label={fr ? 'Navigation médecin' : 'Doctor navigation'} style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link href="/doctor" style={{ padding: '7px 11px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', color: 'var(--color-text-primary)', background: 'var(--color-surface)', fontSize: 12 }}>
          🩺 {fr ? 'File médecin' : 'Doctor queue'}
        </Link>
        <Link href="/doctor/consultations" style={{ padding: '7px 11px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', color: 'var(--color-text-primary)', background: 'var(--color-surface)', fontSize: 12 }}>
          📋 {fr ? 'Mes consultations' : 'My consultations'}
        </Link>
      </nav>
      {children}
    </div>
  )
}
