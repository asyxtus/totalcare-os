// app/platform-admin/page.tsx
import { isPlatformAdminUnlocked } from '@/lib/platformAdmin/session'
import { listClinicsForPlatformAdminAction } from '@/lib/actions/platformAdmin'
import PlatformAdminGate from '@/components/platformAdmin/PlatformAdminGate'
import PlatformAdminDashboard from '@/components/platformAdmin/PlatformAdminDashboard'

export default async function PlatformAdminPage() {
  const unlocked = await isPlatformAdminUnlocked()
  if (!unlocked) return <PlatformAdminGate />

  const clinics = await listClinicsForPlatformAdminAction()
  return <PlatformAdminDashboard clinics={clinics} />
}
