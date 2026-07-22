// app/(authenticated)/pharmacy/inventory/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'
import ProductForm from '@/components/ProductForm'
import InventoryTable from '@/components/InventoryTable'
import ProductCatalogBrowser from '@/components/ProductCatalogBrowser'

export default async function InventoryPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: drugClasses } = await supabase.from('drug_classes').select('id, name_fr, name_en, is_antibiotic').order('name_fr')
  const rpcErrors: string[] = []

  const { data: summaryRows, error: summaryError } = await supabase.rpc('inventory_summary', { p_clinic_id: staff.clinicId })
  if (summaryError) rpcErrors.push(`inventory_summary: ${summaryError.message}`)
  const summary = summaryRows?.[0]

  const { data: products, error: productsError } = await supabase.rpc('get_products_with_stock', { p_clinic_id: staff.clinicId })
  if (productsError) rpcErrors.push(`get_products_with_stock: ${productsError.message}`)
  const activeProducts = (products ?? []).filter((p: any) => p.is_active)
  const categories = [...new Set(activeProducts.map((p: any) => p.drug_class_name).filter(Boolean))] as string[]

  // For duplicate detection in the catalog browser: a set of "name|dosage_form"
  // so we can mark templates already in this clinic's catalog as "already added"
  const existingProductNames = new Set<string>(
    (products ?? []).map((p: any) => `${p.name}|${p.dosage_form ?? ''}`)
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{lang === 'fr' ? 'Inventaire' : 'Inventory'}</h1>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        Niveaux de stock, lots et catalogue de produits
      </p>

      {rpcErrors.length > 0 && (
        <div style={{
          background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '12px',
        }}>
          <strong>{lang === 'fr' ? "Certaines données n'ont pas pu être chargées" : 'Some data could not be loaded'}</strong> — {lang === 'fr' ? 'probablement une migration SQL non exécutée :' : 'probably a missing SQL migration:'}
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            {rpcErrors.map((e, i) => <li key={i} style={{ fontFamily: 'var(--font-mono)' }}>{e}</li>)}
          </ul>
        </div>
      )}

      <StatCardRow>
        <StatCard label="Produits" value={summary?.total_products ?? 0} />
        <StatCard label="Valeur du stock" value={`${(summary?.stock_value_xaf ?? 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`} />
        <StatCard label="Stock faible" value={summary?.low_stock_count ?? 0} accent={summary?.low_stock_count ? 'warning' : undefined} />
        <StatCard label={lang==='fr'?'Catégories':'Categories'} value={summary?.category_count ?? 0} />
      </StatCardRow>

      <ProductForm drugClasses={drugClasses ?? []} />

      <ProductCatalogBrowser
        drugClasses={(drugClasses ?? []).map((dc: any) => ({ id: dc.id, name_fr: dc.name_fr, name_en: dc.name_en }))}
        existingProductNames={existingProductNames}
      />

      <InventoryTable products={products ?? []} categories={categories} drugClasses={drugClasses ?? []} />
    </div>
  )
}
