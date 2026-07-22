// lib/actions/transfer.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

export async function transferPatientToDoctor(visitId: string, formData: FormData) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const newDoctorId = formData.get('new_doctor_id') as string
  if (!newDoctorId) {
    return { error: 'Sélectionnez un médecin.' }
  }

  const { error } = await supabase.rpc('transfer_patient_to_doctor', {
    p_visit_id: visitId,
    p_new_doctor_id: newDoctorId,
    p_staff_id: staff.staffId,
  })

  if (error) {
    console.error('transfer_patient_to_doctor failed:', error)
    const detail = process.env.NODE_ENV !== 'production' ? ` (${error.message})` : ''
    return { error: `Impossible de transférer ce patient.${detail}` }
  }

  revalidatePath('/doctor')
  revalidatePath('/dashboard')
  return { success: true }
}
