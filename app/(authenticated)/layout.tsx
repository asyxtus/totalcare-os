// app/(authenticated)/layout.tsx
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import AppShell from '@/components/AppShell'

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff() // redirects to /login internally if not authenticated

  const initials = staff.fullName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <AppShell
      clinicName={staff.clinicName}
      staffName={staff.fullName}
      staffInitials={initials}
      staffRole={staff.role}
      lang={staff.preferredLanguage}
    >
      {children}
    </AppShell>
  )
}
