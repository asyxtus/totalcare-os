// app/(authenticated)/pharmacy/dispensing/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'
import DispensingMasterDetail from '@/components/DispensingMasterDetail'

export default async function DispensingPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  // Full detail for every pending + review-queue prescription, fetched
  // upfront — this is what makes the master-detail panel instant with
  // no per-click navigation or fetch.
  const { data: allPrescriptions } = await supabase
    .from('prescriptions')
    .select(`
      id, status, requires_review, doctor_id,
      visits(patients(id, full_name, patient_code, allergies)),
      prescription_items(
        id, product_id, drug_name_freetext, dose, frequency, duration_days,
        quantity_prescribed, quantity_dispensed,
        products(name, sale_price_xaf, drug_classes(is_controlled))
      )
    `)
    .in('status', ['pending', 'partially_dispensed'])
    .order('created_at', { ascending: true })

  // prescriptions has two FKs to staff (doctor_id, reviewed_by) — bulk
  // resolve every prescribing doctor's name in one query rather than
  // guessing at a nested join.
  const doctorIds = [...new Set((allPrescriptions ?? []).map((rx: any) => rx.doctor_id).filter(Boolean))]
  const { data: doctorRows } = doctorIds.length > 0
    ? await supabase.from('staff').select('id, full_name').in('id', doctorIds)
    : { data: [] }
  const doctorNameById = new Map((doctorRows ?? []).map((s) => [s.id, s.full_name]))

  const { data: stockRows } = await supabase.rpc('get_products_with_stock', { p_clinic_id: staff.clinicId })
  const stockByProductId = new Map<string, number>((stockRows ?? []).map((r: any) => [r.product_id, r.on_hand]))

  const { data: activeStaff } = await supabase
    .from('staff')
    .select('id, full_name')
    .eq('is_active', true)
    .neq('id', staff.staffId)

  const queuePrescriptions = (allPrescriptions ?? []).map((rx: any) => {
    const patient = rx.visits?.patients
    return {
      id: rx.id,
      requires_review: rx.requires_review,
      status: rx.status,
      patient_name: patient?.full_name ?? '—',
      patient_code: patient?.patient_code ?? '—',
      allergies: patient?.allergies ?? null,
      prescribing_doctor_name: doctorNameById.get(rx.doctor_id) ?? '—',
      items: (rx.prescription_items ?? []).map((item: any) => ({
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
      })),
    }
  })

  // "Dispensed today" and "Total items" — real workload metrics.
  const todayStart = new Date()
  todayStart.setUTCHours(-1, 0, 0, 0) // approximate WAT midnight in UTC terms

  const { count: dispensedTodayCount } = await supabase
    .from('dispensing_records')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', staff.clinicId)
    .gte('dispensed_at', todayStart.toISOString())

  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', staff.clinicId)
    .eq('is_active', true)

  const totalPendingItems = queuePrescriptions
    .flatMap((rx) => rx.items)
    .filter((it) => it.quantity_dispensed < it.quantity_prescribed).length

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <a href="/pharmacy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</a>
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Pharmacie' : 'Pharmacy'}</span>
      </div>{lang === 'fr' ? 'Dispensation' : 'Dispensing'}</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        {lang === 'fr' ? "Remplir les ordonnances et gérer la file d'attente" : 'Fill prescriptions and manage the queue'}
      </p>

      <StatCardRow>
        <StatCard label={lang==='fr'?'En attente':'Pending'} value={queuePrescriptions.length} accent={queuePrescriptions.length > 0 ? 'warning' : undefined} />
        <StatCard label={lang==='fr'?"Dispensées aujourd'hui":'Dispensed today'} value={dispensedTodayCount ?? 0} />
        <StatCard label={lang==='fr'?'Articles au total':'Total items'} value={totalPendingItems} />
        <StatCard label={lang==='fr'?'Produits':'Products'} value={productCount ?? 0} />
      </StatCardRow>

      <DispensingMasterDetail
        prescriptions={queuePrescriptions}
        staffOptions={activeStaff ?? []}
        currentStaffRole={staff.role}
      />
    </div>
  )
}
