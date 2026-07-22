// app/(authenticated)/patients/new/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import NewPatientForm from '@/components/NewPatientForm'

export default async function NewPatientPage() {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data: insurers } = await supabase
    .from('insurers')
    .select('id, name, payer_type')
    .eq('clinic_id', staff.clinicId)
    .eq('is_active', true)
    .order('name')

  return <NewPatientForm insurers={insurers ?? []} />
}
