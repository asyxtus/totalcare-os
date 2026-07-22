// app/(authenticated)/pharmacy/suppliers/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import Link from 'next/link'
import SupplierForm from '@/components/SupplierForm'
import SupplierRow from '@/components/SupplierRow'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'

export default async function SuppliersPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, contact_name, phone, email, address, payment_terms_days, is_active')
    .order('name')

  // Per-supplier outstanding balance, computed from real unpaid invoices
  // — not a placeholder. Sum(total - paid) grouped by supplier.
  const { data: invoices } = await supabase
    .from('supplier_invoices')
    .select('supplier_id, total_amount_xaf, amount_paid_xaf')
    .neq('status', 'paid')

  const outstandingBySupplier = new Map<string, number>()
  for (const inv of invoices ?? []) {
    const current = outstandingBySupplier.get(inv.supplier_id) ?? 0
    outstandingBySupplier.set(inv.supplier_id, current + (inv.total_amount_xaf - inv.amount_paid_xaf))
  }

  const totalOutstanding = Array.from(outstandingBySupplier.values()).reduce((a, b) => a + b, 0)

  const { count: activeOrdersCount } = await supabase
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true })
    .in('status', ['sent', 'partially_received'])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{lang === 'fr' ? 'Fournisseurs' : 'Suppliers'}</h1>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        {lang==='fr'?'Répertoire et contacts fournisseurs':'Supplier directory and contacts'}
      </p>

      <StatCardRow>
        <StatCard label="Fournisseurs" value={suppliers?.length ?? 0} />
        <StatCard label={lang==='fr'?'Montant dû':'Amount owed'} value={`${totalOutstanding.toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA`} accent={totalOutstanding > 0 ? 'warning' : undefined} />
        <StatCard label="Commandes actives" value={activeOrdersCount ?? 0} />
      </StatCardRow>

      <div style={{ marginBottom: '1.5rem' }}>
        <SupplierForm />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
        {(suppliers ?? []).map((s) => (
          <SupplierRow key={s.id} supplier={s} outstandingXaf={outstandingBySupplier.get(s.id) ?? 0} />
        ))}
      </div>

      {(!suppliers || suppliers.length === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucun fournisseur enregistré.':'No suppliers registered.'}</p>
      )}
    </div>
  )
}
