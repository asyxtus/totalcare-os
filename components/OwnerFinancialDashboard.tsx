'use client'

import Link from 'next/link'
import { Card, Bar } from '@/components/dashboard/DashboardWidgets'
import { useLang } from '@/lib/i18n/LangContext'

interface RevenueDay { report_date: string; revenue_xaf: number; transaction_count: number }
interface MethodRow { method: string; total_xaf: number; transaction_count: number }
interface CashierRow { staff_id: string; staff_name: string; total_xaf: number; cash_xaf: number; transaction_count: number }
interface CategoryRow { category: string; total_xaf: number }
interface SaleRow { id: string; created_at: string; payment_method: string; total_amount_xaf: number; sold_by_name: string }
interface VarianceRow { id: string; staff_name: string; variance_xaf: number; expected_cash_xaf: number; closing_cash_xaf: number; closed_at: string | null }
interface Reconciliation { reconciliation_date: string; cash_counted_xaf: number; momo_counted_xaf: number; orange_money_counted_xaf: number; notes: string | null; reconciled_at: string }

interface Props {
  lang: 'fr' | 'en'
  revenue30: RevenueDay[]
  todayMethods: MethodRow[]
  todayCashiers: CashierRow[]
  todayCategories: CategoryRow[]
  recentSales: SaleRow[]
  variances: VarianceRow[]
  reconciliation: Reconciliation | null
  todayExpectedByMethod: Record<string, number>
  outstandingXaf: number
  overdueXaf: number
  unpaidChargeCount: number
  pendingShiftReviews: number
}

const methodLabels: Record<string, { fr: string; en: string }> = {
  cash: { fr: 'Espèces', en: 'Cash' },
  momo: { fr: 'MTN MoMo', en: 'MTN MoMo' },
  orange_money: { fr: 'Orange Money', en: 'Orange Money' },
  mixed: { fr: 'Mixte', en: 'Mixed' },
  deposit: { fr: 'Dépôt', en: 'Deposit' },
  insurance: { fr: 'Assurance', en: 'Insurance' },
}

