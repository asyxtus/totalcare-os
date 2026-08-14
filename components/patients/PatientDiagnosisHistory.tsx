import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export default async function PatientDiagnosisHistory({
  patientId,
}: {
  patientId: string
}) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  // Consultations belong to visits in the current schema; resolve the
  // patient's consultations through their visit IDs instead of assuming
  // consultations has a patient_id column.
  const { data: visits } = await supabase
    .from('visits')
    .select('id')
    .eq('clinic_id', staff.clinicId)
    .eq('patient_id', patientId)

  const visitIds = (visits ?? []).map((v) => v.id)
  if (visitIds.length === 0) return null

  const { data: consultations } = await supabase
    .from('consultations')
    .select('id, started_at, visit_id')
    .eq('clinic_id', staff.clinicId)
    .in('visit_id', visitIds)
    .order('started_at', { ascending: false })

  const consultationIds = (consultations ?? []).map((c) => c.id)
  if (consultationIds.length === 0) return null

  const { data: diagnoses, error } = await supabase
    .from('consultation_diagnoses')
    .select('id, consultation_id, diagnosis, icd10_code, is_primary, sequence')
    .eq('clinic_id', staff.clinicId)
    .in('consultation_id', consultationIds)
    .order('sequence', { ascending: true })

  if (error || !diagnoses || diagnoses.length === 0) return null

  const byConsultation = new Map<string, typeof diagnoses>()
  for (const diagnosis of diagnoses) {
    const list = byConsultation.get(diagnosis.consultation_id) ?? []
    list.push(diagnosis)
    byConsultation.set(diagnosis.consultation_id, list)
  }

  const visibleConsultations = (consultations ?? []).filter((c) => byConsultation.has(c.id))
  if (visibleConsultations.length === 0) return null

  const locale = staff.preferredLanguage === 'fr' ? 'fr-FR' : 'en-US'

  return (
    <section style={{ maxWidth: '520px', margin: '1.5rem 0' }}>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
        {staff.preferredLanguage === 'fr' ? 'Historique des diagnostics' : 'Diagnosis history'}
      </p>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
        {visibleConsultations.map((consultation, index) => {
          const rows = byConsultation.get(consultation.id) ?? []
          return (
            <div
              key={consultation.id}
              style={{
                padding: '12px 14px',
                borderBottom: index < visibleConsultations.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '7px' }}>
                {new Date(consultation.started_at).toLocaleDateString(locale)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {rows.map((row) => (
                  <div key={row.id} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
                    <span style={{ minWidth: '52px', fontSize: '10px', fontWeight: row.is_primary ? 600 : 400, color: row.is_primary ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                      {row.is_primary
                        ? (staff.preferredLanguage === 'fr' ? 'PRINC.' : 'PRIMARY')
                        : (staff.preferredLanguage === 'fr' ? 'SECONDAIRE' : 'SECONDARY')}
                    </span>
                    <span>{row.diagnosis}</span>
                    {row.icd10_code && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {row.icd10_code}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
