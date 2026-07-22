// app/(authenticated)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import QueueList from '@/components/QueueList'
import ExecutiveDashboard from '@/components/ExecutiveDashboard'

// Africa/Douala has no DST — computing "today" this way is correct
// regardless of the server's own local timezone, matching the same
// precision used for service_date elsewhere in the system.
function doualaDateString(daysAgo: number = 0): string {
  const d = new Date()
  d.setUTCHours(d.getUTCHours() + 1) // WAT = UTC+1
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export default async function DashboardPage() {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const lang = staff.preferredLanguage

  if (staff.role === 'admin') {
    const sevenDaysAgo = doualaDateString(6)
    const today = doualaDateString(0)
    const fourteenDaysAgo = doualaDateString(13)
    const eightDaysAgo = doualaDateString(7)

    const { data: revenueRows, error: revenueRowsError } = await supabase
      .from('daily_revenue_by_method')
      .select('revenue_date, method, total_xaf')
      .eq('clinic_id', staff.clinicId)
      .gte('revenue_date', sevenDaysAgo)

    // Previous 7-day window — the actual comparison baseline that was
    // missing. Without this, "5,000 today" has no way to be read as
    // good, bad, or ordinary.
    const { data: previousWeekRevenueRows, error: previousWeekRevenueRowsError } = await supabase
      .from('daily_revenue_by_method')
      .select('total_xaf')
      .eq('clinic_id', staff.clinicId)
      .gte('revenue_date', fourteenDaysAgo)
      .lt('revenue_date', eightDaysAgo)

    const { data: previousWeekVisitRows, error: previousWeekVisitRowsError } = await supabase
      .from('daily_visit_counts')
      .select('visit_count')
      .eq('clinic_id', staff.clinicId)
      .gte('visit_date', fourteenDaysAgo)
      .lt('visit_date', eightDaysAgo)

    const revenueByDate = new Map<string, number>()
    for (let i = 6; i >= 0; i--) revenueByDate.set(doualaDateString(i), 0)
    for (const row of revenueRows ?? []) {
      revenueByDate.set(row.revenue_date, (revenueByDate.get(row.revenue_date) ?? 0) + row.total_xaf)
    }
    const revenueTrend = Array.from(revenueByDate.entries()).map(([date, value]) => ({ date, value }))

    const todayRevenueByMethod = (revenueRows ?? [])
      .filter((r) => r.revenue_date === today)
      .map((r) => ({ method: r.method, total: r.total_xaf }))

    const { data: visitRows, error: visitRowsError } = await supabase
      .from('daily_visit_counts')
      .select('visit_date, visit_count')
      .eq('clinic_id', staff.clinicId)
      .gte('visit_date', sevenDaysAgo)

    const visitsByDate = new Map<string, number>()
    for (let i = 6; i >= 0; i--) visitsByDate.set(doualaDateString(i), 0)
    for (const row of visitRows ?? []) {
      visitsByDate.set(row.visit_date, row.visit_count)
    }
    const visitTrend = Array.from(visitsByDate.entries()).map(([date, value]) => ({ date, value }))

    const { data: doctorProd } = await supabase
      .from('doctor_productivity_daily')
      .select('doctor_name, consultations_completed')
      .eq('clinic_id', staff.clinicId)
      .eq('work_date', today)
      .order('consultations_completed', { ascending: false })

    const { data: labProd } = await supabase
      .from('lab_tech_productivity_daily')
      .select('lab_tech_name, results_recorded')
      .eq('clinic_id', staff.clinicId)
      .eq('work_date', today)
      .order('results_recorded', { ascending: false })

    const { data: outstandingRows } = await supabase.rpc('outstanding_balance_summary', { p_clinic_id: staff.clinicId })
    const { data: complianceRows } = await supabase.rpc('compliance_pending_summary', { p_clinic_id: staff.clinicId })
    const { data: inventoryRows } = await supabase.rpc('inventory_alert_summary', { p_clinic_id: staff.clinicId })
    const { data: marginRows } = await supabase.rpc('profit_margin_summary', { p_clinic_id: staff.clinicId, p_days: 30 })
    const marginRow = marginRows?.[0]

    // Wait-time analytics (last 7 days)
    const { data: waitByStage } = await supabase.rpc('wait_time_by_stage', {
      p_clinic_id: staff.clinicId, p_from: sevenDaysAgo, p_to: today,
    })
    const { data: waitByDoctor } = await supabase.rpc('wait_time_by_doctor', {
      p_clinic_id: staff.clinicId, p_from: sevenDaysAgo, p_to: today,
    })

    const outstandingRow = outstandingRows?.[0]
    const complianceRow = complianceRows?.[0]
    const inventoryRow = inventoryRows?.[0]

    const currentWeekRevenueTotal = revenueTrend.reduce((sum, d) => sum + d.value, 0)
    const previousWeekRevenueTotal = (previousWeekRevenueRows ?? []).reduce((sum, r) => sum + r.total_xaf, 0)
    const revenueDeltaPct = previousWeekRevenueTotal > 0
      ? Math.round(((currentWeekRevenueTotal - previousWeekRevenueTotal) / previousWeekRevenueTotal) * 100)
      : null

    const currentWeekVisitTotal = visitTrend.reduce((sum, d) => sum + d.value, 0)
    const previousWeekVisitTotal = (previousWeekVisitRows ?? []).reduce((sum, r) => sum + r.visit_count, 0)
    const visitDeltaPct = previousWeekVisitTotal > 0
      ? Math.round(((currentWeekVisitTotal - previousWeekVisitTotal) / previousWeekVisitTotal) * 100)
      : null

    const hasActiveAlerts =
      (complianceRow?.pending_prescription_reviews ?? 0) + (complianceRow?.pending_shift_variance_reviews ?? 0) + (complianceRow?.pending_discount_approvals ?? 0) > 0 ||
      (inventoryRow?.expiring_soon_count ?? 0) + (inventoryRow?.low_stock_product_count ?? 0) > 0 ||
      (outstandingRow?.emergency_unpaid_count ?? 0) > 0

    return (
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>
          {lang === 'fr' ? `Bonjour, ${staff.fullName}` : `Hello, ${staff.fullName}`}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
          {staff.clinicName}
        </p>

        <ExecutiveDashboard
          lang={lang}
          revenueTrend={revenueTrend}
          revenueDeltaPct={revenueDeltaPct}
          todayRevenueByMethod={todayRevenueByMethod}
          visitTrend={visitTrend}
          visitDeltaPct={visitDeltaPct}
          doctorProductivityToday={(doctorProd ?? []).map((d) => ({ name: d.doctor_name, count: d.consultations_completed }))}
          labProductivityToday={(labProd ?? []).map((d) => ({ name: d.lab_tech_name, count: d.results_recorded }))}
          outstanding={{
            totalOutstandingXaf: outstandingRow?.total_outstanding_xaf ?? 0,
            unpaidChargeCount: outstandingRow?.unpaid_charge_count ?? 0,
            emergencyUnpaidCount: outstandingRow?.emergency_unpaid_count ?? 0,
            overdueOutstandingXaf: outstandingRow?.overdue_outstanding_xaf ?? 0,
            overdueChargeCount: outstandingRow?.overdue_charge_count ?? 0,
          }}
          compliance={{
            pendingPrescriptionReviews: complianceRow?.pending_prescription_reviews ?? 0,
            pendingShiftVarianceReviews: complianceRow?.pending_shift_variance_reviews ?? 0,
            pendingDiscountApprovals: complianceRow?.pending_discount_approvals ?? 0,
          }}
          inventory={{
            expiringSoonCount: inventoryRow?.expiring_soon_count ?? 0,
            lowStockProductCount: inventoryRow?.low_stock_product_count ?? 0,
          }}
          hasActiveAlerts={hasActiveAlerts}
          margin={{
            totalRevenueXaf: marginRow?.total_revenue_xaf ?? 0,
            totalCostXaf: marginRow?.total_cost_xaf ?? 0,
            totalProfitXaf: marginRow?.total_profit_xaf ?? 0,
            marginPct: marginRow?.margin_pct ?? null,
            dataCoveragePct: marginRow?.data_coverage_pct ?? null,
          }}
          waitByStage={(waitByStage ?? []).map((w: any) => ({
            stage: w.stage,
            avgMinutes: Number(w.avg_minutes),
            medianMinutes: Number(w.median_minutes),
            maxMinutes: Number(w.max_minutes),
            visitCount: Number(w.visit_count),
          }))}
          waitByDoctor={(waitByDoctor ?? []).map((w: any) => ({
            doctorName: w.doctor_name,
            avgWaitToDoctorMin: Number(w.avg_wait_to_doctor_min),
            avgConsultMin: Number(w.avg_consult_min),
            patientsSeen: Number(w.patients_seen),
          }))}
        />
      </div>
    )
  }

  // Non-admin roles keep the operational queue exactly as before.
  const { data: activeVisits, error } = await supabase
    .from('visits')
    .select('id, status, visit_reason, created_at, is_emergency, patients(id, full_name, patient_code)')
    .not('status', 'in', '(discharged,cancelled)')
    .order('created_at', { ascending: true })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count: seenTodayCount } = await supabase
    .from('visits')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'discharged')
    .gte('created_at', todayStart.toISOString())

  const waitingCount = (activeVisits ?? []).filter(v =>
    ['registered', 'triage', 'waiting_consultation', 'waiting_lab', 'waiting_pharmacy', 'billing'].includes(v.status)
  ).length

  const getHref = (visit: any) => {
    if (visit.status === 'triage') return `/visits/${visit.id}/triage`
    if (['waiting_consultation', 'in_consultation'].includes(visit.status)) return `/visits/${visit.id}/consultation`
    return visit.patients ? `/patients/${visit.patients.id}` : '#'
  }

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>
        {lang === 'fr' ? `Bonjour, ${staff.fullName}` : `Hello, ${staff.fullName}`}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        {staff.clinicName}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>
            {lang === 'fr' ? 'En attente' : 'Waiting'}
          </p>
          <p style={{ fontSize: '22px', fontWeight: 500, margin: 0 }}>{waitingCount}</p>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>
            {lang === 'fr' ? 'Vus aujourd\'hui' : 'Seen today'}
          </p>
          <p style={{ fontSize: '22px', fontWeight: 500, margin: 0 }}>{seenTodayCount ?? 0}</p>
        </div>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
        {lang === 'fr' ? 'File d\'attente' : 'Queue'}
      </p>

      {error && (
        <p style={{ color: 'var(--color-critical-text)', fontSize: '14px' }}>
          {lang === 'fr' ? 'Impossible de charger la file d\'attente.' : 'Could not load the queue.'}
        </p>
      )}

      {!error && (
        <QueueList
          visits={(activeVisits ?? []) as any}
          lang={lang}
          getHref={getHref}
          emptyMessage={lang === 'fr' ? 'Aucun patient en attente actuellement.' : 'No patients currently waiting.'}
        />
      )}
    </div>
  )
}
