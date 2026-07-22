// app/(authenticated)/pharmacy/pos/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import POSTerminal from '@/components/POSTerminal'

export default async function POSPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  // form/strength/barcode straight from products; on_hand stock via the
  // same get_products_with_stock function already built for Inventory —
  // one real source of truth for stock levels, not a second copy of the
  // computation logic living in two places.
  const { data: products } = await supabase
    .from('products')
    .select('id, name, barcode, form, strength, sale_price_xaf, drug_classes(is_controlled)')
    .eq('clinic_id', staff.clinicId)
    .eq('is_active', true)
    .order('name')

  const { data: stockRows, error: stockError } = await supabase.rpc('get_products_with_stock', { p_clinic_id: staff.clinicId })
  const stockByProductId = new Map((stockRows ?? []).map((r: any) => [r.product_id, r.on_hand]))

  // Controlled substances are excluded from the sellable list entirely —
  // not just rejected at checkout. record_pos_sale refuses them
  // server-side too, but showing them in search only to reject at
  // checkout would be a dead-end UX. This must go through a prescription
  // with a witness, never POS.
  const sellableProducts = (products ?? [])
    .filter((p: any) => !p.drug_classes?.is_controlled)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      form: p.form,
      strength: p.strength,
      salePriceXaf: p.sale_price_xaf,
      onHand: stockByProductId.get(p.id) ?? 0,
    }))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Vente au comptoir (POS)</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>{lang==='fr'?'Ventes directes':'Direct sales'} de médicaments</p>
        </div>
      </div>

      {stockError && (
        <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontFamily: 'var(--font-mono)' }}>
          get_products_with_stock: {stockError.message} — lang==='fr'?'les niveaux de stock affichés ci-dessous sont incorrects':'stock levels shown below may be incorrect' (0 partout).
        </p>
      )}

      {sellableProducts.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
          {lang==='fr'?"Aucun produit vendable trouvé — vérifiez le catalogue et le stock reçu.":'No sellable products found — check the catalog and received stock.'}
        </p>
      )}

      <POSTerminal products={sellableProducts} />
    </div>
  )
}
