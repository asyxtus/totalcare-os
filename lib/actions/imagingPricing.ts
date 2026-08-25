'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { revalidatePath } from 'next/cache'

export async function createImagingCatalogAction(formData: FormData) {
  const staff = await getCurrentStaff()
  if (staff.role !== 'admin') return { error: 'Réservé aux administrateurs.' }
  const supabase = await createClient()
  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const nameEn = String(formData.get('name_en') ?? '').trim()
  const nameFr = String(formData.get('name_fr') ?? '').trim()
  const modality = String(formData.get('modality') ?? '').trim()
  const price = Number(formData.get('price_xaf'))
  const turnaround = Number(formData.get('turnaround_minutes'))
  if (!code || !nameEn || !nameFr || !modality) return { error: 'Code, noms et modalité sont obligatoires.' }
  if (!Number.isFinite(price) || price < 0) return { error: 'Prix invalide.' }
  const { data, error } = await supabase.rpc('create_imaging_catalog_item', {
    p_clinic_id: staff.clinicId, p_created_by: staff.staffId, p_code: code, p_name_en: nameEn, p_name_fr: nameFr,
    p_modality: modality, p_price_xaf: price, p_turnaround_minutes: Number.isFinite(turnaround) && turnaround > 0 ? turnaround : null,
    p_preparation_instructions: String(formData.get('preparation_instructions') ?? '').trim() || null,
    p_clinical_notes: String(formData.get('clinical_notes') ?? '').trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true, id: data }
}

export async function updateImagingPriceAction(id: string, priceXaf: number) {
  const staff = await getCurrentStaff()
  if (staff.role !== 'admin') return { error: 'Réservé aux administrateurs.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_imaging_catalog_price', { p_id: id, p_updated_by: staff.staffId, p_price_xaf: priceXaf })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/reception')
  return { success: true }
}

export async function toggleImagingActiveAction(id: string, makeActive: boolean) {
  const staff = await getCurrentStaff()
  if (staff.role !== 'admin') return { error: 'Réservé aux administrateurs.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('toggle_imaging_catalog_active', { p_id: id, p_updated_by: staff.staffId, p_make_active: makeActive })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/reception')
  return { success: true }
}
