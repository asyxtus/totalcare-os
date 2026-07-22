// app/(authenticated)/pharmacy/supplier-invoices/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import SupplierInvoiceForm from '@/components/SupplierInvoiceForm'
import SupplierPaymentInline from '@/components/SupplierPaymentInline'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  unpaid: { bg: 'var(--color-critical-bg)', text: 'var(--color-critical-text)' },
  partial: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
  paid: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
}

export default async function SupplierInvoicesPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: suppliers } = await supabase.from('suppliers').select('id, name').eq('is_active', true).order('name')
  const { data: invoices } = await supabase
    .from('supplier_invoices')
    .select('id, invoice_number, invoice_date, due_date, total_amount_xaf, amount_paid_xaf, status, suppliers(name)')
    .order('invoice_date', { ascending: false })

  const totalOutstanding = (invoices ?? [])
    .filter((i) => i.status !== 'paid')
    .reduce((sum, i) => sum + (i.total_amount_xaf - i.amount_paid_xaf), 0)

  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{lang === 'fr' ? 'Factures fournisseurs' : 'Supplier invoices'}</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {totalOutstanding.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA {lang==='fr'?'dû aux fournisseurs':'owed to suppliers'}
          </p>
        </div>
      </div>

      <SupplierInvoiceForm suppliers={suppliers ?? []} />

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>Factures</p>
      {(!invoices || invoices.length === 0) && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucune facture enregistrée.' : 'No invoices recorded.'}</p>}
      {invoices && invoices.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {invoices.map((inv: any, i: number) => {
            const colors = STATUS_COLORS[inv.status]
            return (
              <div key={inv.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px',
                borderBottom: i < invoices.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: '13px' }}>{inv.suppliers?.name}{inv.invoice_number ? ` · ${inv.invoice_number}` : ''}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {inv.amount_paid_xaf.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} / {inv.total_amount_xaf.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
                    {inv.due_date ? ` · lang==='fr'?'Échéance':'Due'} ${new Date(inv.due_date).toLocaleDateString(lang==='fr'?'fr-FR':'en-US')}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: colors.bg, color: colors.text }}>
                    {inv.status === 'unpaid' ? (lang==='fr'?'Impayée':'Unpaid') : inv.status === 'partial' ? (lang==='fr'?'Partielle':'Partial') : (lang==='fr'?'Payée':'Paid')}
                  </span>
                  {inv.status !== 'paid' && <SupplierPaymentInline invoiceId={inv.id} />}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
