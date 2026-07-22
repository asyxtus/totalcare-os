// app/(authenticated)/admissions/[id]/care/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import InpatientCareTabs from '@/components/inpatient/InpatientCareTabs'
import RoundsTab from '@/components/inpatient/RoundsTab'
import CareTab from '@/components/inpatient/CareTab'
import MARTab from '@/components/inpatient/MARTab'
import VitalsTab from '@/components/inpatient/VitalsTab'
import LabsTab from '@/components/inpatient/LabsTab'

export default async function InpatientCarePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: admission, error } = await supabase
    .from('admissions')
    .select('id, admission_number, admission_reason, status, visit_id, patients(full_name, patient_code, allergies), wards(name), beds(bed_number)')
    .eq('id', id)
    .maybeSingle()

  if (error || !admission) notFound()

  const patient = admission.patients as any
  const isAdmitted = admission.status === 'admitted'
  const rpcErrors: string[] = []

  // Rounds
  const { data: notesRaw, error: notesError } = await supabase
    .from('inpatient_notes')
    .select('id, note, round_type, recorded_at, recorded_by')
    .eq('admission_id', id)
    .order('recorded_at', { ascending: false })
  if (notesError) rpcErrors.push(`inpatient_notes: ${notesError.message}`)

  // Care tasks
  const { data: tasksRaw, error: tasksError } = await supabase
    .from('care_tasks')
    .select('id, task_description, completed_at, completed_by')
    .eq('admission_id', id)
    .order('completed_at', { ascending: false })
  if (tasksError) rpcErrors.push(`care_tasks: ${tasksError.message}`)

  // Vitals
  const { data: vitalsRaw, error: vitalsError } = await supabase
    .from('vital_signs')
    .select('id, recorded_at, recorded_by, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature_celsius, respiratory_rate, oxygen_saturation, notes')
    .eq('admission_id', id)
    .order('recorded_at', { ascending: false })
  if (vitalsError) rpcErrors.push(`vital_signs: ${vitalsError.message}`)

  // Triage vitals — recorded at registration, before admission, in a
  // separate visit-scoped table with different column names (systolic_bp
  // vs blood_pressure_systolic, pulse vs heart_rate, etc.). Nurses need to
  // see the intake reading alongside the inpatient-recorded history.
  const { data: triageVitalsRaw, error: triageVitalsError } = await supabase
    .from('vitals')
    .select('id, recorded_at, recorded_by, systolic_bp, diastolic_bp, pulse, temperature, respiratory_rate, spo2, weight_kg, height_cm')
    .eq('visit_id', admission.visit_id)
    .order('recorded_at', { ascending: false })
  if (triageVitalsError) rpcErrors.push(`vitals (triage): ${triageVitalsError.message}`)

  // Resolve staff names for notes/tasks/vitals in one batch (avoids
  // guessing at ambiguous FK constraint names — these are single-FK
  // tables so a direct join would actually be safe, but batching stays
  // consistent with the pattern used elsewhere and avoids N+1 queries).
  const staffIds = [
    ...(notesRaw ?? []).map((n) => n.recorded_by),
    ...(tasksRaw ?? []).map((t) => t.completed_by),
    ...(vitalsRaw ?? []).map((v) => v.recorded_by),
    ...(triageVitalsRaw ?? []).map((v) => v.recorded_by),
  ].filter(Boolean)
  const { data: staffRows } = staffIds.length > 0
    ? await supabase.from('staff').select('id, full_name').in('id', [...new Set(staffIds)])
    : { data: [] }
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]))

  const notes = (notesRaw ?? []).map((n) => ({ ...n, staff_name: staffNameById.get(n.recorded_by) ?? '—' }))
  const tasks = (tasksRaw ?? []).map((t) => ({ ...t, staff_name: staffNameById.get(t.completed_by) ?? '—' }))

  // Merge inpatient-recorded vitals with the triage-time reading, mapping
  // the triage table's different column names onto the same shape so
  // VitalsTab can render one combined, chronologically-sorted history.
  // source: 'triage' | 'inpatient' lets the UI badge where each reading
  // came from.
  const inpatientVitals = (vitalsRaw ?? []).map((v) => ({
    id: v.id, recorded_at: v.recorded_at, staff_name: staffNameById.get(v.recorded_by) ?? '—',
    blood_pressure_systolic: v.blood_pressure_systolic, blood_pressure_diastolic: v.blood_pressure_diastolic,
    heart_rate: v.heart_rate, temperature_celsius: v.temperature_celsius,
    respiratory_rate: v.respiratory_rate, oxygen_saturation: v.oxygen_saturation,
    weight_kg: null as number | null, height_cm: null as number | null,
    notes: v.notes, source: 'inpatient' as const,
  }))
  const triageVitalsMapped = (triageVitalsRaw ?? []).map((v) => ({
    id: v.id, recorded_at: v.recorded_at, staff_name: staffNameById.get(v.recorded_by) ?? '—',
    blood_pressure_systolic: v.systolic_bp, blood_pressure_diastolic: v.diastolic_bp,
    heart_rate: v.pulse, temperature_celsius: v.temperature,
    respiratory_rate: v.respiratory_rate, oxygen_saturation: v.spo2,
    weight_kg: v.weight_kg, height_cm: v.height_cm,
    notes: null as string | null, source: 'triage' as const,
  }))
  const vitals = [...inpatientVitals, ...triageVitalsMapped]
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())

  // MAR: prescriptions tied to this admission's own visit, their items,
  // and each item's administration log.
  const { data: prescriptions } = await supabase
    .from('prescriptions')
    .select('id')
    .eq('visit_id', admission.visit_id)

  const prescriptionIds = (prescriptions ?? []).map((p) => p.id)
  const { data: rxItemsRaw, error: rxItemsError } = prescriptionIds.length > 0
    ? await supabase
        .from('prescription_items')
        .select('id, drug_name_freetext, dose, route, frequency, products(name)')
        .in('prescription_id', prescriptionIds)
    : { data: [], error: null }
  if (rxItemsError) rpcErrors.push(`prescription_items: ${rxItemsError.message}`)

  const rxItemIds = (rxItemsRaw ?? []).map((i) => i.id)
  const { data: administrationsRaw } = rxItemIds.length > 0
    ? await supabase
        .from('medication_administrations')
        .select('id, prescription_item_id, status, administered_at, administered_by, notes')
        .in('prescription_item_id', rxItemIds)
        .order('administered_at', { ascending: false })
    : { data: [] }

  const adminStaffIds = [...new Set((administrationsRaw ?? []).map((a) => a.administered_by).filter(Boolean))]
  const { data: adminStaffRows } = adminStaffIds.length > 0
    ? await supabase.from('staff').select('id, full_name').in('id', adminStaffIds)
    : { data: [] }
  const adminStaffNameById = new Map((adminStaffRows ?? []).map((s) => [s.id, s.full_name]))

  // Dispensed quantities per item — lets the MAR warn the nurse before
  // she tries to log a dose pharmacy hasn't dispensed, mirroring the
  // hard check now enforced in record_medication_administration().
  const { data: dispensingRaw } = rxItemIds.length > 0
    ? await supabase
        .from('dispensing_records')
        .select('prescription_item_id, quantity_dispensed')
        .in('prescription_item_id', rxItemIds)
    : { data: [] }
  const dispensedTotalByItem = new Map<string, number>()
  for (const d of dispensingRaw ?? []) {
    dispensedTotalByItem.set(d.prescription_item_id, (dispensedTotalByItem.get(d.prescription_item_id) ?? 0) + d.quantity_dispensed)
  }

  const marItems = (rxItemsRaw ?? []).map((item: any) => ({
    id: item.id,
    drug_display_name: item.products?.name ?? item.drug_name_freetext ?? (lang==='fr'?'Médicament':'Medication'),
    dose: item.dose, route: item.route, frequency: item.frequency,
    dispensed_total: dispensedTotalByItem.get(item.id) ?? 0,
    administrations: (administrationsRaw ?? [])
      .filter((a: any) => a.prescription_item_id === item.id)
      .map((a: any) => ({ id: a.id, status: a.status, administered_at: a.administered_at, notes: a.notes, staff_name: adminStaffNameById.get(a.administered_by) ?? '—' })),
  }))

  // Products for prescribing
  const { data: products } = await supabase
    .rpc('get_products_with_stock', { p_clinic_id: staff.clinicId })

  // Lab catalog for in-stay ordering — reusing the exact same data the
  // consultation screen's lab ordering already uses.
  const { data: clinicPanels } = await supabase
    .from('clinic_lab_panels')
    .select('lab_panel_id, lab_panels(name_fr, category)')
    .eq('clinic_id', staff.clinicId)
    .eq('is_active', true)
  const { data: clinicTests } = await supabase
    .from('clinic_lab_tests')
    .select('lab_test_catalog_id, lab_test_catalog(name_fr, category)')
    .eq('clinic_id', staff.clinicId)
    .eq('is_active', true)

  const panels = (clinicPanels ?? []).map((p: any) => ({ id: p.lab_panel_id, name: p.lab_panels?.name_fr, category: p.lab_panels?.category ?? null }))
  const tests = (clinicTests ?? []).map((t: any) => ({ id: t.lab_test_catalog_id, name: t.lab_test_catalog?.name_fr, category: t.lab_test_catalog?.category }))

  // Recent validated results for this visit — lab_order_items has no
  // direct visit_id column, so fetch via lab_orders first.
  const { data: labOrders } = await supabase
    .from('lab_orders')
    .select('id, ordered_at')
    .eq('visit_id', admission.visit_id)
  const labOrderIds = (labOrders ?? []).map((o) => o.id)
  const orderedAtByOrderId = new Map((labOrders ?? []).map((o) => [o.id, o.ordered_at]))

  const { data: recentResultsRaw } = labOrderIds.length > 0
    ? await supabase
        .from('lab_order_items')
        .select('id, status, external_test_name, lab_order_id, lab_panels(name_fr, name_en), lab_test_catalog(name_fr, name_en), lab_results(numeric_value, qualitative_value, is_abnormal, is_critical, verified_at)')
        .in('lab_order_id', labOrderIds)
    : { data: [] }

  const testDisplayName = (item: any) =>
    (lang === 'en' && (item.lab_panels?.name_en || item.lab_test_catalog?.name_en))
      ? (item.lab_panels?.name_en || item.lab_test_catalog?.name_en)
      : (item.lab_panels?.name_fr ?? item.lab_test_catalog?.name_fr ?? item.external_test_name ?? 'Test')

  // Supabase/PostgREST returns a joined table as an array (one-to-many) or
  // a single object (one-to-one) depending on whether a unique constraint
  // exists on the FK — that can differ from what the code assumes. This
  // normalizes either shape so "is there a verified result" checks work
  // regardless, instead of silently treating a single-object result as
  // "no result" (which showed validated tests as still pending).
  const firstResult = (item: any) => {
    const r = item.lab_results
    if (!r) return null
    if (Array.isArray(r)) return r.length > 0 ? r[0] : null
    return r
  }

  const recentResults = (recentResultsRaw ?? [])
    .filter((item: any) => firstResult(item)?.verified_at)
    .map((item: any) => {
      const result = firstResult(item)
      return {
        id: item.id,
        test_name: testDisplayName(item),
        result_value: result?.numeric_value != null ? String(result.numeric_value) : (result?.qualitative_value ?? null),
        is_abnormal: result?.is_abnormal ?? false,
        is_critical: result?.is_critical ?? false,
        verified_at: result?.verified_at ?? null,
        ordered_at: orderedAtByOrderId.get(item.lab_order_id) ?? null,
      }
    })

  // Tests ordered (during consultation or in-stay) that don't have a
  // verified result yet — nurses and doctors need to see these are still
  // outstanding, not just silently missing from the tab.
  const pendingResults = (recentResultsRaw ?? [])
    .filter((item: any) => {
      if (item.status === 'cancelled') return false
      const result = firstResult(item)
      // Attachment-only completions have no result row to verify — they're
      // done, not "in progress." Exclude them rather than showing a
      // misleading "awaiting verification" for something that can't be
      // verified through this mechanism.
      if (item.status === 'completed' && !result) return false
      return !result?.verified_at
    })
    .map((item: any) => ({
      id: item.id,
      test_name: testDisplayName(item),
      status: item.status as string,
    }))

  // Tests completed via an attached photo/PDF instead of individual
  // values — done, but with nothing to "verify" through the numeric-result
  // mechanism. Shown as their own category so they don't just disappear
  // once completed (the gap that made "Complete with this attachment"
  // results invisible in this tab).
  const attachmentResults = (recentResultsRaw ?? [])
    .filter((item: any) => item.status === 'completed' && !firstResult(item))
    .map((item: any) => ({ id: item.id, test_name: testDisplayName(item) }))

  const roundsContent = <RoundsTab admissionId={id} notes={notes} canEdit={isAdmitted} />
  const marContent = <MARTab admissionId={id} items={marItems} />
  const careContent = <CareTab admissionId={id} products={(products ?? []).map((p: any) => ({
    id: p.product_id,
    name: p.name,
    dosageForm: p.dosage_form ?? null,
    isAntibiotic: p.is_antibiotic ?? false,
    onHand: p.on_hand ?? 0,
  }))} tasks={tasks} />
  const vitalsContent = <VitalsTab admissionId={id} vitals={vitals} />
  const labsContent = <LabsTab admissionId={id} visitId={admission.visit_id} panels={panels} tests={tests} recentResults={recentResults} pendingResults={pendingResults} attachmentResults={attachmentResults} />

  return (
    <div style={{ maxWidth: '750px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/admissions" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{lang === 'fr' ? 'Soins hospitaliers — ' : 'Inpatient Care — '}{patient?.full_name}</h1>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
              {admission.admission_number} · {(admission.wards as any)?.name ?? '—'} · Lit {(admission.beds as any)?.bed_number ?? '—'}
            </p>
          </div>
        </div>
        <a
          href={`/print/clinical-summary/${admission.visit_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '12px', padding: '7px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            color: 'var(--color-text-primary)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {lang === 'fr' ? '🖨 Dossier complet' : '🖨 Full clinical record'}
        </a>
      </div>

      {patient?.allergies && (
        <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', margin: '10px 0 0' }}>
          ⚠ Allergies : {patient.allergies}
        </p>
      )}

      {!isAdmitted && (
        <p style={{ fontSize: '13px', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', margin: '10px 0 0' }}>
          {lang==='fr'?"Ce patient n'est plus admis — les nouvelles entrées sont désactivées, l'historique reste consultable":'This patient is no longer admitted — new entries are disabled, history remains viewable.'}.
        </p>
      )}

      {rpcErrors.length > 0 && (
        <div style={{ background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', margin: '10px 0', fontSize: '12px' }}>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {rpcErrors.map((e, i) => <li key={i} style={{ fontFamily: 'var(--font-mono)' }}>{e}</li>)}
          </ul>
        </div>
      )}

      <div style={{ marginTop: '1.25rem' }}>
        <InpatientCareTabs
          roundsContent={roundsContent}
          marContent={marContent}
          careContent={careContent}
          vitalsContent={vitalsContent}
          labsContent={labsContent}
        />
      </div>
    </div>
  )
}
