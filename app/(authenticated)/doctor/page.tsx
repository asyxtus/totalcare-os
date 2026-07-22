// app/(authenticated)/doctor/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import TransferControl from '@/components/TransferControl'
import { Bar, DeltaBadge, Card, computeDeltaPct } from '@/components/dashboard/DashboardWidgets'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'

function timeAgo(dateStr: string, lang: 'fr' | 'en' = 'fr'): string {
  const minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (minutes < 1) return lang === 'fr' ? "à l'instant" : 'just now'
  if (lang === 'fr') {
    if (minutes < 60) return `il y a ${minutes} min`
    return `il y a ${Math.floor(minutes / 60)} h`
  }
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ago`
}

// Same Africa/Douala-aware date math used on the executive dashboard —
// WAT has no DST, so this is correct regardless of server timezone.
function doualaDateString(daysAgo: number = 0): string {
  const d = new Date()
  d.setUTCHours(d.getUTCHours() + 1)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export default async function DoctorPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  // Fetch broadly (waiting or in_consultation, clinic-scoped via RLS),
  // then filter precisely in JS: a doctor sees UNASSIGNED waiting
  // patients (anyone can pick these up), patients ASSIGNED TO THEM
  // specifically (whether waiting or already in consultation), but never
  // another doctor's assigned or in-progress patients. This nested
  // condition is simpler to express correctly here than as one gnarly
  // PostgREST filter string.
  const { data: rawVisits } = await supabase
    .from('visits')
    .select('id, status, visit_reason, created_at, is_emergency, assigned_doctor_id, triage_priority, priority_note, patients(id, full_name, patient_code)')
    .in('status', ['waiting_consultation', 'in_consultation'])
    .order('triage_priority', { ascending: false })  // critical > urgent > routine alphabetically — we'll re-sort in JS
    .order('created_at', { ascending: true })

  const PRIORITY_ORDER: Record<string, number> = { critical: 0, urgent: 1, routine: 2 }

  const visits = (rawVisits ?? [])
    .filter((v) =>
      (v.status === 'waiting_consultation' && (v.assigned_doctor_id === null || v.assigned_doctor_id === staff.staffId)) ||
      (v.status === 'in_consultation' && v.assigned_doctor_id === staff.staffId)
    )
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[(a as any).triage_priority ?? 'routine'] ?? 2
      const pb = PRIORITY_ORDER[(b as any).triage_priority ?? 'routine'] ?? 2
      if (pa !== pb) return pa - pb
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

  const { data: doctorList } = await supabase
    .from('staff')
    .select('id, full_name')
    .eq('role', 'doctor')
    .eq('is_active', true)

  // My own productivity — last 14 days, split into this week vs last
  // week for the comparison badge, same pattern as the executive
  // dashboard.
  const fourteenDaysAgo = doualaDateString(13)
  const { data: myProdRows } = await supabase
    .from('doctor_productivity_daily')
    .select('work_date, consultations_completed')
    .eq('clinic_id', staff.clinicId)
    .eq('doctor_id', staff.staffId)
    .gte('work_date', fourteenDaysAgo)

  const sevenDaysAgo = doualaDateString(6)
  const thisWeekByDate = new Map<string, number>()
  for (let i = 6; i >= 0; i--) thisWeekByDate.set(doualaDateString(i), 0)
  let lastWeekTotal = 0
  for (const row of myProdRows ?? []) {
    if (row.work_date >= sevenDaysAgo) {
      thisWeekByDate.set(row.work_date, row.consultations_completed)
    } else {
      lastWeekTotal += row.consultations_completed
    }
  }
  const myWeekTrend = Array.from(thisWeekByDate.entries()).map(([date, value]) => ({ date, value }))
  const myWeekTotal = myWeekTrend.reduce((sum, d) => sum + d.value, 0)
  const criticalVisits = visits.filter((v) => (v as any).triage_priority === 'critical')
  const myDeltaPct = computeDeltaPct(myWeekTotal, lastWeekTotal)

  const PRIORITY_META: Record<string, { fr: string; en: string; bg: string; text: string }> = {
    critical: { fr: '⚠ CRITIQUE', en: '⚠ CRITICAL', bg: 'var(--color-critical-bg)', text: 'var(--color-critical-text)' },
    urgent:   { fr: 'URGENT',    en: 'URGENT',    bg: 'var(--color-warning-bg)',  text: 'var(--color-warning-text)' },
    routine:  { fr: 'Routine',   en: 'Routine',   bg: 'var(--color-bg)',          text: 'var(--color-text-secondary)' },
  }

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>{lang === 'fr' ? 'Médecin' : 'Doctor'}</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        {lang === 'fr' ? 'Patients en attente de consultation' : 'Patients awaiting consultation'}
      </p>

      {/* Critical alert banner — appears when nurse has flagged a patient as critical */}
      {criticalVisits.length > 0 && (
        <div style={{
          background: 'var(--color-critical-bg)', border: '2px solid var(--color-critical-text)',
          borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '18px' }}>⚠</span>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-critical-text)', margin: 0 }}>
              {lang === 'fr'
                ? `${criticalVisits.length} patient(s) CRITIQUE(S) — à voir immédiatement`
                : `${criticalVisits.length} CRITICAL patient(s) — see immediately`}
            </p>
            {criticalVisits.map((v: any) => v.priority_note).filter(Boolean).map((note: string, i: number) => (
              <p key={i} style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '2px 0 0', fontStyle: 'italic' }}>
                {note}
              </p>
            ))}
          </div>
        </div>
      )}

      <StatCardRow>
        <StatCard label={lang === 'fr' ? 'En attente' : 'Waiting'} value={visits.filter((v) => v.status === 'waiting_consultation').length} />
        <StatCard label={lang === 'fr' ? 'En consultation' : 'In consultation'} value={visits.filter((v) => v.status === 'in_consultation').length} />
        <StatCard label={lang === 'fr' ? 'Urgences médicales' : 'Emergencies'} value={visits.filter((v) => v.is_emergency).length} accent={visits.some((v) => v.is_emergency) ? 'critical' : undefined} />
        <StatCard label={lang === 'fr' ? "Terminées aujourd'hui" : 'Completed today'} value={myWeekTrend[myWeekTrend.length - 1]?.value ?? 0} />
      </StatCardRow>

      {visits.length === 0 && (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          {lang === 'fr' ? 'Aucun patient en attente de consultation.' : 'No patients awaiting consultation.'}
        </p>
      )}

      {visits.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {visits.map((visit, i) => {
            const patient = visit.patients as any
            const priority = (visit as any).triage_priority ?? 'routine'
            const priorityMeta = PRIORITY_META[priority]
            const priorityNote = (visit as any).priority_note
            const href = visit.status === 'in_consultation' || visit.assigned_doctor_id === staff.staffId || visit.assigned_doctor_id === null
              ? `/visits/${visit.id}/consultation`
              : '#'
            return (
              <div key={visit.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: i < visits.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                background: priority === 'critical' ? 'color-mix(in srgb, var(--color-critical-bg) 40%, transparent)' : 'transparent',
              }}>
                <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: priority === 'critical' ? 'var(--color-critical-bg)' : priority === 'urgent' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
                    color: priority === 'critical' ? 'var(--color-critical-text)' : priority === 'urgent' ? 'var(--color-warning-text)' : 'var(--color-success-text)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700,
                  }}>
                    {priority === 'critical' ? '!' : priority === 'urgent' ? '↑' : (patient?.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') ?? '?')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {patient?.full_name ?? '—'}
                      {/* Priority badge — only show for non-routine */}
                      {priority !== 'routine' && (
                        <span style={{
                          fontSize: '10px', padding: '1px 7px', borderRadius: '999px',
                          background: priorityMeta.bg, color: priorityMeta.text, fontWeight: 700,
                        }}>
                          {lang === 'fr' ? priorityMeta.fr : priorityMeta.en}
                        </span>
                      )}
                      {visit.is_emergency && (
                        <span style={{
                          fontSize: '10px', padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
                        }}>
                          {lang === 'fr' ? 'URGENCE' : 'EMERGENCY'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {patient?.patient_code}
                      {visit.visit_reason ? ` · ${visit.visit_reason}` : ''}
                    </div>
                    {/* Nurse's note to the doctor */}
                    {priorityNote && (
                      <div style={{ fontSize: '11px', color: priority === 'critical' ? 'var(--color-critical-text)' : 'var(--color-warning-text)', marginTop: '3px', fontStyle: 'italic' }}>
                        📋 {priorityNote}
                      </div>
                    )}
                  </div>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{timeAgo(visit.created_at, lang)}</span>
                  <span style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    background: visit.status === 'in_consultation' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                    color: visit.status === 'in_consultation' ? 'var(--color-success-text)' : 'var(--color-warning-text)',
                  }}>
                    {visit.status === 'in_consultation' ? (lang === 'fr' ? 'En consultation' : 'In consultation') : (lang === 'fr' ? 'En attente' : 'Waiting')}
                  </span>
                  {visit.status === 'waiting_consultation' && (
                    <TransferControl visitId={visit.id} doctors={doctorList ?? []} currentDoctorId={visit.assigned_doctor_id} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: '1.5rem', maxWidth: '360px' }}>
        <Card title={lang==='fr'?"Ma productivité — cette semaine":"My productivity — this week"}>
          <div style={{ marginBottom: '10px' }}><DeltaBadge pct={myDeltaPct} lang={lang} /></div>
          {myWeekTrend.map((d) => (
            <Bar key={d.date} label={d.date.slice(5)} value={d.value} max={Math.max(...myWeekTrend.map((x) => x.value), 1)} lang={lang} />
          ))}
        </Card>
      </div>
    </div>
  )
}
