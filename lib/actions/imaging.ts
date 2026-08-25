'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

function err(label: string, fallback: string, e: { message?: string } | null) {
  console.error(`${label} failed:`, e)
  return { error: process.env.NODE_ENV !== 'production' && e?.message ? `${fallback} (${e.message})` : fallback }
}

export async function searchPatientsForDirectImaging(query: string) {
  const staff = await getCurrentStaff()
  const q = query.trim()
  if (q.length < 2) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, patient_code, phone')
    .eq('clinic_id', staff.clinicId)
    .or(`full_name.ilike.%${q}%,patient_code.ilike.%${q}%,phone.ilike.%${q}%`)
    .order('full_name').limit(12)
  if (error) return []
  return data ?? []
}

export async function createDirectImagingVisit(
  patientId: string,
  items: string[],
  indication?: string,
  reason?: string,
) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  if (!patientId) return { error: 'Patient requis / Patient is required.' }
  if (!items.length) return { error: 'Sélectionnez au moins un examen. / Select at least one imaging examination.' }
  const { data, error: rpcError } = await supabase.rpc('create_direct_imaging_visit', {
    p_clinic_id: staff.clinicId,
    p_patient_id: patientId,
    p_registered_by: staff.staffId,
    p_items: items.map((imaging_catalog_id) => ({ imaging_catalog_id })),
    p_clinical_indication: indication?.trim() || null,
    p_reason: reason?.trim() || null,
  })
  if (rpcError) return err('create_direct_imaging_visit', 'Impossible de créer la visite d’imagerie.', rpcError)
  const row = Array.isArray(data) ? data[0] : data
  revalidatePath('/reception')
  revalidatePath('/imaging')
  revalidatePath('/billing')
  revalidatePath('/financial')
  return { success: true, visitId: row?.visit_id, imagingOrderId: row?.imaging_order_id, invoiceId: row?.invoice_id, totalAmountXaf: Number(row?.total_amount_xaf ?? 0) }
}

export async function startImagingItem(itemId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  if (!['admin', 'doctor', 'lab_technician'].includes(staff.role)) return { error: 'Accès réservé au personnel autorisé.' }
  const { data: item, error: readError } = await supabase
    .from('imaging_order_items').select('id, clinic_id, imaging_order_id, status').eq('id', itemId).eq('clinic_id', staff.clinicId).maybeSingle()
  if (readError || !item) return err('startImagingItem', 'Examen introuvable.', readError)
  if (item.status !== 'paid' && item.status !== 'waiting') return { error: 'L’examen doit être payé avant de commencer.' }
  const { error } = await supabase.from('imaging_order_items').update({ status: 'in_progress', performed_by: staff.staffId, performed_at: new Date().toISOString() }).eq('id', itemId).eq('clinic_id', staff.clinicId)
  if (error) return err('startImagingItem', 'Impossible de démarrer cet examen.', error)
  await supabase.from('imaging_orders').update({ status: 'in_progress' }).eq('id', item.imaging_order_id).eq('clinic_id', staff.clinicId).in('status', ['paid', 'waiting'])
  revalidatePath('/imaging')
  return { success: true }
}

export async function completeImagingItem(itemId: string, reportText: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  if (!['admin', 'doctor', 'lab_technician'].includes(staff.role)) return { error: 'Accès réservé au personnel autorisé.' }
  if (!reportText.trim()) return { error: 'Un compte rendu est obligatoire.' }
  const { error } = await supabase.rpc('complete_imaging_order_item', { p_imaging_order_item_id: itemId, p_staff_id: staff.staffId, p_report_text: reportText.trim() })
  if (error) return err('completeImagingItem', 'Impossible de terminer cet examen.', error)
  revalidatePath('/imaging')
  revalidatePath('/financial')
  return { success: true }
}

export async function markImagingOrderPaid(orderId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_imaging_order_paid', { p_imaging_order_id: orderId, p_staff_id: staff.staffId })
  if (error) return err('markImagingOrderPaid', 'Impossible de synchroniser le statut de paiement.', error)
  revalidatePath('/imaging')
  revalidatePath('/billing')
  return { success: true }
}
