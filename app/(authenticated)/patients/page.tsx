// app/(authenticated)/patients/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { formatAgeDisplay } from '@/lib/utils/age'

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()
  const { q } = await searchParams

  // No need to filter by clinic_id explicitly here — RLS on the patients
  // table already restricts this to the caller's clinic. Filtering here
  // too would be redundant, not a security requirement.
  let query = supabase
    .from('patients')
    .select('id, patient_code, full_name, phone, quartier, date_of_birth, estimated_age, estimated_age_recorded_at, sex, status')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,patient_code.ilike.%${q}%,phone.ilike.%${q}%`)
  }

  const { data: patients, error } = await query

  const copy = staff.preferredLanguage === 'fr'
    ? { title: lang==='fr'?'Patients':'Patients', add: lang==='fr'?'Nouveau patient':'New patient', searchPlaceholder: lang==='fr'?'Nom, code, ou téléphone…':'Name, code, or phone…',
        empty: lang==='fr'?'Aucun patient trouvé.':'No patients found.', errorMsg: lang==='fr'?'Impossible de charger les patients.':'Unable to load patients.' }
    : { title: 'Patients', add: 'New patient', searchPlaceholder: 'Name, code, or phone…',
        empty: 'No patients found.', errorMsg: 'Could not load patients.' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{copy.title}</h1>
        <Link href="/patients/new" style={{
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
          padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px',
          textDecoration: 'none', fontWeight: 500,
        }}>
          + {copy.add}
        </Link>
      </div>

      <form style={{ marginBottom: '1rem' }}>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder={copy.searchPlaceholder}
          style={{
            width: '100%', maxWidth: '360px', padding: '9px 12px',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
            fontSize: '14px', background: 'var(--color-surface)', color: 'var(--color-text-primary)',
          }}
        />
      </form>

      {error && (
        <p style={{ color: 'var(--color-critical-text)', fontSize: '14px' }}>{copy.errorMsg}</p>
      )}

      {!error && patients && patients.length === 0 && (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{copy.empty}</p>
      )}

      {!error && patients && patients.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {patients.map((p, i) => (
            <Link key={p.id} href={`/patients/${p.id}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', textDecoration: 'none', color: 'inherit',
              borderBottom: i < patients.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: '14px' }}>{p.full_name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {p.patient_code}
                  {' · '}{formatAgeDisplay(p.date_of_birth, p.estimated_age, p.estimated_age_recorded_at, staff.preferredLanguage)}
                  {p.sex ? ` · ${p.sex}` : ''}
                  {p.quartier ? ` · ${p.quartier}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {p.phone ?? ''}
                </span>
                {p.status !== 'active' && (
                  <span style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    background: p.status === 'deceased' ? 'var(--color-critical-bg)' : 'var(--color-warning-bg)',
                    color: p.status === 'deceased' ? 'var(--color-critical-text)' : 'var(--color-warning-text)',
                  }}>
                    {p.status === 'deceased' ? (lang==='fr'?'Décédé(e)':'Deceased') : (lang==='fr'?'Inactif':'Inactive')}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
