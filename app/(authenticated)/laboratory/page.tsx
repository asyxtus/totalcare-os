// app/(authenticated)/laboratory/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { Bar, DeltaBadge, Card, computeDeltaPct } from '@/components/dashboard/DashboardWidgets'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'
import LaboratoryQueueTabs from '@/components/LaboratoryQueueTabs'

function doualaDateString(daysAgo: number = 0): string {
  const d = new Date()
  d.setUTCHours(d.getUTCHours() + 1)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export default async function LaboratoryPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage

  const supabase = await createClient()

  const { data: items, error } = await supabase
    .from('lab_order_items')
    .select(`
      id, item_type, status, created_at, external_test_name, lab_order_id,
      lab_panel_id, lab_test_catalog_id,
      lab_orders(id, ordered_at, visit_id, visits(patients(id, full_name, patient_code)))
    `)
    .in('status', ['pending', 'sample_collected'])
    .order('created_at', { ascending: true })

  // Results entered but not yet verified — these leave the pending queue
  // above once status flips to 'completed', so without this second query
  // they'd be invisible anywhere: not in the pending list, not in any
  // "done" list, findable only by guessing the item's direct URL.
  const { data: unverifiedRaw, error: unverifiedError } = await supabase
    .from('lab_order_items')
    .select(`
      id, item_type, created_at, external_test_name, lab_order_id,
      lab_panel_id, lab_test_catalog_id,
      lab_orders(id, ordered_at, visit_id, visits(patients(id, full_name, patient_code))),
      lab_results(id, verified_at)
    `)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })

  const firstResultOf = (item: any) => {
    const r = item.lab_results
    if (!r) return null
    return Array.isArray(r) ? (r[0] ?? null) : r
  }
  // Only items that actually have an individual result row belong in the
  // verification queue. An attachment-only completion (photo of a printed
  // panel, no manual values) has nothing to verify through this mechanism —
  // the attached file itself is the record — so it's excluded here rather
  // than sitting in this list forever with no way to clear it. It shows up
  // in the Completed tab below instead.
  const unverified = (unverifiedRaw ?? []).filter((item: any) => {
    const result = firstResultOf(item)
    return result && !result.verified_at
  })
  if (unverifiedError) console.error('unverified lab items:', unverifiedError)

  // Completed tab — every test that's actually done: verified individual
  // results AND attachment-only completions alike. This is the "history /
  // lookup" view, separate from the two lists above (which are the
  // active, actionable queue a lab tech checks constantly).
  const { data: completedRaw, error: completedError } = await supabase
    .from('lab_order_items')
    .select(`
      id, item_type, created_at, external_test_name, lab_order_id,
      lab_panel_id, lab_test_catalog_id,
      lab_orders(id, ordered_at, visit_id, visits(patients(id, full_name, patient_code))),
      lab_results(id, verified_at, numeric_value, qualitative_value, is_abnormal, is_critical)
    `)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(200)
  if (completedError) console.error('completed lab items:', completedError)

  const completed = (completedRaw ?? []).filter((item: any) => {
    const result = firstResultOf(item)
    return !result || result.verified_at // either attachment-only, or a verified value result
  })

  const { data: panels } = await supabase.from('lab_panels').select('id, name_fr, name_en')
  const { data: tests } = await supabase.from('lab_test_catalog').select('id, name_fr, name_en')

  // My own productivity — same pattern as the doctor's page and the
  // executive dashboard: this week vs last week, honest "no reference"
  // when there isn't two weeks of data yet.
  const fourteenDaysAgo = doualaDateString(13)
  const { data: myProdRows } = await supabase
    .from('lab_tech_productivity_daily')
    .select('work_date, results_recorded')
    .eq('clinic_id', staff.clinicId)
    .eq('lab_tech_id', staff.staffId)
    .gte('work_date', fourteenDaysAgo)

  const sevenDaysAgo = doualaDateString(6)
  const thisWeekByDate = new Map<string, number>()
  for (let i = 6; i >= 0; i--) thisWeekByDate.set(doualaDateString(i), 0)
  let lastWeekTotal = 0
  for (const row of myProdRows ?? []) {
    if (row.work_date >= sevenDaysAgo) {
      thisWeekByDate.set(row.work_date, row.results_recorded)
    } else {
      lastWeekTotal += row.results_recorded
    }
  }
  const myWeekTrend = Array.from(thisWeekByDate.entries()).map(([date, value]) => ({ date, value }))
  const myWeekTotal = myWeekTrend.reduce((sum, d) => sum + d.value, 0)
  const myDeltaPct = computeDeltaPct(myWeekTotal, lastWeekTotal)

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>{lang === 'fr' ? 'Laboratoire' : 'Laboratory'}</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        {lang === 'fr' ? 'Examens en attente de prélèvement ou de résultat' : 'Tests awaiting sample collection or results'}
      </p>

      <StatCardRow>
        <StatCard label={lang === 'fr' ? 'En attente' : 'Pending'} value={(items ?? []).filter((i: any) => i.status === 'pending').length} />
        <StatCard label={lang === 'fr' ? 'En cours' : 'In progress'} value={(items ?? []).filter((i: any) => i.status === 'sample_collected').length} />
        <StatCard label={lang === 'fr' ? 'À valider' : 'Awaiting verification'} value={unverified.length} accent={unverified.length > 0 ? 'warning' : undefined} />
        <StatCard label={lang === 'fr' ? "Terminés aujourd'hui" : 'Completed today'} value={myWeekTrend[myWeekTrend.length - 1]?.value ?? 0} />
      </StatCardRow>

      {error && (
        <p style={{ color: 'var(--color-critical-text)', fontSize: '14px' }}>
          {lang === 'fr' ? "Impossible de charger la file d'attente du laboratoire." : 'Unable to load the laboratory queue.'}
        </p>
      )}

      <LaboratoryQueueTabs
        lang={lang}
        pendingItems={items ?? []}
        unverifiedItems={unverified}
        completedItems={completed}
        panels={panels ?? []}
        tests={tests ?? []}
      />

      <div style={{ marginTop: '1.5rem', maxWidth: '360px' }}>
        <Card title={lang === 'fr' ? 'Ma productivité — cette semaine' : 'My productivity — this week'}>
          <div style={{ marginBottom: '10px' }}><DeltaBadge pct={myDeltaPct} lang={lang} /></div>
          {myWeekTrend.map((d) => (
            <Bar key={d.date} label={d.date.slice(5)} value={d.value} max={Math.max(...myWeekTrend.map((x) => x.value), 1)} lang={lang} />
          ))}
        </Card>
      </div>
    </div>
  )
}
