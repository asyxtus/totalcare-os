// app/(authenticated)/pharmacy/adjustments/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export default async function AdjustmentsHistoryPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: recentAdjustments } = await supabase
    .from('stock_movements')
    .select('id, movement_type, quantity, notes, created_at, batches(batch_number, products(name))')
    .in('movement_type', ['adjustment', 'adjustment_increase'])
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div style={{ maxWidth: '650px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Historique des ajustements</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {lang === 'fr' ? "Pour créer un nouvel ajustement, utilisez le bouton « Ajuster » directement depuis" : "To create an adjustment, use the 'Adjust' button directly from"}{' '}
            <Link href="/pharmacy/inventory" style={{ color: 'var(--color-accent)' }}>{lang === 'fr' ? "l'Inventaire" : 'Inventory'}</Link>.
          </p>
        </div>
      </div>

      {(!recentAdjustments || recentAdjustments.length === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucun ajustement enregistré.' : 'No adjustments recorded.'}</p>
      )}
      {recentAdjustments && recentAdjustments.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {recentAdjustments.map((a: any, i: number) => (
            <div key={a.id} style={{
              display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
              borderBottom: i < recentAdjustments.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: '13px' }}>{a.batches?.products?.name} — lot {a.batches?.batch_number}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {new Date(a.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')} · {a.notes}
                </div>
              </div>
              <span style={{
                fontSize: '13px', fontFamily: 'var(--font-mono)',
                color: a.movement_type === 'adjustment_increase' ? 'var(--color-success-text)' : 'var(--color-critical-text)',
              }}>
                {a.movement_type === 'adjustment_increase' ? '+' : '−'}{a.quantity}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
