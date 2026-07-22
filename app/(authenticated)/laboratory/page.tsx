// app/(authenticated)/laboratory/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { Bar, DeltaBadge, Card, computeDeltaPct } from '@/components/dashboard/DashboardWidgets'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'


function doualaDateString(daysAgo: number = 0): string {
  const d = new Date()
  d.setUTCHours(d.getUTCHours() + 1)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export default async function LaboratoryPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'

  const STATUS_LABELS: Record<string, string> = {
    pending: lang === 'fr' ? 'En attente de prélèvement' : 'Awaiting sample',
    sample_collected: lang === 'fr' ? 'Prélevé — en cours' : 'Sample collected',
    completed: lang === 'fr' ? 'Terminé' : 'Completed',
    cancelled: lang === 'fr' ? 'Annulé' : 'Cancelled',
  }

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
  // than sitting in this list forever with no way to clear it.
  const unverified = (unverifiedRaw ?? []).filter((item: any) => {
    const result = firstResultOf(item)
    return result && !result.verified_at
  })
  if (unverifiedError) console.error('unverified lab items:', unverifiedError)

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

  const panelName = (id: string | null) => {
    const p = panels?.find((x) => x.id === id)
    return (lang === 'en' && p?.name_en) ? p.name_en : (p?.name_fr ?? '—')
  }
  const testName = (id: string | null) => {
    const t = tests?.find((x) => x.id === id)
    return (lang === 'en' && t?.name_en) ? t.name_en : (t?.name_fr ?? '—')
  }

  function itemLabel(item: any): string {
    if (item.item_type === 'panel') return panelName(item.lab_panel_id)
    if (item.item_type === 'individual_test') return testName(item.lab_test_catalog_id)
    return `${item.external_test_name} (externe)`
  }

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

      {!error && (!items || items.length === 0) && (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          {lang === 'fr' ? 'Aucun examen en attente.' : 'No tests pending.'}
        </p>
      )}

      {items && items.length > 0 && (() => {
        // Group tests ordered together (same lab_order_id) under one card —
        // a patient with 3 tests from one visit shouldn't repeat their name
        // 3 times in the queue. Groups are ordered by their earliest item's
        // created_at, oldest first, matching the original flat-list order.
        const groups = new Map<string, { order: any; patient: any; items: any[] }>()
        for (const item of items as any[]) {
          const orderId = item.lab_order_id
          if (!groups.has(orderId)) {
            groups.set(orderId, {
              order: item.lab_orders,
              patient: item.lab_orders?.visits?.patients,
              items: [],
            })
          }
          groups.get(orderId)!.items.push(item)
        }
        const groupList = Array.from(groups.values())

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {groupList.map((group) => {
              const patient = group.patient
              const orderedAt = group.order?.ordered_at
              return (
                <div key={group.order?.id ?? group.items[0].id} style={{
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                }}>
                  {/* Patient header — shown once per group, not per test */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    padding: '10px 16px', borderBottom: '1px solid var(--color-border-subtle)',
                    background: 'var(--color-bg)',
                  }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{patient?.full_name ?? '—'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                        {patient?.patient_code}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {group.items.length > 1 && (
                        <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '999px', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)' }}>
                          {group.items.length} {lang === 'fr' ? 'examens' : 'tests'}
                        </span>
                      )}
                      {orderedAt && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {new Date(orderedAt).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* One row per test within the group */}
                  {group.items.map((item: any, i: number) => {
                    const isExternal = item.item_type === 'external'
                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px',
                        borderBottom: i < group.items.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                      }}>
                        <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                          {itemLabel(item)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)',
                          }}>
                            {STATUS_LABELS[item.status]}
                          </span>
                          {isExternal ? (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                              {lang === 'fr' ? "Envoyé à l'extérieur — pas de résultat à saisir ici" : 'Sent externally — no result to enter here'}
                            </span>
                          ) : (
                            <Link href={`/laboratory/${item.id}`} style={{
                              fontSize: '12px', color: 'var(--color-accent)', textDecoration: 'none',
                              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px',
                            }}>
                              {lang === 'fr' ? 'Ouvrir →' : 'Open →'}
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })()}

      {unverified.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 8px', color: 'var(--color-warning-text)' }}>
            ⚠ {lang === 'fr' ? 'Résultats saisis en attente de validation' : 'Results entered, awaiting verification'}
          </p>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-warning-text)', borderRadius: 'var(--radius-md)' }}>
            {unverified.map((item: any, i: number) => {
              const patient = item.lab_orders?.visits?.patients
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: i < unverified.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                }}>
                  <div>
                    <span style={{ fontSize: '13px' }}>{patient?.full_name ?? '—'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                      {patient?.patient_code} · {itemLabel(item)}
                    </span>
                  </div>
                  <Link href={`/laboratory/${item.id}`} style={{
                    fontSize: '12px', color: 'var(--color-accent)', textDecoration: 'none',
                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px',
                  }}>
                    {lang === 'fr' ? 'Valider →' : 'Verify →'}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
