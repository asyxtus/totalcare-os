// app/(authenticated)/pharmacy/products/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import ProductForm from '@/components/ProductForm'
import ToggleProductButton from '@/components/ToggleProductButton'

export default async function ProductsPage() {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data: drugClasses } = await supabase.from('drug_classes').select('id, name_fr').order('name_fr')
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sale_price_xaf, cost_price_xaf, is_active, barcode')
    .eq('clinic_id', staff.clinicId)
    .order('name')

  const { data: batchRows } = await supabase.rpc('get_active_batches_with_stock', { p_clinic_id: staff.clinicId })
  const stockByProduct = new Map<string, number>()
  // get_active_batches_with_stock doesn't return product_id directly, so
  // sum by matching product name — acceptable here since it's only used
  // for a display total, not a financial calculation.
  for (const row of batchRows ?? []) {
    stockByProduct.set(row.product_name, (stockByProduct.get(row.product_name) ?? 0) + row.on_hand)
  }

  return (
    <div style={{ maxWidth: '750px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Catalogue de produits</h1>
      </div>

      <ProductForm drugClasses={drugClasses ?? []} />

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
        Produits ({(products ?? []).length})
      </p>
      {(!products || products.length === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Aucun produit dans le catalogue.</p>
      )}
      {products && products.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {products.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px',
              borderBottom: i < products.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              opacity: p.is_active ? 1 : 0.5,
            }}>
              <div>
                <div style={{ fontSize: '13px' }}>{p.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {p.sale_price_xaf.toLocaleString('fr-FR')} FCFA
                  {p.cost_price_xaf ? ` · coût ${p.cost_price_xaf.toLocaleString('fr-FR')}` : ' · coût non renseigné'}
                  {' · '}{stockByProduct.get(p.name) ?? 0} en stock
                </div>
              </div>
              <ToggleProductButton productId={p.id} isActive={p.is_active} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
