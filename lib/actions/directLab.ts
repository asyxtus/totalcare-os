'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

export async function searchPatientsForDirectLab(query: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const q = query.trim()

  if (q.length < 2) return []

  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, patient_code, phone')
    .eq('clinic_id', staff.clinicId)
    .or(`full_name.ilike.%${q}%,patient_code.ilike.%${q}%,phone.ilike.%${q}%`)
    .order('full_name', { ascending: true })
    .limit(12)

  if (error) {
    console.error('searchPatientsForDirectLab failed:', error)
    return []
  }

  return data ?? []
}

export async function createDirectLabVisit(
  patientId: string,
  items: Array<{ type: 'individual_test' | 'panel'; catalog_id?: string; panel_id?: string }>,
  reason?: string,
) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  if (!patientId) return { error: 'Patient requis / Patient is required.' }
  if (!items.length) return { error: 'Sélectionnez au moins un examen. / Select at least one test.' }

  const { data, error } = await supabase.rpc('create_direct_lab_visit', {
    p_clinic_id: staff.clinicId,
    p_patient_id: patientId,
    p_registered_by: staff.staffId,
    p_items: items,
    p_reason: reason?.trim() || null,
  })

  if (error) {
    console.error('create_direct_lab_visit failed:', error)
    const message = error.message || 'Impossible de créer la visite de laboratoire.'
    return { error: message }
  }

  const row = Array.isArray(data) ? data[0] : data
  revalidatePath('/reception')
  revalidatePath('/laboratory')
  revalidatePath('/billing')

  return {
    success: true,
    visitId: row?.visit_id,
    labOrderId: row?.lab_order_id,
    invoiceId: row?.invoice_id,
    totalAmountXaf: Number(row?.total_amount_xaf ?? 0),
  }
}
