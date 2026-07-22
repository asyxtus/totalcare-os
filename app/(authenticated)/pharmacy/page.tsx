// app/(authenticated)/pharmacy/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'

function PrimaryCard({ href, icon, label, description }: { href: string; icon: string; label: string; description: string }) {
  return (
    <Link href={href} style={{
      display: 'block', textDecoration: 'none', flex: 1, minWidth: '200px',
      padding: '1.1rem', borderRadius: 'var(--radius-md)', border: 'none',
      background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
    }}>
      <p style={{ fontSize: '22px', margin: '0 0 6px' }}>{icon}</p>
      <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: '12px', margin: 0, opacity: 0.85 }}>{description}</p>
    </Link>
  )
}

function SecondaryCard({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link href={href} style={{
      display: 'block', textDecoration: 'none', flex: 1, minWidth: '160px',
      padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
      background: 'var(--color-surface)', color: 'var(--color-text-primary)',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>{description}</p>
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 8px' }}>
      {children}
    </p>
  )
}

export default async function PharmacyPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: pendingCount } = await supabase
    .from('prescriptions')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'partially_dispensed'])
    .eq('requires_review', false)

  const rpcErrors: string[] = []

  const { data: salesRows, error: salesError } = await supabase.rpc('pharmacy_today_sales', { p_clinic_id: staff.clinicId })
  if (salesError) rpcErrors.push(`pharmacy_today_sales: ${salesError.message}`)
  const sales = salesRows?.[0]

  const { data: alertRows, error: alertError } = await supabase.rpc('inventory_alert_summary', { p_clinic_id: staff.clinicId })
  if (alertError) rpcErrors.push(`inventory_alert_summary: ${alertError.message}`)
  const alerts = alertRows?.[0]

  const { data: topProducts, error: topProductsError } = await supabase.rpc('top_selling_products', { p_clinic_id: staff.clinicId, p_days: 30 })
  if (topProductsError) rpcErrors.push(`top_selling_products: ${topProductsError.message}`)

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>{lang === 'fr' ? 'Pharmacie' : 'Pharmacy'}</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        {lang==='fr'?'Aperçu et opérations':'Overview and operations'}
      </p>

      {rpcErrors.length > 0 && (
        <div style={{
          background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '12px',
        }}>
          <strong>{lang === 'fr' ? "Certaines statistiques n'ont pas pu être chargées" : 'Some statistics could not be loaded'}</strong> — {lang === 'fr' ? 'probablement une migration SQL non exécutée :' : 'probably a missing SQL migration:'}
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            {rpcErrors.map((e, i) => <li key={i} style={{ fontFamily: 'var(--font-mono)' }}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Numbers first — the thing everyone actually glances at, same
          pattern as every other dashboard in this app. This was
          sitting at the bottom before, which is genuinely part of why
          this page read as confusing. */}
      <StatCardRow>
        <StatCard label={lang==='fr'?"Ventes aujourd'hui":'Sales today'} value={`${(sales?.total_xaf ?? 0).toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA`} />
        <StatCard label={lang==='fr'?'À dispenser':'To dispense'} value={pendingCount ?? 0} />
        <StatCard label={lang==='fr'?'Stock faible':'Low stock'} value={alerts?.low_stock_product_count ?? 0} accent={alerts?.low_stock_product_count ? 'warning' : undefined} />
        <StatCard label={lang==='fr'?'Expire bientôt':'Expiring soon'} value={alerts?.expiring_soon_count ?? 0} accent={alerts?.expiring_soon_count ? 'warning' : undefined} />
        <StatCard label={lang==='fr'?'Expiré':'Expired'} value={alerts?.expired_count ?? 0} accent={alerts?.expired_count ? 'critical' : undefined} />
      </StatCardRow>

      {sales && sales.total_xaf > 0 && (
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '-0.75rem 0 1.5rem' }}>
          Comptoir (POS) : {sales.pos_sales_xaf.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA · Dispensation sur ordonnance : {sales.dispensing_payments_xaf.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
        </p>
      )}

      {/* Today's work — the two screens a pharmacist actually opens
          dozens of times a day, given real visual weight instead of
          looking identical to a supplier invoice list. */}
      <div style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>{lang === 'fr' ? "Aujourd'hui" : "Today"}</SectionLabel>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <PrimaryCard href="/pharmacy/dispensing" icon="💊" label={lang==='fr'?'Dispensation':'Dispensing'} description={lang==='fr'?"File d'attente des ordonnances à remplir":'Queue of prescriptions to fill'} />
          <PrimaryCard href="/pharmacy/pos" icon="🛒" label={lang==='fr'?'Vente comptoir (POS)':'Counter sale (POS)'} description={lang==='fr'?'Ventes directes sans ordonnance':'Direct sales without a prescription'} />
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>{lang === 'fr' ? 'Stock & Catalogue' : 'Stock & Catalog'}</SectionLabel>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <SecondaryCard href="/pharmacy/inventory" label={lang === 'fr' ? 'Inventaire' : 'Inventory'} description={lang === 'fr' ? 'Produits, prix, niveaux de stock' : 'Products, prices, stock levels'} />
          <SecondaryCard href="/pharmacy/receiving" label={lang === 'fr' ? 'Réception de stock' : 'Stock receiving'} description={lang === 'fr' ? 'Enregistrer une livraison reçue' : 'Record a received delivery'} />
          <SecondaryCard href="/pharmacy/adjustments" label={lang === 'fr' ? 'Ajustements' : 'Adjustments'} description={lang === 'fr' ? 'Historique des corrections de stock' : 'History of stock corrections'} />
          <SecondaryCard href="/pharmacy/recalls" label={lang === 'fr' ? 'Rappels de lots' : 'Batch recalls'} description={lang === 'fr' ? "Retrait d'un lot défectueux" : 'Withdrawal of a defective batch'} />
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>{lang === 'fr' ? 'Achats & Fournisseurs' : 'Purchasing & Suppliers'}</SectionLabel>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <SecondaryCard href="/pharmacy/suppliers" label={lang === 'fr' ? 'Fournisseurs' : 'Suppliers'} description={lang === 'fr' ? 'Répertoire et coordonnées' : 'Directory and contact details'} />
          <SecondaryCard href="/pharmacy/purchase-orders" label={lang === 'fr' ? 'Bons de commande' : 'Purchase orders'} description={lang === 'fr' ? 'Commandes envoyées aux fournisseurs' : 'Orders sent to suppliers'} />
          <SecondaryCard href="/pharmacy/supplier-invoices" label={lang === 'fr' ? 'Factures fournisseurs' : 'Supplier invoices'} description={lang === 'fr' ? 'Factures reçues et paiements' : 'Received invoices and payments'} />
          <SecondaryCard href="/pharmacy/returns" label={lang === 'fr' ? 'Retours' : 'Returns'} description={lang === 'fr' ? 'Marchandise renvoyée à un fournisseur' : 'Merchandise returned to a supplier'} />
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>{lang === 'fr' ? 'Historique & Analyse' : 'History & Analysis'}</SectionLabel>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <SecondaryCard href="/pharmacy/prescriptions" label={lang === 'fr' ? 'Ordonnances' : 'Prescriptions'} description={lang === 'fr' ? 'Historique complet, recherche par patient' : 'Full history, search by patient'} />
          <SecondaryCard href="/pharmacy/reports" label={lang === 'fr' ? 'Rapports' : 'Reports'} description={lang === 'fr' ? 'Recettes, rentabilité, produits vendeurs' : 'Revenue, profitability, top sellers'} />
        </div>
      </div>

      {topProducts && topProducts.length > 0 && (
        <div>
          <SectionLabel>{lang === 'fr' ? 'Produits les plus vendus (30 jours)' : 'Top-selling products (30 days)'}</SectionLabel>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            {topProducts.map((p: any, i: number) => (
              <div key={p.product_id} style={{
                display: 'flex', justifyContent: 'space-between', padding: '8px 14px',
                borderBottom: i < topProducts.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <span style={{ fontSize: '13px' }}>{p.product_name}</span>
                <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                  {p.total_quantity} unités
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
