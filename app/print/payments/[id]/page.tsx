// app/print/payments/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

const METHOD_LABELS: Record<string, { fr: string; en: string }> = {
  cash: { fr: 'Comptant', en: 'Cash' },
  momo: { fr: 'MTN MoMo', en: 'MTN MoMo' },
  orange_money: { fr: 'Orange Money', en: 'Orange Money' },
  card: { fr: 'Carte bancaire', en: 'Bank card' },
  transfer: { fr: 'Virement', en: 'Transfer' },
}

export default async function PrintPaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const { data: payment, error } = await supabase
    .from('payments')
    .select(`
      id, total_amount_xaf, created_at,
      clinics(name, city, quartier, phone),
      patients(full_name, patient_code),
      staff(full_name),
      payment_splits(method, amount_xaf),
      invoices(invoice_number, invoice_items(amount_xaf, service_charges(description)))
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !payment) notFound()

  const clinic = payment.clinics as any
  const patient = payment.patients as any
  const cashier = payment.staff as any
  const invoice = payment.invoices as any

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid #16211E', paddingBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{clinic?.name}</h1>
        <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
          {clinic?.quartier}, {clinic?.city}{clinic?.phone ? ` · ${clinic.phone}` : ''}
        </p>
        <p style={{ fontSize: '13px', margin: '10px 0 0' }}>{lang === 'fr' ? 'Reçu de paiement' : 'Payment Receipt'}</p>
      </div>

      <p style={{ fontSize: '12px', color: '#5C6B65', margin: '0 0 4px' }}>
        {new Date(payment.created_at).toLocaleString(locale)} · {lang === 'fr' ? 'Encaissé par' : 'Collected by'}: {cashier?.full_name}
      </p>
      <p style={{ fontSize: '14px', margin: '0 0 16px' }}>
        <strong>{patient?.full_name}</strong> — {patient?.patient_code}
      </p>

      {invoice?.invoice_number && (
        <p style={{ fontSize: '12px', color: '#5C6B65', margin: '0 0 10px' }}>{lang === 'fr' ? 'Facture' : 'Invoice'} {invoice.invoice_number}</p>
      )}

      {(invoice?.invoice_items ?? []).map((item: any, i: number) => (
        <p key={i} style={{ fontSize: '13px', margin: '2px 0' }}>
          {item.service_charges?.description} — {Number(item.amount_xaf).toLocaleString(locale)} FCFA
        </p>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #16211E', paddingTop: '10px', marginTop: '16px', fontSize: '15px', fontWeight: 600 }}>
        <span>{lang === 'fr' ? 'Montant payé' : 'Amount paid'}</span>
        <span>{Number(payment.total_amount_xaf).toLocaleString(locale)} FCFA</span>
      </div>
      <p style={{ fontSize: '12px', color: '#5C6B65', margin: '6px 0 0', textAlign: 'right' }}>
        {(payment.payment_splits ?? []).map((s: any) => METHOD_LABELS[s.method]?.[lang] ?? s.method).join(', ')}
      </p>

      <p style={{ fontSize: '11px', color: '#5C6B65', marginTop: '40px', textAlign: 'center' }}>
        {lang === 'fr' ? 'Merci de votre confiance.' : 'Thank you for your trust.'}
      </p>
    </div>
  )
}
