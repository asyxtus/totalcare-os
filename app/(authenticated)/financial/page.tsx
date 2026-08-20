import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import OwnerFinancialDashboard from '@/components/OwnerFinancialDashboard'

function doualaDateString(daysAgo = 0): string {
  const d = new Date()
  d.setUTCHours(d.getUTCHours() + 1)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
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
  ] = await Promise.all([
    supabase.rpc('clinic_daily_revenue', { p_clinic_id: staff.clinicId, p_days: 30 }),
    supabase.rpc('eod_revenue_by_method', { p_clinic_id: staff.clinicId, p_date: today }),
    supabase.rpc('eod_revenue_by_cashier', { p_clinic_id: staff.clinicId, p_date: today }),
    supabase.rpc('eod_revenue_by_category', { p_clinic_id: staff.clinicId, p_date: today }),
    supabase.rpc('outstanding_balance_summary', { p_clinic_id: staff.clinicId }),
    supabase.rpc('compliance_pending_summary', { p_clinic_id: staff.clinicId }),
    supabase.from('pos_daily_reconciliations').select('reconciliation_date,cash_counted_xaf,momo_counted_xaf,orange_money_counted_xaf,notes,reconciled_at').eq('clinic_id', staff.clinicId).eq('reconciliation_date', today).maybeSingle(),
    supabase.from('cashier_shifts').select('id,staff_id,variance_xaf,expected_cash_xaf,closing_cash_xaf,closed_at').eq('clinic_id', staff.clinicId).eq('status', 'closed').eq('requires_review', true).order('closed_at', { ascending: false }).limit(10),
    supabase.from('pos_sales').select('id,created_at,payment_method,total_amount_xaf,sold_by').eq('clinic_id', staff.clinicId).eq('status', 'completed').order('created_at', { ascending: false }).limit(15),
  ])

  const outstanding = outstandingResult.data?.[0]
  const compliance = complianceResult.data?.[0]
  const shifts = shiftsResult.data ?? []
  const sales = salesResult.data ?? []

  const staffIds = [...new Set([
    ...shifts.map((row: any) => row.staff_id),
    ...sales.map((row: any) => row.sold_by),
  ].filter(Boolean))]

  const { data: staffRows } = staffIds.length > 0
    ? await supabase.from('staff').select('id,full_name').in('id', staffIds)
    : { data: [] as any[] }

  const staffNames = new Map((staffRows ?? []).map((row: any) => [row.id, row.full_name]))

  const expectedByMethod: Record<string, number> = {}
  for (const row of methodsResult.data ?? []) expectedByMethod[row.method] = Number(row.total_xaf || 0)

  return (
    <OwnerFinancialDashboard
      lang={staff.preferredLanguage}
      revenue30={(revenueResult.data ?? []).map((row: any) => ({
        report_date: row.report_date,
        revenue_xaf: Number(row.revenue_xaf || 0),
        transaction_count: Number(row.transaction_count || 0),
      })).reverse()}
      todayMethods={(methodsResult.data ?? []).map((row: any) => ({
        method: row.method,
        total_xaf: Number(row.total_xaf || 0),
        transaction_count: Number(row.transaction_count || 0),
      }))}
      todayCashiers={(cashiersResult.data ?? []).map((row: any) => ({
        staff_id: row.staff_id,
        staff_name: row.staff_name,
        total_xaf: Number(row.total_xaf || 0),
        cash_xaf: Number(row.cash_xaf || 0),
        transaction_count: Number(row.transaction_count || 0),
      }))}
      todayCategories={(categoriesResult.data ?? []).map((row: any) => ({
        category: row.category,
        total_xaf: Number(row.total_xaf || 0),
      }))}
      recentSales={sales.map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        payment_method: row.payment_method,
        total_amount_xaf: Number(row.total_amount_xaf || 0),
        sold_by_name: staffNames.get(row.sold_by) ?? '—',
      }))}
      variances={shifts.map((row: any) => ({
        id: row.id,
        staff_name: staffNames.get(row.staff_id) ?? '—',
        variance_xaf: Number(row.variance_xaf || 0),
        expected_cash_xaf: Number(row.expected_cash_xaf || 0),
        closing_cash_xaf: Number(row.closing_cash_xaf || 0),
        closed_at: row.closed_at,
      }))}
      reconciliation={reconciliationResult.data ? {
        reconciliation_date: reconciliationResult.data.reconciliation_date,
        cash_counted_xaf: Number(reconciliationResult.data.cash_counted_xaf || 0),
        momo_counted_xaf: Number(reconciliationResult.data.momo_counted_xaf || 0),
        orange_money_counted_xaf: Number(reconciliationResult.data.orange_money_counted_xaf || 0),
        notes: reconciliationResult.data.notes,
        reconciled_at: reconciliationResult.data.reconciled_at,
      } : null}
      todayExpectedByMethod={expectedByMethod}
      outstandingXaf={Number(outstanding?.total_outstanding_xaf || 0)}
      overdueXaf={Number(outstanding?.overdue_outstanding_xaf || 0)}
      unpaidChargeCount={Number(outstanding?.unpaid_charge_count || 0)}
      pendingShiftReviews={Number(compliance?.pending_shift_variance_reviews || 0)}
    />
  )
}
