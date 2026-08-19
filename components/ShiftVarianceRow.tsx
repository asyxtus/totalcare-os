// components/ShiftVarianceRow.tsx
// Server wrapper: resolves the logged-in staff member and applies the
// segregation-of-duties rule before rendering the interactive review UI.

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import ShiftVarianceReviewClient from './ShiftVarianceReviewClient'

interface Shift {
  id: string
  staff_name: string
  staff_id?: string
  opening_cash_xaf: number
  closing_cash_xaf: number
  expected_cash_xaf: number
  variance_xaf: number
  closed_at: string
  notes: string | null
}

export default async function ShiftVarianceRow({ shift }: { shift: Shift }) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  // The billing page historically passed only display fields into this
  // component. Resolve the authoritative cashier ID here so the UI can
  // enforce the same segregation-of-duties rule as the database RPC.
  const { data: shiftRecord } = await supabase
    .from('cashier_shifts')
    .select('staff_id')
    .eq('id', shift.id)
    .eq('clinic_id', staff.clinicId)
    .maybeSingle()

  const cashierStaffId = shiftRecord?.staff_id ?? shift.staff_id ?? null
  const isAdmin = staff.role === 'admin'
  const isOwnShift = cashierStaffId === staff.staffId
  const canReview = isAdmin && !isOwnShift

  return (
    <ShiftVarianceReviewClient
      shift={shift}
      canReview={canReview}
      isOwnShift={isOwnShift}
      isAdmin={isAdmin}
    />
  )
}
