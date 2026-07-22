// app/print/consultations/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export default async function PrintConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const { data: consultation, error } = await supabase
    .from('consultations')
    .select(`
      id, started_at, completed_at, subjective_notes, examination_notes, diagnosis, diagnosis_code, treatment_plan,
      clinics(name, city, quartier, phone),
      visits(patients(full_name, patient_code, date_of_birth, estimated_age, sex), visit_reason),
      staff(full_name, license_number)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !consultation) {
    notFound()
  }

  const clinic = consultation.clinics as any
  const patient = (consultation.visits as any)?.patients
  const visitReason = (consultation.visits as any)?.visit_reason
  const doctor = consultation.staff as any

  const section = (label: string, content: string | null) => content && (
    <div style={{ marginBottom: '18px' }}>
      <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.03em', color: '#5C6B65' }}>
        {label}
      </p>
      <p style={{ fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap' }}>{content}</p>
    </div>
  )

  const L = {
    title: lang === 'fr' ? 'Compte-rendu de consultation' : 'Consultation Report',
    dob: lang === 'fr' ? 'Né(e) le' : 'DOB',
    estAge: lang === 'fr' ? 'ans (estimé)' : 'yrs (estimated)',
    reason: lang === 'fr' ? 'Motif' : 'Reason',
    subjective: lang === 'fr' ? 'Subjectif' : 'Subjective',
    objective: lang === 'fr' ? 'Objectif' : 'Objective',
    assessment: lang === 'fr' ? 'Évaluation' : 'Assessment',
    plan: 'Plan',
    signature: lang === 'fr' ? 'Signature du médecin' : "Doctor's signature",
    no: lang === 'fr' ? 'N°' : 'No.',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', borderBottom: '2px solid #16211E', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>{clinic?.name}</h1>
          <p style={{ fontSize: '13px', color: '#5C6B65', margin: '4px 0 0' }}>
            {clinic?.quartier}, {clinic?.city}
            {clinic?.phone ? ` · ${clinic.phone}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '13px', color: '#5C6B65', margin: 0 }}>{L.title}</p>
          <p style={{ fontSize: '13px', margin: '4px 0 0' }}>
            {new Date(consultation.started_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', margin: '0 0 2px' }}><strong>{patient?.full_name}</strong></p>
        <p style={{ fontSize: '13px', color: '#5C6B65', margin: 0 }}>
          {patient?.patient_code}
          {patient?.date_of_birth
            ? ` · ${L.dob}: ${new Date(patient.date_of_birth).toLocaleDateString(locale)}`
            : patient?.estimated_age
            ? ` · ${patient.estimated_age} ${L.estAge}`
            : ''}
          {patient?.sex ? ` · ${patient.sex}` : ''}
        </p>
        {visitReason && (
          <p style={{ fontSize: '13px', color: '#5C6B65', margin: '4px 0 0' }}>{L.reason}: {visitReason}</p>
        )}
      </div>

      {section(L.subjective, consultation.subjective_notes)}
      {section(L.objective, consultation.examination_notes)}
      {(consultation.diagnosis || consultation.diagnosis_code) && (
        <div style={{ marginBottom: '18px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.03em', color: '#5C6B65' }}>
            {L.assessment}
          </p>
          <p style={{ fontSize: '14px', margin: 0 }}>
            {consultation.diagnosis}
            {consultation.diagnosis_code ? ` (ICD-10: ${consultation.diagnosis_code})` : ''}
          </p>
        </div>
      )}
      {section(L.plan, consultation.treatment_plan)}

      <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '13px', margin: '0 0 40px' }}>{L.signature}</p>
          <div style={{ borderTop: '1px solid #16211E', paddingTop: '6px', minWidth: '200px' }}>
            <p style={{ fontSize: '13px', margin: 0 }}>{doctor?.full_name}</p>
            {doctor?.license_number && (
              <p style={{ fontSize: '11px', color: '#5C6B65', margin: '2px 0 0' }}>{L.no} {doctor.license_number}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
