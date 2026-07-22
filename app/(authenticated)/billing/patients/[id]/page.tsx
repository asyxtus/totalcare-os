// app/(authenticated)/billing/patients/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import CollectPaymentForm from '@/components/CollectPaymentForm'
import ReversePaymentButton from '@/components/ReversePaymentButton'
import RequestDiscountButton from '@/components/RequestDiscountButton'

export default async function PatientBillingAccountPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const { data: patient, error } = await supabase
    .from('patients')
    .select('id, full_name, patient_code, phone')
    .eq('id', id)
    .maybeSingle()

  if (error || !patient) notFound()

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_amount_xaf, created_at, invoice_items(id, service_charge_id, amount_xaf, service_charges(description, category, insurer_portion_xaf, patient_portion_xaf))')
    .eq('patient_id', id)
    .order('created_at', { ascending: false })

  const invoiceIds = (invoices ?? []).map((inv) => inv.id)

  // Also fetch service charges with no invoice — these are genuinely owed
  // but won't appear in the invoices list. Common with lab charges ordered
  // after the consultation invoice was already created.
  const { data: uninvoicedCharges } = await supabase
    .from('service_charges')
    .select('id, description, category, amount_xaf, patient_portion_xaf, insurer_portion_xaf, amount_paid_xaf, status')
    .eq('patient_id', id)
    .in('status', ['pending', 'partial'])
    .is('invoice_id', null)
    .order('created_at', { ascending: false })

  const { data: payments, error: paymentsError } = invoiceIds.length > 0
    ? await supabase
        .from('payments')
        .select('id, invoice_id, total_amount_xaf, status, created_at, payment_splits(method, amount_xaf)')
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null }

  const paidByInvoice = new Map<string, number>()
  for (const p of payments ?? []) {
    if (p.status !== 'completed') continue
    paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.total_amount_xaf))
  }

  const rpcErrors = [invoicesError?.message, paymentsError?.message].filter(Boolean)

  return (
    <div style={{ maxWidth: '750px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <Link href="/billing" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{patient.full_name}</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {patient.patient_code}{patient.phone ? ` · ${patient.phone}` : ''}
          </p>
        </div>
      </div>

      {rpcErrors.length > 0 && (
        <div style={{ background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', margin: '1rem 0', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
          {rpcErrors.join(' · ')}
        </div>
      )}

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '1.25rem 0 8px' }}>{lang === 'fr' ? 'Factures' : 'Invoices'}</p>

      {/* Uninvoiced pending charges — common with lab charges ordered after
          the consultation invoice was already created. Shown prominently so
          cashiers don't miss them when collecting payment. */}
      {(uninvoicedCharges ?? []).length > 0 && (
        <div style={{
          background: 'color-mix(in srgb, var(--color-warning-bg) 60%, transparent)',
          border: '1px solid var(--color-warning-text)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '1rem',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-warning-text)', margin: '0 0 8px' }}>
            {lang === 'fr' ? '⚠ Frais non facturés en attente de paiement' : '⚠ Uninvoiced charges pending payment'}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--color-warning-text)', margin: '0 0 10px' }}>
            {lang === 'fr'
              ? 'Ces frais ont été générés (laboratoire, pharmacie, etc.) mais ne font partie d\'aucune facture. Ils doivent être encaissés séparément.'
              : 'These charges were generated (lab, pharmacy, etc.) but are not part of any invoice. They must be collected separately.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {(uninvoicedCharges ?? []).map((sc: any) => {
              const owed = Number(sc.patient_portion_xaf ?? sc.amount_xaf) - Number(sc.amount_paid_xaf ?? 0)
              const CATEGORY: Record<string, { fr: string; en: string }> = {
                lab: { fr: 'Laboratoire', en: 'Laboratory' },
                pharmacy: { fr: 'Pharmacie', en: 'Pharmacy' },
                consultation: { fr: 'Consultation', en: 'Consultation' },
                admission: { fr: 'Hospitalisation', en: 'Inpatient' },
              }
              const cat = CATEGORY[sc.category] ?? { fr: sc.category, en: sc.category }
              return (
                <div key={sc.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>{sc.description} <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>— {lang === 'fr' ? cat.fr : cat.en}</span></span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{owed.toLocaleString(locale)} FCFA</span>
                </div>
              )
            })}
          </div>
          <CollectPaymentForm
            invoiceId={null}
            chargeIds={(uninvoicedCharges ?? []).map((sc: any) => sc.id)}
            totalOwed={(uninvoicedCharges ?? []).reduce((sum: number, sc: any) =>
              sum + Number(sc.patient_portion_xaf ?? sc.amount_xaf) - Number(sc.amount_paid_xaf ?? 0), 0)}
            lang={lang}
            locale={locale}
          />
        </div>
      )}

      {(!invoices || invoices.length === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucune facture pour ce patient.' : 'No invoices for this patient.'}</p>
      )}

      {(invoices ?? []).map((inv: any) => {
        const paid = paidByInvoice.get(inv.id) ?? 0
        // Patient-owed total, per item, using patient_portion_xaf when
        // insurance applies — this directly feeds CollectPaymentForm's
        // amount below.
        const patientOwed = (inv.invoice_items ?? []).reduce((sum: number, item: any) => {
          const portion = item.service_charges?.patient_portion_xaf
          return sum + Number(portion != null ? portion : item.amount_xaf)
        }, 0)
        const balance = patientOwed - paid
        const invoicePayments = (payments ?? []).filter((p: any) => p.invoice_id === inv.id)

        return (
          <div key={inv.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>
                  {inv.invoice_number ?? inv.id.slice(0, 8)} · {new Date(inv.created_at).toLocaleDateString(locale)}
                </p>
                {(inv.invoice_items ?? []).map((item: any) => (
                  <div key={item.id} style={{ marginTop: '2px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, display: 'inline' }}>
                      {item.service_charges?.description} — {Number(item.amount_xaf).toLocaleString(locale)} FCFA
                      {item.service_charges?.patient_portion_xaf != null && (
                        <span style={{ color: 'var(--color-success-text)' }}>
                          {' '}{lang==='fr'?'(Assurance :':'(Insurance:'} {Number(item.service_charges.insurer_portion_xaf).toLocaleString(locale)} {lang==='fr'?'· Patient :':'· Patient:'} {Number(item.service_charges.patient_portion_xaf).toLocaleString(locale)})
                        </span>
                      )}
                    </p>
                    {balance > 0 && item.service_charge_id && (
                      <span style={{ marginLeft: '8px' }}>
                        <RequestDiscountButton serviceChargeId={item.service_charge_id} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '15px', fontWeight: 600, margin: 0, fontFamily: 'var(--font-mono)' }}>
                  {Number(inv.total_amount_xaf).toLocaleString(locale)} FCFA
                </p>
                <p style={{ fontSize: '12px', margin: '2px 0 0', color: balance > 0 ? 'var(--color-critical-text)' : 'var(--color-success-text)' }}>
                  {balance > 0 ? `${lang==='fr'?'Solde':'Balance'} : ${balance.toLocaleString(locale)} FCFA` : lang==='fr'?'Payée':'Paid'}
                </p>
              </div>
            </div>

            {balance > 0 && <CollectPaymentForm invoiceId={inv.id} balance={balance} />}

            {invoicePayments.length > 0 && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)' }}>
                {invoicePayments.map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '3px 0' }}>
                    <span style={{ color: p.status === 'reversed' ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', textDecoration: p.status === 'reversed' ? 'line-through' : 'none' }}>
                      {new Date(p.created_at).toLocaleDateString(locale)} · {Number(p.total_amount_xaf).toLocaleString(locale)} FCFA · {(p.payment_splits ?? []).map((s: any) => s.method).join(', ')}
                    </span>
                    {p.status === 'completed' && <ReversePaymentButton paymentId={p.id} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
