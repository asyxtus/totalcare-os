// app/(authenticated)/pharmacy/returns/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import SupplierReturnForm from '@/components/SupplierReturnForm'

export default async function ReturnsPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: suppliers } = await supabase.from('suppliers').select('id, name').eq('is_active', true).order('name')
  const { data: batchRows, error: batchError } = await supabase.rpc('get_active_batches_with_stock', { p_clinic_id: staff.clinicId })

  const batches = (batchRows ?? [])
    .filter((b: any) => b.on_hand > 0)
    .map((b: any) => ({ id: b.batch_id, productName: b.product_name, batchNumber: b.batch_number, onHand: b.on_hand }))

  const { data: returns } = await supabase
    .from('supplier_returns')
    .select('id, quantity, reason, created_at, suppliers(name), batches(batch_number, products(name))')
    .order('created_at', { ascending: false })

  return (
    <div style={{ maxWidth: '650px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Retours fournisseurs</h1>
      </div>

      {batchError && (
        <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontFamily: 'var(--font-mono)' }}>
          get_active_batches_with_stock: {batchError.message}
        </p>
      )}

      <SupplierReturnForm suppliers={suppliers ?? []} batches={batches} />

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{lang === 'fr' ? 'Retours enregistrés' : 'Recorded returns'}</p>
      {(!returns || returns.length === 0) && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucun retour enregistré.' : 'No returns recorded.'}</p>}
      {returns && returns.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {returns.map((r: any, i: number) => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
              borderBottom: i < returns.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: '13px' }}>{r.batches?.products?.name} — lot {r.batches?.batch_number}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {r.suppliers?.name} · {new Date(r.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')} · {r.reason}
                </div>
              </div>
              <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                −{r.quantity}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
