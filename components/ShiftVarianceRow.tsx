// components/ShiftVarianceRow.tsx
// Server wrapper: resolves the logged-in staff member and applies the
// segregation-of-duties rule before rendering the interactive review UI.

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
  const isAdmin = staff.role === 'admin'
  const isOwnShift = shift.staff_id === staff.staffId
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
