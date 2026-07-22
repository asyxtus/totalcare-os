// app/(authenticated)/pharmacy/purchase-orders/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import MarkPOSentButton from '@/components/MarkPOSentButton'


export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
const STATUS_LABELS: Record<string, string> = {
  draft: lang === 'fr' ? 'Brouillon' : 'Draft', sent: lang === 'fr' ? 'Envoyé' : 'Sent', partially_received: lang === 'fr' ? 'Partiellement reçu' : 'Partially received', received: lang === 'fr' ? 'Reçu' : 'Received', cancelled: lang === 'fr' ? 'Annulé' : 'Cancelled',
}
  const supabase = await createClient()

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select('id, status, order_date, expected_delivery_date, notes, suppliers(name)')
    .eq('id', id)
    .maybeSingle()

  if (error || !po) notFound()

  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('id, quantity_ordered, quantity_received, unit_cost_xaf, products(name)')
    .eq('purchase_order_id', id)

  const supplier = po.suppliers as any

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/pharmacy/purchase-orders" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{supplier?.name}</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {lang==='fr'?'Commandé le':'Ordered'} {new Date(po.order_date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}
            {po.expected_delivery_date ? ` · ${lang==='fr'?'Livraison prévue le':'Expected delivery'} ${new Date(po.expected_delivery_date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}` : ''}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {STATUS_LABELS[po.status]}
        </span>
        {po.status === 'draft' && <MarkPOSentButton poId={po.id} />}
        {(po.status === 'sent' || po.status === 'partially_received') && (
          <Link href={`/pharmacy/receiving?po=${po.id}`} style={{
            fontSize: '12px', color: 'var(--color-accent-text-on)', background: 'var(--color-accent)',
            padding: '5px 12px', borderRadius: 'var(--radius-sm)', textDecoration: 'none',
          }}>
            Recevoir contre ce bon →
          </Link>
        )}
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
        {(items ?? []).map((item: any, i: number) => (
          <div key={item.id} style={{
            display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
            borderBottom: i < (items?.length ?? 0) - 1 ? '1px solid var(--color-border-subtle)' : 'none',
          }}>
            <span style={{ fontSize: '13px' }}>{item.products?.name}</span>
            <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: item.quantity_received >= item.quantity_ordered ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}>
              {item.quantity_received}/{item.quantity_ordered}
            </span>
          </div>
        ))}
      </div>

      {po.notes && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '1rem' }}>{po.notes}</p>}
    </div>
  )
}
