// app/(authenticated)/admissions/list/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import AdmissionListRow from '@/components/AdmissionListRow'
import NewAdmissionForm from '@/components/NewAdmissionForm'

export default async function AdmissionsListPage() {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data: admissions, error } = await supabase
    .from('admissions')
    .select('id, admission_number, source, status, recommended_at, patients(full_name), wards(name), beds(bed_number)')
    .order('recommended_at', { ascending: false })

  const { data: wardsWithBeds } = await supabase
    .from('wards')
    .select('id, name, beds(id, bed_number, status)')
    .eq('is_active', true)
    .order('name')

  const wardsForActions = (wardsWithBeds ?? []).map((w: any) => ({
    id: w.id,
    name: w.name,
    beds: (w.beds ?? []).filter((b: any) => b.status === 'available').map((b: any) => ({ id: b.id, bed_number: b.bed_number })),
  }))

  const { data: patients } = await supabase
    .from('patients')
    .select('id, full_name, patient_code')
    .eq('clinic_id', staff.clinicId)
    .order('full_name')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/admissions" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
          <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Toutes les admissions</h1>
        </div>
      </div>

      <NewAdmissionForm patients={patients ?? []} />

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', fontFamily: 'var(--font-mono)', marginBottom: '1rem' }}>{error.message}</p>
      )}

      {(!admissions || admissions.length === 0) ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Aucune admission enregistrée.</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr 1.3fr 1fr 1.5fr', gap: '10px', padding: '10px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>
            <span>N° admission</span><span>Patient</span><span>Source</span><span>Service</span><span>Lit</span><span>Statut</span><span>Date</span><span></span>
          </div>
          {admissions.map((a: any) => (
            <AdmissionListRow
              key={a.id}
              admission={{
                id: a.id,
                admission_number: a.admission_number,
                patient_name: a.patients?.full_name ?? '—',
                source: a.source,
                ward_name: a.wards?.name ?? null,
                bed_number: a.beds?.bed_number ?? null,
                status: a.status,
                recommended_at: a.recommended_at,
              }}
              wards={wardsForActions}
            />
          ))}
        </div>
      )}
    </div>
  )
}
