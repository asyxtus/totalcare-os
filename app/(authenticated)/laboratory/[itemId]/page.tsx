// app/(authenticated)/laboratory/[itemId]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import LabResultsForm from '@/components/LabResultsForm'
import VerifyResultsList from '@/components/VerifyResultsList'
import LabAttachmentUpload from '@/components/LabAttachmentUpload'
import MarkSampleCollectedButton from '@/components/CompleteLabItemButton'

export default async function LabItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: item, error } = await supabase
    .from('lab_order_items')
    .select(`
      id, clinic_id, item_type, status, lab_panel_id, lab_test_catalog_id, lab_order_id,
      lab_orders(visits(patients(full_name, patient_code)))
    `)
    .eq('id', itemId)
    .maybeSingle()

  if (error || !item) notFound()

  const patient = (item as any).lab_orders?.visits?.patients

  let componentTestIds: string[] = []
  let title = ''
  if (item.item_type === 'panel') {
    const { data: panel } = await supabase.from('lab_panels').select('name_fr, name_en').eq('id', item.lab_panel_id).single()
    title = (lang === 'en' && panel?.name_en) ? panel.name_en : (panel?.name_fr ?? (lang === 'fr' ? 'Bilan' : 'Panel'))
    const { data: panelItems } = await supabase
      .from('lab_panel_items')
      .select('lab_test_catalog_id')
      .eq('panel_id', item.lab_panel_id)
    componentTestIds = (panelItems ?? []).map((p) => p.lab_test_catalog_id)
  } else if (item.item_type === 'individual_test') {
    componentTestIds = [item.lab_test_catalog_id]
    const { data: test } = await supabase.from('lab_test_catalog').select('name_fr, name_en').eq('id', item.lab_test_catalog_id).single()
    title = (lang === 'en' && test?.name_en) ? test.name_en : (test?.name_fr ?? (lang === 'fr' ? 'Examen' : 'Test'))
  }

  const { data: catalogTests } = await supabase
    .from('lab_test_catalog')
    .select('id, name_fr, name_en, unit, result_type, qualitative_options')
    .in('id', componentTestIds)

  const { data: existingResults } = await supabase
    .from('lab_results')
    .select('id, lab_test_catalog_id, numeric_value, qualitative_value, is_abnormal, is_critical, verified_at')
    .eq('lab_order_item_id', itemId)

  const existingResultsByTestId: Record<string, any> = {}
  for (const r of existingResults ?? []) {
    existingResultsByTestId[r.lab_test_catalog_id] = r
  }

  const { data: attachments } = await supabase
    .from('lab_result_attachments')
    .select('id, file_path, caption')
    .eq('lab_order_item_id', itemId)

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <Link href="/laboratory" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{title}</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {patient?.full_name} · {patient?.patient_code}
          </p>
        </div>
      </div>

      {item.status === 'pending' && <MarkSampleCollectedButton itemId={itemId} />}

      {item.status === 'completed' ? (
        <>
          <VerifyResultsList
            itemId={itemId}
            results={(catalogTests ?? [])
              .filter((t) => existingResultsByTestId[t.id])
              .map((t) => {
                const r = existingResultsByTestId[t.id]
                return {
                  id: r.id,
                  testName: (lang === 'en' && t.name_en) ? t.name_en : t.name_fr,
                  unit: t.unit,
                  value: String(r.numeric_value ?? r.qualitative_value ?? ''),
                  isAbnormal: r.is_abnormal,
                  isCritical: r.is_critical,
                  verifiedAt: r.verified_at,
                }
              })}
          />
          <p style={{ fontSize: '13px', color: 'var(--color-success-text)', marginTop: '1rem' }}>✓ {lang==='fr'?'Examen terminé.':'Test completed.'}</p>
        </>
      ) : (
        <LabResultsForm
          itemId={itemId}
          clinicId={item.clinic_id}
          tests={catalogTests ?? []}
          existingResults={existingResultsByTestId}
        />
      )}

      <LabAttachmentUpload itemId={itemId} clinicId={item.clinic_id} existingAttachments={attachments ?? []} itemStatus={item.status} />
    </div>
  )
}