function money(value: number, lang: 'fr' | 'en') {
  return `${Number(value || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

function dateTime(value: string | null, lang: 'fr' | 'en') {
  if (!value) return '—'
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' }).format(new Date(value))
}

export default function OwnerFinancialDashboard({
  revenue30, todayMethods, todayCashiers, todayCategories, recentSales, variances,
  reconciliation, todayExpectedByMethod, outstandingXaf, overdueXaf, unpaidChargeCount,
  pendingShiftReviews,
}: Props) {
  const lang = useLang()
  const todayRevenue = todayMethods.reduce((sum, row) => sum + Number(row.total_xaf || 0), 0)
  const thirtyDayRevenue = revenue30.reduce((sum, row) => sum + Number(row.revenue_xaf || 0), 0)
  const thirtyDayTransactions = revenue30.reduce((sum, row) => sum + Number(row.transaction_count || 0), 0)
  const maxRevenue = Math.max(...revenue30.map((row) => Number(row.revenue_xaf || 0)), 1)

  const expectedCash = todayExpectedByMethod.cash ?? 0
  const expectedMomo = todayExpectedByMethod.momo ?? 0
  const expectedOrange = todayExpectedByMethod.orange_money ?? 0
  const countedCash = reconciliation?.cash_counted_xaf ?? null
  const countedMomo = reconciliation?.momo_counted_xaf ?? null
  const countedOrange = reconciliation?.orange_money_counted_xaf ?? null
  const cashDelta = countedCash === null ? null : countedCash - expectedCash
  const momoDelta = countedMomo === null ? null : countedMomo - expectedMomo
  const orangeDelta = countedOrange === null ? null : countedOrange - expectedOrange
  const totalCounted = countedCash === null ? null : countedCash + (countedMomo ?? 0) + (countedOrange ?? 0)
  const totalExpected = expectedCash + expectedMomo + expectedOrange
  const totalDelta = totalCounted === null ? null : totalCounted - totalExpected

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>{lang === 'fr' ? 'Tableau financier du propriétaire' : 'Owner Financial Dashboard'}</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>{lang === 'fr' ? 'Recettes, encaissements, caisse et contrôles financiers' : 'Revenue, collections, cash control and financial integrity'}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link href="/billing" style={buttonStyle}>{lang === 'fr' ? 'Facturation' : 'Billing'}</Link>
          <Link href="/pharmacy/pos/sales" style={buttonStyle}>{lang === 'fr' ? 'Ventes POS' : 'POS Sales'}</Link>
          <Link href="/admin" style={buttonStyle}>{lang === 'fr' ? 'Administration' : 'Administration'}</Link>
        </div>
      </div>

      {(pendingShiftReviews > 0 || variances.length > 0 || (totalDelta !== null && Math.abs(totalDelta) > 0) || overdueXaf > 0) && (
        <div style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '13px' }}>
          ⚠ {lang === 'fr' ? 'Contrôles financiers nécessitant votre attention.' : 'Financial controls require your attention.'}
          {pendingShiftReviews > 0 && <span> {pendingShiftReviews} {lang === 'fr' ? 'écart(s) de caisse à examiner.' : 'cash variance(s) need review.'}</span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        <Kpi title={lang === 'fr' ? "Recettes aujourd'hui" : "Today's revenue"} value={money(todayRevenue, lang)} />
        <Kpi title={lang === 'fr' ? 'Recettes — 30 jours' : 'Revenue — 30 days'} value={money(thirtyDayRevenue, lang)} />
        <Kpi title={lang === 'fr' ? 'Transactions — 30 jours' : 'Transactions — 30 days'} value={thirtyDayTransactions.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} />
        <Kpi title={lang === 'fr' ? 'Créances en cours' : 'Outstanding'} value={money(outstandingXaf, lang)} tone={overdueXaf > 0 ? 'warning' : undefined} subtitle={`${unpaidChargeCount} ${lang === 'fr' ? 'frais non soldés' : 'unpaid charges'}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        <Card title={lang === 'fr' ? 'Recettes — 30 derniers jours' : 'Revenue — last 30 days'}>
          {revenue30.map((row) => <Bar key={row.report_date} label={row.report_date.slice(5)} value={Number(row.revenue_xaf || 0)} max={maxRevenue} lang={lang} />)}
        </Card>
        <Card title={lang === 'fr' ? "Encaissements aujourd'hui par mode" : "Today's collections by method"}>
          {todayMethods.length === 0 && <Empty lang={lang} />}
          {todayMethods.map((row) => <div key={row.method} style={rowStyle}><span>{methodLabels[row.method]?.[lang] ?? row.method}</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{money(Number(row.total_xaf), lang)}</span></div>)}
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '8px', paddingTop: '8px', ...rowStyle, fontWeight: 600 }}><span>Total</span><span>{money(todayRevenue, lang)}</span></div>
        </Card>
        <Card title={lang === 'fr' ? 'Recettes par activité — aujourd’hui' : 'Revenue by activity — today'}>
          {todayCategories.length === 0 && <Empty lang={lang} />}
          {todayCategories.map((row) => <div key={row.category} style={rowStyle}><span>{row.category}</span><span style={{ fontFamily: 'var(--font-mono)' }}>{money(Number(row.total_xaf), lang)}</span></div>)}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        <Card title={lang === 'fr' ? 'Réconciliation POS du jour' : "Today's POS reconciliation"}>
          <div style={{ ...rowStyle, marginBottom: '6px' }}><span>Espèces</span><span>{reconciliation ? `${money(countedCash ?? 0, lang)} / ${money(expectedCash, lang)}` : (lang === 'fr' ? 'Non réconcilié' : 'Not reconciled')}</span></div>
          <DeltaLine label={lang === 'fr' ? 'Écart espèces' : 'Cash variance'} delta={cashDelta} lang={lang} />
          <div style={{ ...rowStyle, marginBottom: '6px' }}><span>MTN MoMo</span><span>{reconciliation ? `${money(countedMomo ?? 0, lang)} / ${money(expectedMomo, lang)}` : '—'}</span></div>
          <DeltaLine label={lang === 'fr' ? 'Écart MoMo' : 'MoMo variance'} delta={momoDelta} lang={lang} />
          <div style={{ ...rowStyle, marginBottom: '6px' }}><span>Orange Money</span><span>{reconciliation ? `${money(countedOrange ?? 0, lang)} / ${money(expectedOrange, lang)}` : '—'}</span></div>
          <DeltaLine label={lang === 'fr' ? 'Écart Orange' : 'Orange variance'} delta={orangeDelta} lang={lang} />
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '8px', paddingTop: '8px', ...rowStyle, fontWeight: 600 }}><span>{lang === 'fr' ? 'Écart total' : 'Total variance'}</span><span style={{ color: totalDelta === null ? 'var(--color-text-secondary)' : totalDelta === 0 ? 'var(--color-success-text)' : 'var(--color-warning-text)' }}>{totalDelta === null ? (lang === 'fr' ? 'À réconcilier' : 'Needs reconciliation') : money(totalDelta, lang)}</span></div>
          {reconciliation?.notes && <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>{reconciliation.notes}</p>}
        </Card>
        <Card title={lang === 'fr' ? 'Écarts de caisse à examiner' : 'Cash variances requiring review'}>
          {variances.length === 0 && <p style={{ fontSize: '13px', color: 'var(--color-success-text)', margin: 0 }}>{lang === 'fr' ? 'Aucun écart en attente.' : 'No flagged variances.'}</p>}
          {variances.map((v) => <div key={v.id} style={{ borderBottom: '1px solid var(--color-border)', padding: '8px 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span style={{ fontSize: '13px' }}>{v.staff_name}</span><span style={{ fontFamily: 'var(--font-mono)', color: Number(v.variance_xaf) < 0 ? 'var(--color-critical-text)' : 'var(--color-warning-text)' }}>{money(Number(v.variance_xaf), lang)}</span></div><p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '3px 0 0' }}>{lang === 'fr' ? 'Attendu' : 'Expected'} {money(Number(v.expected_cash_xaf), lang)} · {lang === 'fr' ? 'Compté' : 'Counted'} {money(Number(v.closing_cash_xaf), lang)} · {dateTime(v.closed_at, lang)}</p></div>)}
          {variances.length > 0 && <Link href="/billing" style={{ display: 'inline-block', marginTop: '10px', fontSize: '12px', color: 'var(--color-accent)' }}>{lang === 'fr' ? 'Ouvrir la caisse et examiner →' : 'Open cashier controls →'}</Link>}
        </Card>
        <Card title={lang === 'fr' ? 'Encaissement par membre du personnel' : 'Collections by staff'}>
          {todayCashiers.length === 0 && <Empty lang={lang} />}
          {todayCashiers.map((row) => <div key={row.staff_id} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}><div style={rowStyle}><span>{row.staff_name}</span><strong style={{ fontFamily: 'var(--font-mono)' }}>{money(Number(row.total_xaf), lang)}</strong></div><p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>{row.transaction_count} {lang === 'fr' ? 'transactions' : 'transactions'} · {lang === 'fr' ? 'espèces' : 'cash'} {money(Number(row.cash_xaf || 0), lang)}</p></div>)}
        </Card>
      </div>

      <Card title={lang === 'fr' ? 'Dernières ventes POS' : 'Recent POS sales'}>
        {recentSales.length === 0 ? <Empty lang={lang} /> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}><thead><tr>{[lang === 'fr' ? 'Heure' : 'Time', lang === 'fr' ? 'Vendeur' : 'Seller', lang === 'fr' ? 'Paiement' : 'Payment', lang === 'fr' ? 'Montant' : 'Amount'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead><tbody>{recentSales.map((sale) => <tr key={sale.id}><td style={tdStyle}>{dateTime(sale.created_at, lang)}</td><td style={tdStyle}>{sale.sold_by_name}</td><td style={tdStyle}>{methodLabels[sale.payment_method]?.[lang] ?? sale.payment_method}</td><td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{money(Number(sale.total_amount_xaf), lang)}</td></tr>)}</tbody></table></div>}
      </Card>
    </div>
  )
}

function Kpi({ title, value, subtitle, tone }: { title: string; value: string; subtitle?: string; tone?: 'warning' }) {
  return <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}><p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 6px' }}>{title}</p><p style={{ fontSize: '20px', fontWeight: 600, margin: 0, fontFamily: 'var(--font-mono)', color: tone === 'warning' ? 'var(--color-warning-text)' : 'var(--color-text-primary)' }}>{value}</p>{subtitle && <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>{subtitle}</p>}</div>
}

function DeltaLine({ label, delta, lang }: { label: string; delta: number | null; lang: 'fr' | 'en' }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}><span>{label}</span><span style={{ color: delta === null ? 'var(--color-text-secondary)' : delta === 0 ? 'var(--color-success-text)' : 'var(--color-warning-text)', fontFamily: 'var(--font-mono)' }}>{delta === null ? '—' : money(delta, lang)}</span></div>
}

function Empty({ lang }: { lang: 'fr' | 'en' }) { return <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>{lang === 'fr' ? 'Aucune donnée.' : 'No data.'}</p> }

const buttonStyle: React.CSSProperties = { textDecoration: 'none', fontSize: '11px', padding: '6px 9px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', background: 'var(--color-surface)' }
const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '7px 6px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontWeight: 500 }
const tdStyle: React.CSSProperties = { padding: '8px 6px', borderBottom: '1px solid var(--color-border)' }
