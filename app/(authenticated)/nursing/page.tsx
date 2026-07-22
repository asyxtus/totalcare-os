// app/(authenticated)/nursing/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import QueueList from '@/components/QueueList'
import { Bar, DeltaBadge, Card, computeDeltaPct } from '@/components/dashboard/DashboardWidgets'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'

// Same Africa/Douala-aware date math used everywhere else in the
// dashboard work — WAT has no DST, so this is correct regardless of
// server timezone.
function doualaDateString(daysAgo: number = 0): string {
  const d = new Date()
  d.setUTCHours(d.getUTCHours() + 1)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export default async function NursingPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const { data: visits } = await supabase
    .from('visits')
    .select('id, status, visit_reason, created_at, is_emergency, triage_priority, patients(id, full_name, patient_code)')
    .eq('status', 'triage')
    .order('created_at', { ascending: true })

  // My own productivity — same pattern as Doctor and Laboratoire: this
  // week vs last week, honest "no reference" when there isn't two weeks
  // of data yet.
  const fourteenDaysAgo = doualaDateString(13)
  const { data: myProdRows } = await supabase
    .from('nurse_productivity_daily')
    .select('work_date, triages_completed')
    .eq('clinic_id', staff.clinicId)
    .eq('nurse_id', staff.staffId)
    .gte('work_date', fourteenDaysAgo)

  const sevenDaysAgo = doualaDateString(6)
  const thisWeekByDate = new Map<string, number>()
  for (let i = 6; i >= 0; i--) thisWeekByDate.set(doualaDateString(i), 0)
  let lastWeekTotal = 0
  for (const row of myProdRows ?? []) {
    if (row.work_date >= sevenDaysAgo) {
      thisWeekByDate.set(row.work_date, row.triages_completed)
    } else {
      lastWeekTotal += row.triages_completed
    }
  }
  const myWeekTrend = Array.from(thisWeekByDate.entries()).map(([date, value]) => ({ date, value }))
  const myWeekTotal = myWeekTrend.reduce((sum, d) => sum + d.value, 0)
  const myDeltaPct = computeDeltaPct(myWeekTotal, lastWeekTotal)

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>{lang==='fr'?'Soins infirmiers':'Nursing'}</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        {lang==='fr'?'Patients en attente de triage':'Patients awaiting triage'}
      </p>

      <StatCardRow>
        <StatCard label={lang === 'fr' ? 'En attente' : 'Waiting'} value={visits?.length ?? 0} />
        <StatCard label={lang === 'fr' ? 'Urgences' : 'Emergencies'} value={(visits ?? []).filter((v: any) => v.is_emergency).length} accent={(visits ?? []).some((v: any) => v.is_emergency) ? 'critical' : undefined} />
        <StatCard label={lang === 'fr' ? "Triages aujourd'hui" : 'Triaged today'} value={myWeekTrend[myWeekTrend.length - 1]?.value ?? 0} />
      </StatCardRow>
      <QueueList
        visits={(visits ?? []) as any}
        lang={staff.preferredLanguage}
        getHref={(v) => `/visits/${v.id}/triage`}
        emptyMessage={lang === 'fr' ? 'Aucun patient en attente de triage.' : 'No patients waiting for triage.'}
      />

      <div style={{ marginTop: '1.5rem', maxWidth: '360px' }}>
        <Card title={lang==='fr'?'Ma productivité — cette semaine':'My productivity — this week'}>
          <div style={{ marginBottom: '10px' }}><DeltaBadge pct={myDeltaPct} lang={lang} /></div>
          {myWeekTrend.map((d) => (
            <Bar key={d.date} label={d.date.slice(5)} value={d.value} max={Math.max(...myWeekTrend.map((x) => x.value), 1)} lang={lang} />
          ))}
        </Card>
      </div>
    </div>
  )
}
