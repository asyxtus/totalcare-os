// app/(authenticated)/pharmacy/prescriptions/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import PrescriptionDispenseDetail from '@/components/PrescriptionDispenseDetail'

export default async function PrescriptionDispensePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data: prescription, error } = await supabase
    .from('prescriptions')
    .select(`
      id, status, requires_review, doctor_id,
      visits(patients(id, full_name, patient_code, allergies))
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !prescription) notFound()

  const patient = (prescription.visits as any)?.patients

  // prescriptions has TWO foreign keys to staff (doctor_id AND
  // reviewed_by), which makes a nested staff(...) join genuinely
  // ambiguous to Supabase — resolving the name via a separate query.
  let prescribingDoctorName = '—'
  if (prescription.doctor_id) {
    const { data: doctorRow } = await supabase.from('staff').select('full_name').eq('id', prescription.doctor_id).maybeSingle()
    prescribingDoctorName = doctorRow?.full_name ?? '—'
  }

  const { data: itemsRaw } = await supabase
    .from('prescription_items')
    .select(`
      id, product_id, drug_name_freetext, dose, frequency, duration_days,
      quantity_prescribed, quantity_dispensed,
      products(name, sale_price_xaf, drug_classes(is_controlled))
    `)
    .eq('prescription_id', id)

  const productIds = (itemsRaw ?? []).map((it: any) => it.product_id).filter(Boolean)
  const { data: stockRows } = productIds.length > 0
    ? await supabase.rpc('get_products_with_stock', { p_clinic_id: staff.clinicId })
    : { data: [] }
  const stockByProductId = new Map<string, number>((stockRows ?? []).map((r: any) => [r.product_id, r.on_hand]))

  // For each prescription item, find ALL products in this clinic that
  // share the same drug name — so pharmacist can pick the right dosage.
  // e.g. doctor prescribed "Amoxicillin" but pharmacy has 250mg AND 500mg.
  const drugNames = (itemsRaw ?? [])
    .map((it: any) => it.products?.name ?? null)
    .filter(Boolean) as string[]

  const alternativesByName = new Map<string, any[]>()
  if (drugNames.length > 0 && stockRows) {
    for (const name of [...new Set(drugNames)]) {
      // Match products whose name starts with the same word (INN match)
      const baseName = name.split(' ')[0].toLowerCase()
      const matches = (stockRows as any[]).filter((r: any) =>
        r.name.toLowerCase().startsWith(baseName) && r.on_hand > 0
      )
      if (matches.length > 0) alternativesByName.set(name, matches)
    }
  }

  const { data: activeStaff } = await supabase
    .from('staff')
    .select('id, full_name')
    .eq('is_active', true)
    .neq('id', staff.staffId)

  const items = (itemsRaw ?? []).map((item: any) => ({
    id: item.id,
    product_id: item.product_id,
    drug_name_freetext: item.drug_name_freetext,
    dose: item.dose,
    frequency: item.frequency,
    duration_days: item.duration_days,
    quantity_prescribed: item.quantity_prescribed,
    quantity_dispensed: item.quantity_dispensed,
    product_name: item.products?.name ?? null,
    sale_price_xaf: item.products?.sale_price_xaf ?? null,
    is_controlled: item.products?.drug_classes?.is_controlled ?? false,
    on_hand: item.product_id ? stockByProductId.get(item.product_id) : undefined,
    alternatives: item.products?.name ? (alternativesByName.get(item.products.name) ?? []) : [],
  }))

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <Link href="/pharmacy/dispensing" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
      </div>

      <PrescriptionDispenseDetail
        prescription={{
          id: prescription.id,
          requires_review: prescription.requires_review,
          patient_name: patient?.full_name ?? '—',
          patient_code: patient?.patient_code ?? '—',
          allergies: patient?.allergies ?? null,
          prescribing_doctor_name: prescribingDoctorName,
        }}
        items={items}
        staffOptions={activeStaff ?? []}
        currentStaffRole={staff.role}
      />
    </div>
  )
}
