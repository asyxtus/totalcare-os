// app/(authenticated)/admissions/discharges/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const DISCHARGE_TYPE_LABELS: Record<string, string> = {
  routine: 'Routine',
  transfer_out: 'Transfert',
  against_medical_advice: 'Contre avis médical',
  deceased: 'Décès',
}

function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`
}

export default async function DischargesHistoryPage() {
  const supabase = await createClient()

  const { data: discharges, error } = await supabase
    .from('admissions')
    .select('id, admission_number, discharge_type, discharge_outcome, discharged_at, patients(full_name, phone), wards(name)')
    .eq('status', 'discharged')
    .order('discharged_at', { ascending: false })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/admissions" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Historique des sorties</h1>
      </div>

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', fontFamily: 'var(--font-mono)', marginBottom: '1rem' }}>{error.message}</p>
      )}

      {(!discharges || discharges.length === 0) ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Aucune sortie enregistrée.</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1.3fr 1.3fr 1.5fr', gap: '10px', padding: '10px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>
            <span>N° admission</span><span>Patient</span><span>Service</span><span>Type</span><span>Sorti le</span><span>Résultat</span><span></span>
          </div>
          {discharges.map((d: any, i: number) => {
            const patient = d.patients
            const message = `Bonjour ${patient?.full_name}, voici votre résumé de sortie ${d.admission_number}. Nous restons à votre disposition.`
            return (
              <div key={d.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1.3fr 1.3fr 1.5fr', gap: '10px', padding: '10px 14px', alignItems: 'center', fontSize: '13px',
                borderBottom: i < discharges.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{d.admission_number}</span>
                <span>{patient?.full_name ?? '—'}</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{d.wards?.name ?? '—'}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{DISCHARGE_TYPE_LABELS[d.discharge_type] ?? d.discharge_type}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{d.discharged_at ? new Date(d.discharged_at).toLocaleString('fr-FR') : '—'}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{d.discharge_outcome ?? '—'}</span>
                <span style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <a href={`/print/admissions/${d.id}`} target="_blank" rel="noopener noreferrer" style={{
                    fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)', textDecoration: 'none',
                  }}>
                    PDF
                  </a>
                  {patient?.phone && (
                    <a href={whatsappLink(patient.phone, message)} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid #25D366',
                      color: '#25D366', textDecoration: 'none',
                    }}>
                      WhatsApp
                    </a>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
