// app/(authenticated)/clinical-alerts/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import AcknowledgeResultButton from '@/components/AcknowledgeResultButton'

export default async function ClinicalAlertsPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: results, error } = await supabase.rpc('critical_results_pending_review', { p_clinic_id: staff.clinicId })

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>{lang === 'fr' ? 'Alertes cliniques' : 'Clinical Alerts'}</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        Résultats de laboratoire critiques en attente de prise en compte par un médecin
      </p>

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', fontFamily: 'var(--font-mono)', marginBottom: '1rem' }}>{error.message}</p>
      )}

      {(!results || results.length === 0) ? (
        <p style={{ fontSize: '13px', color: 'var(--color-success-text)' }}>✓ {lang === 'fr' ? 'Aucun résultat critique en attente.' : 'No critical results pending.'}</p>
      ) : (
        <div>
          {results.map((r: any) => (
            <div key={r.result_id} style={{
              background: 'var(--color-critical-bg)', border: '1px solid var(--color-critical-text)',
              borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '10px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
            }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px', color: 'var(--color-critical-text)' }}>
                  ⚠ {r.patient_name}{r.is_admitted && <span style={{ fontSize: '11px', marginLeft: '8px', padding: '1px 8px', borderRadius: '999px', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>{lang === 'fr' ? 'ADMIS' : 'ADMITTED'}</span>}
                </p>
                <p style={{ fontSize: '13px', margin: '0 0 2px' }}>
                  {r.test_name} — <strong>{r.result_display}</strong>
                </p>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Validé le {new Date(r.verified_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                {r.is_admitted && r.admission_id && (
                  <Link href={`/admissions/${r.admission_id}/care`} style={{
                    fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)', textDecoration: 'none', background: 'var(--color-surface)',
                  }}>
                    Voir le dossier
                  </Link>
                )}
                <AcknowledgeResultButton resultId={r.result_id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
