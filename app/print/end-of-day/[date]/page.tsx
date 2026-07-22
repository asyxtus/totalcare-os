// app/print/end-of-day/[date]/page.tsx
//
// The daily anti-theft document. Printed at close of business, signed by
// the cashier and the manager. Shows: total collected by method (what
// should physically be in the drawer for cash), by cashier (who is
// accountable), by category (where revenue came from), and shift
// reconciliation status.

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import PrintButton from '@/components/PrintButton'

const METHOD_LABELS: Record<string, { fr: string; en: string }> = {
  cash: { fr: 'Espèces', en: 'Cash' },
  momo: { fr: 'MTN MoMo', en: 'MTN MoMo' },
  orange_money: { fr: 'Orange Money', en: 'Orange Money' },
  card: { fr: 'Carte', en: 'Card' },
  transfer: { fr: 'Virement', en: 'Transfer' },
  deposit: { fr: 'Dépôt patient', en: 'Patient deposit' },
}

const CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  consultation: { fr: 'Consultations', en: 'Consultations' },
  lab: { fr: 'Laboratoire', en: 'Laboratory' },
  pharmacy: { fr: 'Pharmacie (ordonnances)', en: 'Pharmacy (Rx)' },
  pos: { fr: 'Ventes directes', en: 'Direct sales (POS)' },
  admission: { fr: 'Hospitalisation', en: 'Inpatient' },
  procedure: { fr: 'Actes', en: 'Procedures' },
}

