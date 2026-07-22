// app/(authenticated)/pharmacy/reports/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'
import PharmacyReportsTabs from '@/components/PharmacyReportsTabs'

export default async function PharmacyReportsPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const rpcErrors: string[] = []

  const { data: dailyRevenue, error: dailyRevenueError } = await supabase.rpc('pharmacy_daily_revenue', { p_clinic_id: staff.clinicId, p_days: 30 })
  if (dailyRevenueError) rpcErrors.push(`pharmacy_daily_revenue: ${dailyRevenueError.message}`)

  const { data: itemsSold, error: itemsSoldError } = await supabase.rpc('pharmacy_items_sold', { p_clinic_id: staff.clinicId, p_days: 30 })
  if (itemsSoldError) rpcErrors.push(`pharmacy_items_sold: ${itemsSoldError.message}`)

  const { data: marginRows, error: marginError } = await supabase.rpc('profit_margin_summary', { p_clinic_id: staff.clinicId, p_days: 30 })
  if (marginError) rpcErrors.push(`profit_margin_summary: ${marginError.message}`)
  const margin = marginRows?.[0]

  const { data: topProducts, error: topProductsError } = await supabase.rpc('top_selling_products', { p_clinic_id: staff.clinicId, p_days: 30 })
  if (topProductsError) rpcErrors.push(`top_selling_products: ${topProductsError.message}`)

  const { data: deadStock, error: deadStockError } = await supabase.rpc('dead_stock_report', { p_clinic_id: staff.clinicId, p_days: 60 })
  if (deadStockError) rpcErrors.push(`dead_stock_report: ${deadStockError.message}`)

  const grossRevenue = (dailyRevenue ?? []).reduce((sum: number, d: any) => sum + Number(d.revenue_xaf), 0)
  const totalDiscounts = 0
  const netRevenue = grossRevenue - totalDiscounts

  // Each tab's content is built here, as a Server Component, THEN passed
  // to the Client Component as a plain prop (already-rendered JSX) —
  // not as a function. Passing a function as children/props from a
  // Server Component to a Client Component isn't valid in the App
  // Router, since functions aren't serializable across that boundary.
  const dailyContent = (
    <div>
      <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>{lang==='fr'?'Recettes journalières':'Daily revenue'}</p>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '8px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>
          <span>Date</span><span style={{ textAlign: 'right' }}>Recettes</span><span style={{ textAlign: 'right' }}>Transactions</span>
        </div>
        {(dailyRevenue ?? []).map((d: any, i: number) => (
          <div key={d.report_date} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '8px 14px', fontSize: '13px',
            borderBottom: i < (dailyRevenue?.length ?? 0) - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            opacity: Number(d.revenue_xaf) === 0 ? 0.5 : 1,
          }}>
            <span>{d.report_date}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Number(d.revenue_xaf).toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{d.transaction_count}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const profitabilityContent = (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', maxWidth: '400px' }}>
      {margin?.total_revenue_xaf === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucune vente sur cette période':'No sales in this period'}.</p>
      ) : margin?.margin_pct === null ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          {lang==='fr'?'Aucun coût de revient renseigné':'No purchase cost entered'} sur les produits vendus — impossible de calculer la marge.
        </p>
      ) : (
        <>
          <p style={{ fontSize: '28px', fontWeight: 600, margin: '0 0 6px', fontFamily: 'var(--font-mono)' }}>{margin?.margin_pct}%</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>
            Profit : {Number(margin?.total_profit_xaf ?? 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
          </p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Coût : {Number(margin?.total_cost_xaf ?? 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
          </p>
          {margin?.data_coverage_pct !== null && margin?.data_coverage_pct < 100 && (
            <p style={{ fontSize: '11px', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', marginTop: '10px' }}>
              {lang==='fr'?'Calculé sur':'Calculated on'} {margin?.data_coverage_pct}% {lang==='fr'?'des ventes — coût de revient manquant pour le reste':'of sales — purchase cost missing for the rest'}
            </p>
          )}
        </>
      )}
    </div>
  )

  const stockContent = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>{lang==='fr'?'Produits les plus vendus':'Top-selling products'}</p>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {(topProducts ?? []).length === 0 && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', padding: '1rem' }}>{lang==='fr'?'Aucune vente.':'No sales.'}</p>}
          {(topProducts ?? []).map((p: any, i: number) => (
            <div key={p.product_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: '13px', borderBottom: i < topProducts.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
              <span>{p.product_name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{p.total_quantity}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>{lang==='fr'?'Stock dormant (60 jours)':'Dead stock (60 days)'}</p>
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '-6px 0 10px' }}>
          {lang==='fr'?"Produits en stock sans aucune vente — argent immobilisé sur l'étagère":'Products in stock with zero sales — money sitting idle on the shelf'}
        </p>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {(deadStock ?? []).length === 0 && <p style={{ fontSize: '13px', color: 'var(--color-success-text)', padding: '1rem' }}>{lang==='fr'?'Aucun stock dormant.':'No dead stock.'}</p>}
          {(deadStock ?? []).map((p: any, i: number) => (
            <div key={p.product_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: '13px', borderBottom: i < deadStock.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
              <span>{p.product_name} <span style={{ color: 'var(--color-text-secondary)' }}>({p.on_hand})</span></span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-warning-text)' }}>{Number(p.stock_value_xaf).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const unavailableContent = (
    <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
      <p style={{ fontSize: '13px', color: 'var(--color-warning-text)', margin: '0 0 8px', fontWeight: 500 }}>
        {lang === 'fr' ? 'Pas encore construit — signalé honnêtement plutôt que simulé' : 'Not built yet — reported honestly rather than faked'}
      </p>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
        {lang === 'fr'
          ? <><strong>TVA / Taxes</strong> : aucun calcul de taxe n'existe dans ce système. Une vraie implémentation nécessiterait de modéliser le taux de TVA camerounais (19,25%) sur chaque vente — pas construit.</>
          : <><strong>VAT / Taxes</strong>: no tax calculation exists in this system. A real implementation would need to model the Cameroonian VAT rate (19.25%) on each sale — not built.</>}
      </p>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
        {lang === 'fr'
          ? <><strong>Historique des médicaments</strong> (journal détaillé de chaque dispensation/vente par produit et par patient) : pas encore construit, bonne prochaine étape.</>
          : <><strong>Medication history</strong> (detailed log of every dispense/sale by product and patient): not built yet, good next step.</>}
      </p>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{lang === 'fr' ? 'Rapports' : 'Reports'}</h1>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        Analyses et rapports opérationnels — 30 derniers jours
      </p>

      {rpcErrors.length > 0 && (
        <div style={{
          background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '12px',
        }}>
          <strong>{lang === 'fr' ? "Certains rapports n'ont pas pu être chargés" : 'Some reports could not be loaded'}</strong> — {lang === 'fr' ? 'probablement une migration SQL non exécutée :' : 'probably a missing SQL migration:'}
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            {rpcErrors.map((e, i) => <li key={i} style={{ fontFamily: 'var(--font-mono)' }}>{e}</li>)}
          </ul>
        </div>
      )}

      <StatCardRow>
        <StatCard label="Recettes brutes" value={`${grossRevenue.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`} />
        <StatCard label="Remises totales" value={`${totalDiscounts.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`} />
        <StatCard label="Recettes nettes" value={`${netRevenue.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`} />
        <StatCard label="Articles vendus" value={itemsSold ?? 0} />
      </StatCardRow>

      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '-0.75rem 0 1.25rem' }}>
        « Remises » affiche 0 FCFA honnêtement — la pharmacie ne prend pas encore en charge les remises au comptoir, ce n'est pas une donnée manquante.
      </p>

      <PharmacyReportsTabs
        dailyContent={dailyContent}
        profitabilityContent={profitabilityContent}
        stockContent={stockContent}
        unavailableContent={unavailableContent}
      />
    </div>
  )
}
