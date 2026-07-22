// app/(authenticated)/appointments/page.tsx
// Folded into the Reception hub (Reception + Appointments now share one
// screen, two tabs) — kept as a redirect for old links/bookmarks.
import { redirect } from 'next/navigation'

export default async function AppointmentsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date } = await searchParams
  redirect(date ? `/reception?tab=appointments&date=${date}` : '/reception?tab=appointments')
}
