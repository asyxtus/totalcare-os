// app/(authenticated)/pharmacy/recalls/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import InitiateRecallForm from '@/components/InitiateRecallForm'

export default async function RecallsPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: activeBatches } = await supabase
    .from('batches')
    .select('id, batch_number, expiry_date, products(name)')
    .eq('clinic_id', staff.clinicId)
    .eq('status', 'active')
    .order('expiry_date')

  const batchOptions = (activeBatches ?? []).map((b: any) => ({
    id: b.id, productName: b.products?.name ?? '—', batchNumber: b.batch_number, expiryDate: b.expiry_date,
  }))

  const { data: recalls } = await supabase
    .from('batch_recalls')
    .select('id, reason, status, initiated_at, batches(batch_number, products(name))')
    .order('initiated_at', { ascending: false })

  return (
    <div style={{ maxWidth: '650px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Rappels de lots</h1>
      </div>

      <InitiateRecallForm batches={batchOptions} />

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
        Historique des rappels
      </p>
      {(!recalls || recalls.length === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucun rappel enregistré.':'No recalls recorded.'}</p>
      )}
      {recalls && recalls.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {recalls.map((r: any, i: number) => (
            <Link key={r.id} href={`/pharmacy/recalls/${r.id}`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px',
              textDecoration: 'none', color: 'inherit',
              borderBottom: i < recalls.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: '13px' }}>
                  {r.batches?.products?.name} — lot {r.batches?.batch_number}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {new Date(r.initiated_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')} · {r.reason}
                </div>
              </div>
              <span style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                background: r.status === 'active' ? 'var(--color-critical-bg)' : 'var(--color-success-bg)',
                color: r.status === 'active' ? 'var(--color-critical-text)' : 'var(--color-success-text)',
              }}>
                {r.status === 'active' ? (lang==='fr'?'Actif':'Active') : (lang==='fr'?'Résolu':'Resolved')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
