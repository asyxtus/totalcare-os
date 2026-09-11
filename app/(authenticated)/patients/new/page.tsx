// app/(authenticated)/patients/new/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import OfflineNewPatientForm from '@/components/OfflineNewPatientForm'

export default async function NewPatientPage() {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data: insurers } = await supabase
    .from('insurers')
    .select('id, name, payer_type')
    .eq('clinic_id', staff.clinicId)
    .eq('is_active', true)
    .order('name')

  return <OfflineNewPatientForm insurers={insurers ?? []} clinicId={staff.clinicId} staffId={staff.staffId} />
}
