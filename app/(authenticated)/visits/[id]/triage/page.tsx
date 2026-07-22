// app/(authenticated)/visits/[id]/triage/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import TriageForm from '@/components/TriageForm'

export default async function TriagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: visit, error } = await supabase
    .from('visits')
    .select('id, clinic_id, status, visit_reason, is_emergency, patients(id, full_name, patient_code, allergies)')
    .eq('id', id)
    .maybeSingle()

  if (error || !visit) {
    notFound()
  }

  if (visit.status !== 'triage') {
    return (
      <div>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          {lang === 'fr' ? "Cette visite n'est pas (ou plus) au stade du triage." : 'This visit is not (or no longer) at the triage stage.'}
        </p>
        <Link href="/dashboard" style={{ fontSize: '13px', color: 'var(--color-accent)' }}>
          {lang === 'fr' ? "Retour à la file d'attente" : 'Back to queue'}
        </Link>
      </div>
    )
  }

  const patient = visit.patients as any

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>
            Triage — {patient?.full_name}
            {visit.is_emergency && (
              <span style={{
                fontSize: '11px', marginLeft: '8px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', verticalAlign: 'middle',
              }}>
                URGENCE
              </span>
            )}
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {patient?.patient_code}
            {visit.visit_reason ? ` · ${visit.visit_reason}` : ''}
          </p>
        </div>
      </div>

      {patient?.allergies && (
        <div style={{
          background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem',
          fontSize: '13px', fontWeight: 500,
        }}>
          ⚠ Allergies : {patient.allergies}
        </div>
      )}

      <TriageForm visitId={visit.id} clinicId={visit.clinic_id} />
    </div>
  )
}
