import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Comptant',
  momo: 'MTN MoMo',
  orange_money: 'Orange Money',
}

export default async function PosSaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const staff = await getCurrentStaff()
  if (staff.role !== 'admin') redirect('/pharmacy')

  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const { id } = await params
  const supabase = await createClient()

  const { data: sale, error } = await supabase
    .from('pos_sales')
    .select('id, created_at, total_amount_xaf, payment_method, status, patient_id, staff(full_name)')
    .eq('clinic_id', staff.clinicId)
    .eq('id', id)
    .maybeSingle()

  if (error || !sale) notFound()

  const { data: items } = await supabase
    .from('pos_sale_items')
    .select('product_id, quantity, unit_price_xaf, subtotal_xaf, products(name, sku)')
    .eq('pos_sale_id', id)

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('id, batch_id, quantity, movement_type, created_at, batches(batch_number, expiry_date), products:product_id(name)')
    .eq('clinic_id', staff.clinicId)
    .eq('reference_type', 'pos_sale')
    .eq('reference_id', id)
    .eq('movement_type', 'sale')
    .order('created_at', { ascending: true })

  const totalUnits = (items ?? []).reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <Link href="/pharmacy/pos/sales" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{lang === 'fr' ? 'Détail de la vente POS' : 'POS sale detail'}</h1>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', margin: '0 0 1rem' }}>{sale.id}</p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <a href={`/print/pos-sales/${sale.id}`} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 12px', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
          {lang === 'fr' ? 'Imprimer le reçu' : 'Print receipt'}
        </a>
        <Link href={`/pharmacy/pos/sales?date=${new Date(sale.created_at).toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' })}`} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: '12px' }}>
          {lang === 'fr' ? 'Retour au tableau' : 'Back to board'}
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px', marginBottom: '1.5rem' }}>
        {[
          [lang === 'fr' ? 'Date / heure' : 'Date / time', new Date(sale.created_at).toLocaleString(locale)],
          [lang === 'fr' ? 'Caissier' : 'Cashier', (sale.staff as any)?.full_name ?? '—'],
          [lang === 'fr' ? 'Paiement' : 'Payment', METHOD_LABELS[sale.payment_method] ?? sale.payment_method],
          [lang === 'fr' ? 'Total' : 'Total', `${Number(sale.total_amount_xaf).toLocaleString(locale)} FCFA`],
        ].map(([label, value]) => (
          <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
            <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '0 0 5px', textTransform: 'uppercase' }}>{label}</p>
            <p style={{ fontSize: '13px', margin: 0, fontFamily: label === 'Total' ? 'var(--font-mono)' : undefined, fontWeight: label === 'Total' ? 600 : 400 }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>{lang === 'fr' ? `Articles vendus (${totalUnits} unités)` : `Sold items (${totalUnits} units)`}</p>
        <div style={{ overflowX: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '10px', textTransform: 'uppercase' }}>
              <th style={{ textAlign: 'left', padding: '9px 10px' }}>Produit</th>
              <th style={{ textAlign: 'right', padding: '9px 10px' }}>Qté</th>
              <th style={{ textAlign: 'right', padding: '9px 10px' }}>P.U.</th>
              <th style={{ textAlign: 'right', padding: '9px 10px' }}>Sous-total</th>
            </tr></thead>
            <tbody>
              {(items ?? []).map((item: any, i: number) => (
                <tr key={i} style={{ borderBottom: i < (items?.length ?? 0) - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                  <td style={{ padding: '9px 10px' }}>{item.products?.name ?? '—'}{item.products?.sku ? <span style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '10px' }}>{item.products.sku}</span> : null}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{item.quantity}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Number(item.unit_price_xaf).toLocaleString(locale)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{Number(item.subtotal_xaf).toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>{lang === 'fr' ? 'Traçabilité des lots / stock' : 'Batch / stock trace'}</p>
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
          {lang === 'fr' ? 'Chaque ligne ci-dessous correspond au stock réellement consommé par cette vente selon FEFO.' : 'Each row below is stock actually consumed by this sale through FEFO.'}
        </p>
        <div style={{ overflowX: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '10px', textTransform: 'uppercase' }}>
              <th style={{ textAlign: 'left', padding: '9px 10px' }}>Produit</th>
              <th style={{ textAlign: 'left', padding: '9px 10px' }}>Lot</th>
              <th style={{ textAlign: 'left', padding: '9px 10px' }}>Expiration</th>
              <th style={{ textAlign: 'right', padding: '9px 10px' }}>Qté consommée</th>
              <th style={{ textAlign: 'left', padding: '9px 10px' }}>Mouvement</th>
            </tr></thead>
            <tbody>
              {(movements ?? []).map((movement: any, i: number) => (
                <tr key={movement.id} style={{ borderBottom: i < (movements?.length ?? 0) - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                  <td style={{ padding: '9px 10px' }}>{movement.products?.name ?? '—'}</td>
                  <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)' }}>{movement.batches?.batch_number ?? '—'}</td>
                  <td style={{ padding: '9px 10px' }}>{movement.batches?.expiry_date ?? '—'}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{movement.quantity}</td>
                  <td style={{ padding: '9px 10px' }}><span style={{ padding: '3px 7px', borderRadius: '999px', background: 'var(--color-success-bg)', color: 'var(--color-success-text)', fontSize: '10px', fontWeight: 600 }}>SALE</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(movements ?? []).length === 0 && <p style={{ padding: '1rem', margin: 0, fontSize: '12px', color: 'var(--color-warning-text)' }}>{lang === 'fr' ? 'Aucun mouvement de stock « sale » trouvé. Vérifiez que la migration POS 136 est appliquée.' : 'No “sale” stock movement found. Verify POS migration 136 is applied.'}</p>}
        </div>
      </div>
    </div>
  )
}