export default async function EndOfDayReportPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound()

  const [methodRes, cashierRes, categoryRes, shiftsRes, clinicRes] = await Promise.all([
    supabase.rpc('eod_revenue_by_method', { p_clinic_id: staff.clinicId, p_date: date }),
    supabase.rpc('eod_revenue_by_cashier', { p_clinic_id: staff.clinicId, p_date: date }),
    supabase.rpc('eod_revenue_by_category', { p_clinic_id: staff.clinicId, p_date: date }),
    supabase
      .from('cashier_shifts')
      .select('id, staff_id, opened_at, closed_at, opening_cash_xaf, expected_cash_xaf, closing_cash_xaf, variance_xaf, status')
      .eq('clinic_id', staff.clinicId)
      .gte('opened_at', `${date}T00:00:00Z`)
      .lte('opened_at', `${date}T23:59:59Z`),
    supabase.from('clinics').select('name, city, quartier, phone').eq('id', staff.clinicId).maybeSingle(),
  ])

  const byMethod = methodRes.data ?? []
  const byCashier = cashierRes.data ?? []
  const byCategory = categoryRes.data ?? []
  const shifts = shiftsRes.data ?? []
  const clinic = clinicRes.data

  const shiftStaffIds = [...new Set(shifts.map((s: any) => s.staff_id))]
  const { data: shiftStaffRows } = shiftStaffIds.length > 0
    ? await supabase.from('staff').select('id, full_name').in('id', shiftStaffIds)
    : { data: [] }
  const staffNameById = new Map((shiftStaffRows ?? []).map((s: any) => [s.id, s.full_name]))

  const grandTotal = byMethod.reduce((sum: number, m: any) => sum + Number(m.total_xaf), 0)
  const cashTotal = Number(byMethod.find((m: any) => m.method === 'cash')?.total_xaf ?? 0)

  const fmt = (n: number) => n.toLocaleString(locale)
  const dateLabel = new Date(date + 'T12:00:00Z').toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const th: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', fontSize: '11px', textTransform: 'uppercase', borderBottom: '2px solid #333', color: '#555' }
  const td: React.CSSProperties = { padding: '7px 10px', fontSize: '13px', borderBottom: '1px solid #ddd' }
  const tdRight: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'monospace' }

  const L = {
    reportTitle: lang === 'fr' ? 'RAPPORT DE FIN DE JOURNÉE' : 'END-OF-DAY CASH REPORT',
    totalCollected: lang === 'fr' ? 'Total encaissé' : 'Total collected',
    cashExpected: lang === 'fr' ? '💵 Espèces attendues en caisse' : '💵 Cash expected in drawer',
    byMethod: lang === 'fr' ? 'Par mode de paiement' : 'By payment method',
    method: lang === 'fr' ? 'Mode' : 'Method',
    transactions: 'Transactions',
    amount: lang === 'fr' ? 'Montant' : 'Amount',
    total: lang === 'fr' ? 'TOTAL' : 'TOTAL',
    byCashier: lang === 'fr' ? 'Par caissier' : 'By cashier',
    cashier: lang === 'fr' ? 'Caissier' : 'Cashier',
    cash: lang === 'fr' ? 'Espèces' : 'Cash',
    byCategory: lang === 'fr' ? 'Par catégorie' : 'By category',
    category: lang === 'fr' ? 'Catégorie' : 'Category',
    reconciliation: lang === 'fr' ? 'Clôtures de caisse' : 'Shift reconciliation',
    openingFloat: lang === 'fr' ? 'Fond de caisse' : 'Opening float',
    expected: lang === 'fr' ? 'Attendu' : 'Expected',
    counted: lang === 'fr' ? 'Compté' : 'Counted',
    variance: lang === 'fr' ? 'Écart' : 'Variance',
    open: lang === 'fr' ? ' (ouvert)' : ' (open)',
    cashierSig: lang === 'fr' ? 'Signature du caissier' : 'Cashier signature',
    managerSig: lang === 'fr' ? 'Signature du responsable' : 'Manager signature',
    generated: lang === 'fr' ? 'Généré le' : 'Generated',
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif', color: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #111', paddingBottom: '12px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px' }}>{clinic?.name ?? 'Clinic'}</h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#555' }}>
            {[clinic?.quartier, clinic?.city].filter(Boolean).join(', ')}{clinic?.phone ? ` · ${clinic.phone}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{L.reportTitle}</p>
          <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: 600 }}>{dateLabel}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ flex: 1, border: '2px solid #111', borderRadius: '6px', padding: '12px 16px' }}>
          <p style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', color: '#555' }}>{L.totalCollected}</p>
          <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 700, fontFamily: 'monospace' }}>{fmt(grandTotal)} FCFA</p>
        </div>
        <div style={{ flex: 1, border: '2px solid #16a34a', borderRadius: '6px', padding: '12px 16px', background: '#f0fdf4' }}>
          <p style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', color: '#166534' }}>{L.cashExpected}</p>
          <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 700, fontFamily: 'monospace', color: '#166534' }}>{fmt(cashTotal)} FCFA</p>
        </div>
      </div>

      <h2 style={{ fontSize: '14px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{L.byMethod}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr>
            <th style={th}>{L.method}</th>
            <th style={{ ...th, textAlign: 'right' }}>{L.transactions}</th>
            <th style={{ ...th, textAlign: 'right' }}>{L.amount}</th>
          </tr>
        </thead>
        <tbody>
          {byMethod.map((m: any) => (
            <tr key={m.method}>
              <td style={td}>{METHOD_LABELS[m.method]?.[lang] ?? m.method}</td>
              <td style={tdRight}>{m.transaction_count}</td>
              <td style={tdRight}>{fmt(Number(m.total_xaf))} FCFA</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, fontWeight: 700, borderTop: '2px solid #333' }}>{L.total}</td>
            <td style={{ ...tdRight, fontWeight: 700, borderTop: '2px solid #333' }}>
              {byMethod.reduce((s: number, m: any) => s + Number(m.transaction_count), 0)}
            </td>
            <td style={{ ...tdRight, fontWeight: 700, borderTop: '2px solid #333' }}>{fmt(grandTotal)} FCFA</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: '14px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{L.byCashier}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr>
            <th style={th}>{L.cashier}</th>
            <th style={{ ...th, textAlign: 'right' }}>{L.transactions}</th>
            <th style={{ ...th, textAlign: 'right' }}>{L.cash}</th>
            <th style={{ ...th, textAlign: 'right' }}>{L.total}</th>
          </tr>
        </thead>
        <tbody>
          {byCashier.map((c: any) => (
            <tr key={c.staff_id}>
              <td style={td}>{c.staff_name}</td>
              <td style={tdRight}>{c.transaction_count}</td>
              <td style={tdRight}>{fmt(Number(c.cash_xaf ?? 0))} FCFA</td>
              <td style={tdRight}>{fmt(Number(c.total_xaf))} FCFA</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: '14px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{L.byCategory}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr>
            <th style={th}>{L.category}</th>
            <th style={{ ...th, textAlign: 'right' }}>{L.amount}</th>
          </tr>
        </thead>
        <tbody>
          {byCategory.map((c: any) => (
            <tr key={c.category}>
              <td style={td}>{CATEGORY_LABELS[c.category]?.[lang] ?? c.category}</td>
              <td style={tdRight}>{fmt(Number(c.total_xaf))} FCFA</td>
            </tr>
          ))}
        </tbody>
      </table>

      {shifts.length > 0 && (
        <>
          <h2 style={{ fontSize: '14px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{L.reconciliation}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
            <thead>
              <tr>
                <th style={th}>{L.cashier}</th>
                <th style={{ ...th, textAlign: 'right' }}>{L.openingFloat}</th>
                <th style={{ ...th, textAlign: 'right' }}>{L.expected}</th>
                <th style={{ ...th, textAlign: 'right' }}>{L.counted}</th>
                <th style={{ ...th, textAlign: 'right' }}>{L.variance}</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s: any) => {
                const variance = Number(s.variance_xaf ?? 0)
                return (
                  <tr key={s.id}>
                    <td style={td}>{staffNameById.get(s.staff_id) ?? '—'}{s.status !== 'closed' ? L.open : ''}</td>
                    <td style={tdRight}>{s.opening_cash_xaf != null ? `${fmt(Number(s.opening_cash_xaf))}` : '—'}</td>
                    <td style={tdRight}>{s.expected_cash_xaf != null ? `${fmt(Number(s.expected_cash_xaf))}` : '—'}</td>
                    <td style={tdRight}>{s.closing_cash_xaf != null ? `${fmt(Number(s.closing_cash_xaf))}` : '—'}</td>
                    <td style={{ ...tdRight, fontWeight: 700, color: variance === 0 ? '#166534' : '#b91c1c' }}>
                      {s.variance_xaf != null ? `${variance > 0 ? '+' : ''}${fmt(variance)}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      <div style={{ display: 'flex', gap: '32px', marginTop: '40px', pageBreakInside: 'avoid' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '12px', margin: '0 0 40px', color: '#555' }}>{L.cashierSig}</p>
          <div style={{ borderTop: '1px solid #333' }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '12px', margin: '0 0 40px', color: '#555' }}>{L.managerSig}</p>
          <div style={{ borderTop: '1px solid #333' }} />
        </div>
      </div>

      <p style={{ fontSize: '10px', color: '#999', marginTop: '24px', textAlign: 'center' }}>
        {L.generated} {new Date().toLocaleString(locale, { timeZone: 'Africa/Douala' })} · TotalCare OS
      </p>

      <div className="no-print" style={{ marginTop: '24px', textAlign: 'center' }}>
        <PrintButton lang={lang} />
      </div>
    </div>
  )
}
