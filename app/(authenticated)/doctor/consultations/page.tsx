import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export default async function MyConsultationsPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: consultations, error } = await supabase
    .from('consultations')
    .select(`
      id,
      visit_id,
      started_at,
      completed_at,
      signed_at,
      diagnosis,
      treatment_plan,
      visits!inner(
        visit_reason,
        patient_id,
        patients!inner(full_name, patient_code)
      )
    `)
    .eq('doctor_id', staff.staffId)
    .eq('clinic_id', staff.clinicId)
    .order('started_at', { ascending: false })

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <Link href="/doctor" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: 13 }}>
            ← {lang === 'fr' ? 'Retour au module Médecin' : 'Back to Doctor module'}
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '8px 0 4px' }}>
            {lang === 'fr' ? 'Mes consultations' : 'My consultations'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            {lang === 'fr' ? 'Historique des consultations que vous avez réalisées et accès aux notes SOAP.' : 'History of consultations you performed and access to their SOAP notes.'}
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, border: '1px solid var(--color-critical-text)', borderRadius: 'var(--radius-md)', color: 'var(--color-critical-text)', marginBottom: 16 }}>
          {lang === 'fr' ? 'Impossible de charger les consultations.' : 'Unable to load consultations.'}
        </div>
      )}

      {!error && (!consultations || consultations.length === 0) && (
        <div style={{ padding: 24, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: 13 }}>
          {lang === 'fr' ? 'Aucune consultation enregistrée pour ce médecin.' : 'No consultations recorded for this doctor.'}
        </div>
      )}

      {consultations && consultations.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {consultations.map((c: any, i: number) => {
            const patient = c.visits?.patients
            const signed = Boolean(c.signed_at)
            const completed = Boolean(c.completed_at)
            return (
              <div key={c.id} style={{ padding: '14px 16px', borderBottom: i < consultations.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{patient?.full_name ?? '—'}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {patient?.patient_code ?? '—'} · {c.visits?.visit_reason ?? (lang === 'fr' ? 'Consultation' : 'Consultation')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 5 }}>
                      {new Date(c.started_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: signed ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: signed ? 'var(--color-success-text)' : 'var(--color-warning-text)', fontWeight: 600 }}>
                      {signed ? '🔒 ' + (lang === 'fr' ? 'Signée' : 'Signed') : completed ? '✏️ ' + (lang === 'fr' ? 'Non signée' : 'Unsigned') : '• ' + (lang === 'fr' ? 'En cours' : 'In progress')}
                    </span>
                    <Link href={`/visits/${c.visit_id}/consultation-note`} style={{ fontSize: 12, padding: '7px 11px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', textDecoration: 'none', background: 'var(--color-surface)' }}>
                      {signed ? '🔒 ' + (lang === 'fr' ? 'Voir SOAP' : 'View SOAP') : '📝 ' + (lang === 'fr' ? 'Modifier SOAP' : 'Edit SOAP')}
                    </Link>
                    <a href={`/print/consultations/${c.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--color-accent)', textDecoration: 'none' }}>
                      🖨 {lang === 'fr' ? 'Imprimer' : 'Print'}
                    </a>
                  </div>
                </div>
                {(c.diagnosis || c.treatment_plan) && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border-subtle)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {c.diagnosis && <div><strong>{lang === 'fr' ? 'Diagnostic:' : 'Diagnosis:'}</strong> {c.diagnosis}</div>}
                    {c.treatment_plan && <div style={{ marginTop: 3 }}><strong>{lang === 'fr' ? 'Plan:' : 'Plan:'}</strong> {c.treatment_plan}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
