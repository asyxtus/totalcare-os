// app/(authenticated)/admin/staff/page.tsx
// Folded into the unified Admin hub — kept as a redirect for old links/bookmarks.
import { redirect } from 'next/navigation'

export default function StaffAdminRedirect() {
  redirect('/admin')
}
