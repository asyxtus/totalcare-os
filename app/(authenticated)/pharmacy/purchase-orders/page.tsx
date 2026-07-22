// app/(authenticated)/pharmacy/purchase-orders/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import PurchaseOrderForm from '@/components/PurchaseOrderForm'


export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>
}) {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
const STATUS_LABELS: Record<string, string> = {
  draft: lang==='fr'?'Brouillon':'Draft', sent: lang==='fr'?'Envoyé':'Sent', partially_received: lang==='fr'?'Partiellement reçu':'Partially received', received: lang==='fr'?'Reçu':'Received', cancelled: lang==='fr'?'Annulé':'Cancelled',
}
  const supabase = await createClient()
  const { supplier: supplierFilter } = await searchParams

  const { data: suppliers } = await supabase.from('suppliers').select('id, name').eq('is_active', true).order('name')
  const { data: products } = await supabase.from('products').select('id, name').eq('clinic_id', staff.clinicId).eq('is_active', true).order('name')

  let ordersQuery = supabase
    .from('purchase_orders')
    .select('id, status, order_date, suppliers(name), purchase_order_items(id)')
    .order('order_date', { ascending: false })

  if (supplierFilter) {
    ordersQuery = ordersQuery.eq('supplier_id', supplierFilter)
  }

  const { data: orders } = await ordersQuery
  const filteredSupplierName = supplierFilter ? suppliers?.find((s) => s.id === supplierFilter)?.name : null

  return (
    <div style={{ maxWidth: '650px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Bons de commande</h1>
      </div>

      {filteredSupplierName && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1rem' }}>
          {lang==='fr'?'Filtré par :':'Filtered by:'} <strong>{filteredSupplierName}</strong>{' '}
          <Link href="/pharmacy/purchase-orders" style={{ color: 'var(--color-accent)' }}>(effacer)</Link>
        </p>
      )}

      <PurchaseOrderForm suppliers={suppliers ?? []} products={products ?? []} />

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '1.5rem 0 8px' }}>Bons existants</p>
      {(!orders || orders.length === 0) && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucun bon de commande.' : 'No purchase orders.'}</p>}
      {orders && orders.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {orders.map((po: any, i: number) => (
            <Link key={po.id} href={`/pharmacy/purchase-orders/${po.id}`} style={{
              display: 'flex', justifyContent: 'space-between', padding: '10px 14px', textDecoration: 'none', color: 'inherit',
              borderBottom: i < orders.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <span style={{ fontSize: '13px' }}>
                {po.suppliers?.name} · {new Date(po.order_date).toLocaleDateString(lang==='fr'?'fr-FR':'en-US')} · {po.purchase_order_items.length} article(s)
              </span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                {STATUS_LABELS[po.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
