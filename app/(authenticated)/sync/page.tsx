// app/(authenticated)/sync/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import OfflineSyncCenter from '@/components/OfflineSyncCenter'

export default async function OfflineSyncPage() {
  const staff = await getCurrentStaff()
  if (!['admin', 'doctor', 'nurse', 'receptionist', 'billing_clerk', 'auditor'].includes(staff.role)) {
    redirect('/dashboard')
  }

  return <OfflineSyncCenter lang={staff.preferredLanguage} />
}
