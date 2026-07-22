// app/print/pos-sales/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

const METHOD_LABELS: Record<string, { fr: string; en: string }> = {
  cash: { fr: 'Comptant', en: 'Cash' },
  momo: { fr: 'MTN MoMo', en: 'MTN MoMo' },
  orange_money: { fr: 'Orange Money', en: 'Orange Money' },
}

export default async function PrintPosReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const { data: sale, error } = await supabase
    .from('pos_sales')
    .select('id, created_at, total_amount_xaf, payment_method, clinics(name, city, quartier, phone), staff(full_name)')
    .eq('id', id)
    .maybeSingle()

  if (error || !sale) notFound()

  const clinic = sale.clinics as any
  const cashier = sale.staff as any

  const { data: items } = await supabase
    .from('pos_sale_items')
    .select('quantity, unit_price_xaf, subtotal_xaf, products(name)')
    .eq('pos_sale_id', id)

  const L = {
    title: lang === 'fr' ? 'Reçu de vente' : 'Sales Receipt',
    soldBy: lang === 'fr' ? 'Vendu par' : 'Sold by',
    item: lang === 'fr' ? 'Article' : 'Item',
    qty: lang === 'fr' ? 'Qté' : 'Qty',
    unitPrice: lang === 'fr' ? 'P.U.' : 'Unit',
    total: lang === 'fr' ? 'Total' : 'Total',
    paidBy: lang === 'fr' ? 'Payé par' : 'Paid by',
    thanks: lang === 'fr' ? 'Merci de votre confiance.' : 'Thank you for your trust.',
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid #16211E', paddingBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{clinic?.name}</h1>
        <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
          {clinic?.quartier}, {clinic?.city}
          {clinic?.phone ? ` · ${clinic.phone}` : ''}
        </p>
        <p style={{ fontSize: '13px', margin: '10px 0 0' }}>{L.title}</p>
      </div>

      <p style={{ fontSize: '12px', color: '#5C6B65', margin: '0 0 16px' }}>
        {new Date(sale.created_at).toLocaleString(locale)} · {L.soldBy}: {cashier?.full_name}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '16px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #16211E' }}>
            <th style={{ textAlign: 'left', padding: '4px' }}>{L.item}</th>
            <th style={{ textAlign: 'right', padding: '4px' }}>{L.qty}</th>
            <th style={{ textAlign: 'right', padding: '4px' }}>{L.unitPrice}</th>
            <th style={{ textAlign: 'right', padding: '4px' }}>{L.total}</th>
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((item: any, i: number) => (
            <tr key={i} style={{ borderBottom: '1px solid #DCE3DE' }}>
              <td style={{ padding: '4px' }}>{item.products?.name}</td>
              <td style={{ padding: '4px', textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ padding: '4px', textAlign: 'right' }}>{item.unit_price_xaf.toLocaleString(locale)}</td>
              <td style={{ padding: '4px', textAlign: 'right' }}>{item.subtotal_xaf.toLocaleString(locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #16211E', paddingTop: '10px', fontSize: '15px', fontWeight: 600 }}>
        <span>{L.total}</span>
        <span>{sale.total_amount_xaf.toLocaleString(locale)} FCFA</span>
      </div>
      <p style={{ fontSize: '12px', color: '#5C6B65', margin: '6px 0 0', textAlign: 'right' }}>
        {L.paidBy}: {METHOD_LABELS[sale.payment_method]?.[lang] ?? sale.payment_method}
      </p>

      <p style={{ fontSize: '11px', color: '#5C6B65', marginTop: '40px', textAlign: 'center' }}>
        {L.thanks}
      </p>
    </div>
  )
}
