// app/platform-admin/page.tsx
import { getCurrentPlatformAdmin } from '@/lib/platformAdmin/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { listClinicsForPlatformAdminAction } from '@/lib/actions/platformAdmin'
import PlatformAdminGate from '@/components/platformAdmin/PlatformAdminGate'
import PlatformAdminDashboard from '@/components/platformAdmin/PlatformAdminDashboard'

export default async function PlatformAdminPage() {
  const admin = await getCurrentPlatformAdmin()

  if (!admin) {
    // Distinguish "nobody has ever set up an admin account" (show the
    // one-time bootstrap form) from "admins exist, you're just not
    // signed in as one" (show the normal sign-in form) — checked here,
    // server-side, since it decides which client component to render.
    const adminClient = createAdminClient()
    const { count } = await adminClient.from('platform_admins').select('id', { count: 'exact', head: true })
    const needsBootstrap = (count ?? 0) === 0
    return <PlatformAdminGate needsBootstrap={needsBootstrap} />
  }

  const clinics = await listClinicsForPlatformAdminAction()
  return <PlatformAdminDashboard clinics={clinics} currentAdmin={admin} />
}
