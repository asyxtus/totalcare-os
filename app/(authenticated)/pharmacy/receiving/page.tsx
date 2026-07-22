// app/(authenticated)/pharmacy/receiving/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import GoodsReceiptForm from '@/components/GoodsReceiptForm'

export default async function ReceivingPage({
  searchParams,
}: {
  searchParams: Promise<{ po?: string }>
}) {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()
  const { po: poId } = await searchParams

  let matchedPO: { id: string; supplierId: string; supplierName: string } | null = null
  if (poId) {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('id, supplier_id, suppliers(name)')
      .eq('id', poId)
      .maybeSingle()
    if (po) {
      matchedPO = { id: po.id, supplierId: po.supplier_id, supplierName: (po.suppliers as any)?.name ?? '' }
    }
  }

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('clinic_id', staff.clinicId)
    .eq('is_active', true)
    .order('name')

  const { data: recentReceipts } = await supabase
    .from('goods_receipts')
    .select('id, received_at, invoice_reference, suppliers(name), goods_receipt_items(id)')
    .order('received_at', { ascending: false })
    .limit(10)

  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>
            {lang === 'fr' ? 'Réception de stock' : 'Receive stock'}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {lang === 'fr'
              ? 'Enregistrez ici les médicaments reçus d\'un fournisseur. Chaque lot reçu incrémente le stock immédiatement.'
              : 'Record medications received from a supplier. Each received batch immediately increases stock.'}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {lang === 'fr' ? 'Enregistrer une livraison fournisseur' : 'Record a supplier delivery'}
          </p>
        </div>
      </div>

      {products && products.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
          {lang === 'fr'
            ? "Aucun produit actif dans le catalogue — ajoutez d'abord des produits avant de recevoir du stock."
            : 'No active products in the catalog — add products first before receiving stock.'}
        </p>
      )}

      {matchedPO && (
        <p style={{ fontSize: '13px', color: 'var(--color-accent)', background: 'var(--color-success-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
          {lang==='fr'?'Réception liée au bon de commande — ':'Receipt linked to purchase order — '}{matchedPO.supplierName}
        </p>
      )}

      <GoodsReceiptForm suppliers={suppliers ?? []} products={products ?? []} matchedPO={matchedPO} />

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '1.5rem 0 8px' }}>
        {lang==='fr'?'Réceptions récentes':'Recent receipts'}
      </p>
      {(!recentReceipts || recentReceipts.length === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucune réception enregistrée.':'No receipts recorded.'}</p>
      )}
      {recentReceipts && recentReceipts.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {recentReceipts.map((r: any, i: number) => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
              borderBottom: i < recentReceipts.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <span style={{ fontSize: '13px' }}>
                {new Date(r.received_at).toLocaleDateString(locale)}
                {r.suppliers?.name ? ` · ${r.suppliers.name}` : ''}
                {r.invoice_reference ? ` · ${r.invoice_reference}` : ''}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {r.goods_receipt_items.length} article(s)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
