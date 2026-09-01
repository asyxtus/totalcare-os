'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function friendlyError(label: string, generic: string, err: { message?: string } | null) {
  console.error(`${label} failed:`, err)
  const detail = process.env.NODE_ENV !== 'production' && err?.message ? ` (${err.message})` : ''
  return { error: `${generic}${detail}` }
}

export async function markSampleCollected(itemId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.rpc('mark_sample_collected', {
    p_lab_order_item_id: itemId,
    p_staff_id: staff.staffId,
  })

  if (error) return friendlyError('mark_sample_collected', 'Impossible de marquer le prélèvement.', error)

  await supabase.from('audit_log').insert({
    clinic_id: staff.clinicId,
    staff_id: staff.staffId,
    action: 'laboratory.sample_collected',
    entity_type: 'lab_order_item',
    entity_id: itemId,
    details: { performed_by: staff.staffId },
  })

  revalidatePath(`/laboratory/${itemId}`)
  revalidatePath('/laboratory')
  return { success: true }
}

export async function saveResultsAndComplete(
  itemId: string,
  clinicId: string,
  formData: FormData
) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const testIds = formData.getAll('result_test_id') as string[]
  const numericValues = formData.getAll('result_numeric_value') as string[]
  const qualitativeValues = formData.getAll('result_qualitative_value') as string[]

  for (let i = 0; i < testIds.length; i++) {
    const testId = testIds[i]
    const numericValue = numericValues[i]
    const qualitativeValue = qualitativeValues[i]

    if (!numericValue && !qualitativeValue) continue

    const { data: existing } = await supabase
      .from('lab_results')
      .select('id')
      .eq('lab_order_item_id', itemId)
      .eq('lab_test_catalog_id', testId)
      .maybeSingle()

    const payload = {
      clinic_id: clinicId,
      lab_order_item_id: itemId,
      lab_test_catalog_id: testId,
      numeric_value: numericValue ? parseFloat(numericValue) : null,
      qualitative_value: qualitativeValue || null,
      recorded_by: staff.staffId,
    }

    const { error } = existing
      ? await supabase.from('lab_results').update(payload).eq('id', existing.id)
      : await supabase.from('lab_results').insert(payload)

    if (error) {
      return friendlyError('saveResultsAndComplete', 'Impossible d\'enregistrer un résultat. Réessayez.', error)
    }
  }

  const { error: completeError } = await supabase.rpc('complete_lab_order_item', {
    p_lab_order_item_id: itemId,
    p_staff_id: staff.staffId,
  })

  if (completeError) {
    return friendlyError('complete_lab_order_item', 'Résultats enregistrés, mais impossible de terminer cet examen.', completeError)
  }

  await supabase.from('audit_log').insert({
    clinic_id: staff.clinicId,
    staff_id: staff.staffId,
    action: 'laboratory.item_performed',
    entity_type: 'lab_order_item',
    entity_id: itemId,
    details: { performed_by: staff.staffId, result_count: testIds.length },
  })

  redirect('/laboratory')
}

export async function completeViaAttachment(itemId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.rpc('complete_lab_order_item', {
    p_lab_order_item_id: itemId,
    p_staff_id: staff.staffId,
  })

  if (error) return friendlyError('completeViaAttachment', 'Impossible de terminer cet examen.', error)

  await supabase.from('audit_log').insert({
    clinic_id: staff.clinicId,
    staff_id: staff.staffId,
    action: 'laboratory.item_performed',
    entity_type: 'lab_order_item',
    entity_id: itemId,
    details: { performed_by: staff.staffId, completion_method: 'attachment' },
  })

  revalidatePath(`/laboratory/${itemId}`)
  revalidatePath('/laboratory')
  return { success: true }
}

export async function recordAttachment(itemId: string, clinicId: string, filePath: string, fileType: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.from('lab_result_attachments').insert({
    clinic_id: clinicId,
    lab_order_item_id: itemId,
    file_path: filePath,
    file_type: fileType,
    uploaded_by: staff.staffId,
  })

  if (error) return friendlyError('recordAttachment', 'Le fichier a été téléversé, mais n\'a pas pu être enregistré.', error)

  await supabase.from('audit_log').insert({
    clinic_id: staff.clinicId,
    staff_id: staff.staffId,
    action: 'laboratory.result_attachment_uploaded',
    entity_type: 'lab_order_item',
    entity_id: itemId,
    details: { file_type: fileType, file_path: filePath },
  })

  revalidatePath(`/laboratory/${itemId}`)
  return { success: true }
}

export async function verifyResult(resultId: string, itemId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { error } = await supabase.rpc('verify_lab_result', {
    p_lab_result_id: resultId,
    p_verified_by: staff.staffId,
  })

  if (error) return friendlyError('verify_lab_result', 'Impossible de valider ce résultat.', error)

  await supabase.from('audit_log').insert({
    clinic_id: staff.clinicId,
    staff_id: staff.staffId,
    action: 'laboratory.result_verified',
    entity_type: 'lab_result',
    entity_id: resultId,
    details: { lab_order_item_id: itemId, verified_by: staff.staffId },
  })

  revalidatePath(`/laboratory/${itemId}`)
  return { success: true }
}
