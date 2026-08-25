import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import OwnerFinancialDashboard from '@/components/OwnerFinancialDashboard'
import ImagingRevenueCard from '@/components/ImagingRevenueCard'

function doualaDateString(daysAgo = 0) {
  const d = new Date()
  d.setUTCHours(d.getUTCHours() + 1)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

type RevenueRow = {
  report_date: string
  revenue_xaf: number | string | null
  transaction_count: number | string | null
}

type MethodRow = {
  method: string
  total_xaf: number | string | null
  transaction_count: number | string | null
}

type CashierRow = {
  staff_id: string
  staff_name: string
  total_xaf: number | string | null
  cash_xaf: number | string | null
  transaction_count: number | string | null
}

type CategoryRow = {
  category: string
  total_xaf: number | string | null
}

type ShiftRow = {
  id: string
  staff_id: string
  variance_xaf: number | string | null
  expected_cash_xaf: number | string | null
  closing_cash_xaf: number | string | null
  closed_at: string | null
}

type SaleRow = {
  id: string
  created_at: string
  payment_method: string
  total_amount_xaf: number | string | null
  sold_by: string
}

type ImagingRow = {
  ordered_at: string
  charge_amount_xaf: number | string | null
  charge_balance_xaf: number | string | null
  charge_status: string | null
}

export default async function FinancialPage() {
  const staff = await getCurrentStaff()
  if (staff.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const today = doualaDateString()

  const [
    revenueResult,
    methodsResult,
    cashiersResult,
    categoriesResult,
    outstandingResult,
    complianceResult,
    reconciliationResult,
    shiftsResult,
    salesResult,
    imagingResult,
  ] = await Promise.all([
    supabase.rpc('clinic_daily_revenue', {
      p_clinic_id: staff.clinicId,
      p_days: 30,
    }),
    supabase.rpc('eod_revenue_by_method', {
      p_clinic_id: staff.clinicId,
      p_date: today,
    }),
    supabase.rpc('eod_revenue_by_cashier', {
      p_clinic_id: staff.clinicId,
      p_date: today,
    }),
    supabase.rpc('eod_revenue_by_category', {
      p_clinic_id: staff.clinicId,
      p_date: today,
    }),
    supabase.rpc('outstanding_balance_summary', {
      p_clinic_id: staff.clinicId,
    }),
    supabase.rpc('compliance_pending_summary', {
      p_clinic_id: staff.clinicId,
    }),
    supabase
      .from('pos_daily_reconciliations')
      .select(
        'reconciliation_date,cash_counted_xaf,momo_counted_xaf,orange_money_counted_xaf,notes,reconciled_at',
      )
      .eq('clinic_id', staff.clinicId)
      .eq('reconciliation_date', today)
      .maybeSingle(),
    supabase
      .from('cashier_shifts')
      .select(
        'id,staff_id,variance_xaf,expected_cash_xaf,closing_cash_xaf,closed_at',
      )
      .eq('clinic_id', staff.clinicId)
      .eq('status', 'closed')
      .eq('requires_review', true)
      .order('closed_at', { ascending: false })
      .limit(10),
    supabase
      .from('pos_sales')
      .select('id,created_at,payment_method,total_amount_xaf,sold_by')
      .eq('clinic_id', staff.clinicId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('imaging_work_queue')
      .select(
        'ordered_at,charge_amount_xaf,charge_balance_xaf,charge_status',
      )
      .eq('clinic_id', staff.clinicId)
      .not('charge_amount_xaf', 'is', null)
      .order('ordered_at', { ascending: true }),
  ])

  const outstanding = outstandingResult.data?.[0]
  const compliance = complianceResult.data?.[0]
  const shifts = (shiftsResult.data ?? []) as ShiftRow[]
  const sales = (salesResult.data ?? []) as SaleRow[]
  const revenueRows = (revenueResult.data ?? []) as RevenueRow[]
  const methodRows = (methodsResult.data ?? []) as MethodRow[]
  const cashierRows = (cashiersResult.data ?? []) as CashierRow[]
  const categoryRows = (categoriesResult.data ?? []) as CategoryRow[]
  const imagingResultRows = (imagingResult.data ?? []) as ImagingRow[]

  const staffIds = [
    ...new Set(
      [...shifts.map(row => row.staff_id), ...sales.map(row => row.sold_by)].filter(
        Boolean,
      ),
    ),
  ]

  const { data: staffRows } = staffIds.length
    ? await supabase.from('staff').select('id,full_name').in('id', staffIds)
    : { data: [] as Array<{ id: string; full_name: string }> }

  const staffNames = new Map(
    (staffRows ?? []).map(row => [row.id, row.full_name]),
  )

  const expectedByMethod: Record<string, number> = {}
  for (const row of methodRows) {
    expectedByMethod[row.method] = Number(row.total_xaf || 0)
  }

  const imagingMap = new Map<
    string,
    { billed_xaf: number; collected_xaf: number; exams: number }
  >()

  for (const row of imagingResultRows) {
    const date = String(row.ordered_at).slice(0, 10)
    const current =
      imagingMap.get(date) ?? {
        billed_xaf: 0,
        collected_xaf: 0,
        exams: 0,
      }

    if (row.charge_status !== 'reversed') {
      current.billed_xaf += Number(row.charge_amount_xaf || 0)
      current.collected_xaf += Math.max(
        0,
        Number(row.charge_amount_xaf || 0) -
          Number(row.charge_balance_xaf || 0),
      )
      current.exams += 1
    }

    imagingMap.set(date, current)
  }

  const imagingRows = [...imagingMap.entries()]
    .slice(-30)
    .map(([date, value]) => ({
      date,
      billed_xaf: value.billed_xaf,
      collected_xaf: value.collected_xaf,
      exams: value.exams,
    }))

  return (
    <div>
      <OwnerFinancialDashboard
        lang={staff.preferredLanguage}
        revenue30={revenueRows
          .map(row => ({
            report_date: row.report_date,
            revenue_xaf: Number(row.revenue_xaf || 0),
            transaction_count: Number(row.transaction_count || 0),
          }))
          .reverse()}
        todayMethods={methodRows.map(row => ({
          method: row.method,
          total_xaf: Number(row.total_xaf || 0),
          transaction_count: Number(row.transaction_count || 0),
        }))}
        todayCashiers={cashierRows.map(row => ({
          staff_id: row.staff_id,
          staff_name: row.staff_name,
          total_xaf: Number(row.total_xaf || 0),
          cash_xaf: Number(row.cash_xaf || 0),
          transaction_count: Number(row.transaction_count || 0),
        }))}
        todayCategories={categoryRows.map(row => ({
          category: row.category,
          total_xaf: Number(row.total_xaf || 0),
        }))}
        recentSales={sales.map(row => ({
          id: row.id,
          created_at: row.created_at,
          payment_method: row.payment_method,
          total_amount_xaf: Number(row.total_amount_xaf || 0),
          sold_by_name: staffNames.get(row.sold_by) ?? '—',
        }))}
        variances={shifts.map(row => ({
          id: row.id,
          staff_name: staffNames.get(row.staff_id) ?? '—',
          variance_xaf: Number(row.variance_xaf || 0),
          expected_cash_xaf: Number(row.expected_cash_xaf || 0),
          closing_cash_xaf: Number(row.closing_cash_xaf || 0),
          closed_at: row.closed_at,
        }))}
        reconciliation={
          reconciliationResult.data
            ? {
                reconciliation_date: reconciliationResult.data.reconciliation_date,
                cash_counted_xaf: Number(
                  reconciliationResult.data.cash_counted_xaf || 0,
                ),
                momo_counted_xaf: Number(
                  reconciliationResult.data.momo_counted_xaf || 0,
                ),
                orange_money_counted_xaf: Number(
                  reconciliationResult.data.orange_money_counted_xaf || 0,
                ),
                notes: reconciliationResult.data.notes,
                reconciled_at: reconciliationResult.data.reconciled_at,
              }
            : null
        }
        todayExpectedByMethod={expectedByMethod}
        outstandingXaf={Number(outstanding?.total_outstanding_xaf || 0)}
        overdueXaf={Number(outstanding?.overdue_outstanding_xaf || 0)}
        unpaidChargeCount={Number(outstanding?.unpaid_charge_count || 0)}
        pendingShiftReviews={Number(
          compliance?.pending_shift_variance_reviews || 0,
        )}
      />
      <ImagingRevenueCard
        rows={imagingRows}
        lang={staff.preferredLanguage}
      />
    </div>
  )
}
