import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import EditPatientForm from '@/components/EditPatientForm'

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data: patient, error } = await supabase
    .from('patients')
    .select('id, full_name, sex, date_of_birth, estimated_age, national_id_number, phone, quartier, city, next_of_kin_name, next_of_kin_phone, allergies, chronic_conditions, payment_category')
    .eq('id', id)
    .eq('clinic_id', staff.clinicId)
    .maybeSingle()

  if (error || !patient) notFound()

  return (
    <div style={{ maxWidth: '620px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href={`/patients/${id}`} style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{staff.preferredLanguage === 'fr' ? 'Modifier le patient' : 'Edit patient'}</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>{patient.full_name}</p>
        </div>
      </div>
      <EditPatientForm patient={patient} />
    </div>
  )
}
