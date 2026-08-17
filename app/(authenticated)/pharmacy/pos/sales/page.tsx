import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'
import PosDailyReconciliationForm from '@/components/PosDailyReconciliationForm'

function validDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00+01:00`)
  if (Number.isNaN(d.getTime())) return null
  return value
}

function dayRange(date: string) {
  const start = new Date(`${date}T00:00:00+01:00`)
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 86400000).toISOString(),
  }
}

function money(value: number, lang: 'fr' | 'en') {
  return `${value.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Comptant',
  momo: 'MTN MoMo',
  orange_money: 'Orange Money',
}

export default async function OwnerPosSalesBoard({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const staff = await getCurrentStaff()
  if (staff.role !== 'admin') redirect('/pharmacy')

  const lang = staff.preferredLanguage
  const date = validDate((await searchParams).date) ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' })
  const range = dayRange(date)
  const supabase = await createClient()

  const { data: sales, error: salesError } = await supabase
    .from('pos_sales')
    .select('id, created_at, total_amount_xaf, payment_method, status, staff(full_name)')
    .eq('clinic_id', staff.clinicId)
    .eq('status', 'completed')
    .gte('created_at', range.start)
    .lt('created_at', range.end)
    .order('created_at', { ascending: false })

  const saleIds = (sales ?? []).map((s: any) => s.id)
  const { data: items } = saleIds.length
    ? await supabase.from('pos_sale_items').select('pos_sale_id, quantity').in('pos_sale_id', saleIds)
    : { data: [] as any[] }

  const itemStats = new Map<string, { lines: number; units: number }>()
  for (const item of items ?? []) {
    const current = itemStats.get(item.pos_sale_id) ?? { lines: 0, units: 0 }
    current.lines += 1
    current.units += Number(item.quantity ?? 0)
    itemStats.set(item.pos_sale_id, current)
  }

  const expected = { cash: 0, momo: 0, orange_money: 0 }
  let gross = 0
  let units = 0
  const cashierStats = new Map<string, { name: string; count: number; revenue: number }>()

  for (const sale of sales ?? []) {
    const amount = Number(sale.total_amount_xaf ?? 0)
    gross += amount
    units += itemStats.get(sale.id)?.units ?? 0
    if (sale.payment_method in expected) expected[sale.payment_method as keyof typeof expected] += amount

    const cashier = (sale.staff as any)?.full_name ?? '—'
    const current = cashierStats.get(cashier) ?? { name: cashier, count: 0, revenue: 0 }
    current.count += 1
    current.revenue += amount
    cashierStats.set(cashier, current)
  }

  const { data: savedReconciliation } = await supabase
    .from('pos_daily_reconciliations')
    .select('cash_counted_xaf, momo_counted_xaf, orange_money_counted_xaf, notes, reconciled_at, staff:reconciled_by(full_name)')
    .eq('clinic_id', staff.clinicId)
    .eq('reconciliation_date', date)
    .maybeSingle()

  const reconciliationSaved = savedReconciliation ? {
    cash: Number(savedReconciliation.cash_counted_xaf ?? 0),
    momo: Number(savedReconciliation.momo_counted_xaf ?? 0),
    orange: Number(savedReconciliation.orange_money_counted_xaf ?? 0),
    notes: savedReconciliation.notes,
    reconciledAt: savedReconciliation.reconciled_at,
    reconciledBy: (savedReconciliation.staff as any)?.full_name ?? null,
  } : null

  const previousDate = new Date(`${date}T00:00:00+01:00`)
  previousDate.setDate(previousDate.getDate() - 1)
  const nextDate = new Date(`${date}T00:00:00+01:00`)
  nextDate.setDate(nextDate.getDate() + 1)
  const previous = previousDate.toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' })
  const next = nextDate.toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <Link href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Owner POS Sales Board</h1>
        <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '999px', background: 'var(--role-admin-bg)', color: 'var(--role-admin-text)', fontWeight: 600 }}>OWNER</span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1rem' }}>
        {lang === 'fr' ? 'Suivi des ventes comptoir, détail des transactions et rapprochement journalier.' : 'Track counter sales, transaction detail and daily reconciliation.'}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Link href={`/pharmacy/pos/sales?date=${previous}`} style={{ padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', color: 'var(--color-text-primary)', fontSize: '12px' }}>←</Link>
          <form method="get" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input name="date" type="date" defaultValue={date} style={{ padding: '7px 9px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '12px' }} />
            <button type="submit" style={{ padding: '7px 10px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', fontSize: '12px', fontWeight: 600 }}>Voir</button>
          </form>
          <Link href={`/pharmacy/pos/sales?date=${next}`} style={{ padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', color: 'var(--color-text-primary)', fontSize: '12px' }}>→</Link>
        </div>
        <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{date}</span>
      </div>

      {salesError && (
        <div style={{ padding: '10px 12px', marginBottom: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', fontSize: '12px' }}>
          Impossible de charger les ventes POS : {salesError.message}
        </div>
      )}

      <StatCardRow>
        <StatCard label={lang === 'fr' ? 'Ventes POS' : 'POS sales'} value={sales?.length ?? 0} />
        <StatCard label={lang === 'fr' ? 'Chiffre d’affaires' : 'Revenue'} value={money(gross, lang)} />
        <StatCard label={lang === 'fr' ? 'Articles vendus' : 'Units sold'} value={units} />
        <StatCard label={lang === 'fr' ? 'Comptant' : 'Cash'} value={money(expected.cash, lang)} />
      </StatCardRow>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', margin: '0 0 1.5rem' }}>
        {(['cash', 'momo', 'orange_money'] as const).map((method) => (
          <div key={method} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>{METHOD_LABELS[method]}</p>
            <strong style={{ fontSize: '17px', fontFamily: 'var(--font-mono)' }}>{money(expected[method], lang)}</strong>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>{lang === 'fr' ? 'Rapprochement journalier POS' : 'Daily POS reconciliation'}</p>
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
          {lang === 'fr' ? 'Les montants attendus sont calculés uniquement à partir des ventes POS terminées de cette journée.' : 'Expected amounts are derived only from completed POS sales for this day.'}
        </p>
        <PosDailyReconciliationForm
          date={date}
          expectedCash={expected.cash}
          expectedMomo={expected.momo}
          expectedOrange={expected.orange_money}
          saved={reconciliationSaved}
        />
        {reconciliationSaved && (
          <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '6px 0 0' }}>
            {lang === 'fr' ? 'Dernier rapprochement' : 'Last reconciliation'} : {new Date(reconciliationSaved.reconciledAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} · {reconciliationSaved.reconciledBy ?? '—'}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>{lang === 'fr' ? 'Ventes par caissier' : 'Sales by cashier'}</p>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            {[...cashierStats.values()].map((row, i) => (
              <div key={row.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderBottom: i < cashierStats.size - 1 ? '1px solid var(--color-border-subtle)' : 'none', fontSize: '12px' }}>
                <span>{row.name} <span style={{ color: 'var(--color-text-secondary)' }}>({row.count})</span></span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{money(row.revenue, lang)}</span>
              </div>
            ))}
            {cashierStats.size === 0 && <p style={{ padding: '12px', margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>Aucune vente.</p>}
          </div>
        </div>

        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>{lang === 'fr' ? 'Contrôle rapide' : 'Quick control'}</p>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
            <p style={{ fontSize: '12px', margin: '0 0 7px' }}>✓ {lang === 'fr' ? 'Chaque vente a un identifiant et un reçu imprimable.' : 'Every sale has an ID and printable receipt.'}</p>
            <p style={{ fontSize: '12px', margin: '0 0 7px' }}>✓ {lang === 'fr' ? 'Le stock POS est enregistré comme mouvement « sale ».' : 'POS stock consumption is recorded as a “sale” movement.'}</p>
            <p style={{ fontSize: '12px', margin: 0 }}>✓ {lang === 'fr' ? 'Cliquez une transaction pour voir les lots réellement consommés.' : 'Open a transaction to see the batches actually consumed.'}</p>
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{lang === 'fr' ? 'Transactions POS' : 'POS transactions'}</p>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{sales?.length ?? 0} transaction(s)</span>
        </div>
        <div style={{ overflowX: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '10px' }}>
                <th style={{ textAlign: 'left', padding: '9px 10px' }}>Heure</th>
                <th style={{ textAlign: 'left', padding: '9px 10px' }}>Vente</th>
                <th style={{ textAlign: 'left', padding: '9px 10px' }}>Caissier</th>
                <th style={{ textAlign: 'right', padding: '9px 10px' }}>Articles</th>
                <th style={{ textAlign: 'left', padding: '9px 10px' }}>Paiement</th>
                <th style={{ textAlign: 'right', padding: '9px 10px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(sales ?? []).map((sale: any, i: number) => {
                const stats = itemStats.get(sale.id) ?? { lines: 0, units: 0 }
                return (
                  <tr key={sale.id} style={{ borderBottom: i < (sales?.length ?? 0) - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                    <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{new Date(sale.created_at).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '9px 10px' }}><Link href={`/pharmacy/pos/sales/${sale.id}`} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>{sale.id.slice(0, 8)}…</Link></td>
                    <td style={{ padding: '9px 10px' }}>{(sale.staff as any)?.full_name ?? '—'}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{stats.units}</td>
                    <td style={{ padding: '9px 10px' }}>{METHOD_LABELS[sale.payment_method] ?? sale.payment_method}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{money(Number(sale.total_amount_xaf ?? 0), lang)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {(sales ?? []).length === 0 && <p style={{ padding: '1.25rem', margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>{lang === 'fr' ? 'Aucune vente POS pour cette journée.' : 'No POS sales for this day.'}</p>}
        </div>
      </div>
    </div>
  )
}
