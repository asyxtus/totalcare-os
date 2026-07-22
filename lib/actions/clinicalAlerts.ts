// lib/actions/clinicalAlerts.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

export async function acknowledgeCriticalResultAction(resultId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.rpc('acknowledge_critical_result', {
    p_clinic_id: staff.clinicId,
    p_result_id: resultId,
    p_acknowledged_by: staff.staffId,
  })

  if (error) return friendlyError('acknowledge_critical_result', 'Impossible de confirmer la prise en compte de ce résultat.', error)

  revalidatePath('/clinical-alerts')
  revalidatePath('/admissions')
  return { success: true }
}
