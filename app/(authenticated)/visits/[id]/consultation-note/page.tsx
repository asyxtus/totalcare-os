import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import ConsultationDocumentationPanel from '@/components/ConsultationDocumentationPanel'

export default async function ConsultationNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data: visit, error: visitError } = await supabase
    .from('visits')
    .select('id, patient_id, status, patients(id, full_name, patient_code)')
    .eq('id', id)
    .maybeSingle()
  if (visitError || !visit) notFound()

  const { data: consultation, error: consultationError } = await supabase
    .from('consultations')
    .select('id, doctor_id, started_at, completed_at, signed_at, signed_by, subjective_notes, examination_notes, diagnosis, treatment_plan')
    .eq('visit_id', id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (consultationError || !consultation) notFound()

  if (!consultation.completed_at) {
    return (
      <div style={{ maxWidth: 720 }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Cette consultation n’est pas encore terminée.</p>
        <Link href={`/visits/${id}/consultation`} style={{ color: 'var(--color-accent)' }}>← Retour à la consultation</Link>
      </div>
    )
  }

  const { data: addenda } = await supabase
    .from('consultation_addenda')
    .select('id, section, reason, content, created_at')
    .eq('consultation_id', consultation.id)
    .order('created_at', { ascending: false })

  const patient = visit.patients as any

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <div>
          <Link href="/dashboard" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: 13 }}>← Tableau de bord</Link>
          <h1 style={{ fontSize: 20, margin: '10px 0 2px' }}>Documentation — {patient?.full_name}</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>{patient?.patient_code}</div>
        </div>
        <div style={{ fontSize: 12, textAlign: 'right', color: 'var(--color-text-secondary)' }}>
          {consultation.signed_at ? '🔒 Note signée' : '✏️ Note non signée'}
          <br />
          {new Date(consultation.completed_at).toLocaleString(staff.preferredLanguage === 'fr' ? 'fr-FR' : 'en-US')}
        </div>
      </div>

      <ConsultationDocumentationPanel
        visitId={id}
        consultationId={consultation.id}
        doctorId={consultation.doctor_id}
        currentStaffId={staff.staffId}
        completedAt={consultation.completed_at}
        signedAt={consultation.signed_at}
        signedBy={consultation.signed_by}
        initialValues={{
          subjective: consultation.subjective_notes ?? '',
          objective: consultation.examination_notes ?? '',
          diagnosis: consultation.diagnosis ?? '',
          treatmentPlan: consultation.treatment_plan ?? '',
        }}
        addenda={addenda ?? []}
      />
    </div>
  )
}
