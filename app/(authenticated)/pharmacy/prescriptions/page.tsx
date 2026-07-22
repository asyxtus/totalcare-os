// app/(authenticated)/pharmacy/prescriptions/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

const STATUS_LABELS: Record<string, { fr: string; en: string; bg: string; text: string }> = {
  pending: { fr: 'En attente', en: 'Pending', bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
  partially_dispensed: { fr: 'Partiel', en: 'Partial', bg: 'var(--color-info-bg, #DCEBF5)', text: 'var(--color-info-text, #2A6D9E)' },
  dispensed: { fr: 'Dispensée', en: 'Dispensed', bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
  cancelled: { fr: 'Annulée', en: 'Cancelled', bg: 'var(--color-bg)', text: 'var(--color-text-secondary)' },
}

export default async function PrescriptionsHistoryPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: prescriptions, error } = await supabase
    .from('prescriptions')
    .select('id, status, requires_review, created_at, visits(patients(full_name, patient_code)), prescription_items(id, drug_name_freetext, dose, quantity_prescribed, products(name))')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <a href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</a>
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Pharmacie' : 'Pharmacy'}</span>
      </div>{lang === 'fr' ? 'Ordonnances' : 'Prescriptions'}</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        Historique complet de toutes les ordonnances — pour l'action quotidienne, voir <Link href="/pharmacy/dispensing" style={{ color: 'var(--color-accent)' }}>Dispensation</Link>
      </p>

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', fontFamily: 'var(--font-mono)', marginBottom: '1rem' }}>{error.message}</p>
      )}

      {(!prescriptions || prescriptions.length === 0) ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucune ordonnance enregistrée.':'No prescriptions recorded.'}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '10px', padding: '10px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', minWidth: '520px' }}>
            <span>{lang==='fr'?'Patient':'Patient'}</span><span>{lang==='fr'?'Médicaments':'Medications'}</span><span>{lang==='fr'?'Statut':'Status'}</span><span>Date</span>
          </div>
          {prescriptions.map((rx: any, i: number) => {
            const patient = rx.visits?.patients
            const status = STATUS_LABELS[rx.status] ?? STATUS_LABELS.pending
            const drugList = (rx.prescription_items ?? []).map((it: any) => it.products?.name ?? it.drug_name_freetext).filter(Boolean).join(', ')
            return (
              <Link key={rx.id} href={`/pharmacy/prescriptions/${rx.id}`} style={{
                display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '10px', padding: '10px 14px', fontSize: '13px', alignItems: 'center', minWidth: '520px',
                borderBottom: i < prescriptions.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                textDecoration: 'none', color: 'var(--color-text-primary)',
              }}>
                <span>{patient?.full_name ?? '—'} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>({patient?.patient_code})</span></span>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{drugList || '—'}</span>
                <span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: status.bg, color: status.text }}>{status[lang]}</span>
                  {rx.requires_review && <span style={{ fontSize: '10px', marginLeft: '4px', color: 'var(--color-critical-text)' }}>⚠ révision</span>}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{new Date(rx.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
