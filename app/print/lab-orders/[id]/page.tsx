// app/print/lab-orders/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export default async function PrintLabReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from('lab_orders')
    .select(`
      id, ordered_at,
      clinics(name, city, quartier, phone),
      visits(patients(full_name, patient_code, date_of_birth, estimated_age, sex)),
      staff(full_name)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !order) {
    notFound()
  }

  const clinic = order.clinics as any
  const patient = (order.visits as any)?.patients
  const orderingDoctor = order.staff as any

  const { data: items } = await supabase
    .from('lab_order_items')
    .select(`
      id, item_type, lab_panel_id, lab_test_catalog_id, external_test_name,
      lab_panels(name_fr, name_en), lab_test_catalog(name_fr, name_en)
    `)
    .eq('lab_order_id', id)

  const itemIds = (items ?? []).map((i) => i.id)

  const { data: results } = itemIds.length > 0
    ? await supabase
        .from('lab_results')
        .select('lab_order_item_id, numeric_value, qualitative_value, reference_range_low, reference_range_high, is_abnormal, is_critical, verified_at, lab_test_catalog(name_fr, name_en, unit)')
        .in('lab_order_item_id', itemIds)
    : { data: [] }

  const name = (obj: any) => (lang === 'en' && obj?.name_en) ? obj.name_en : obj?.name_fr

  const L = {
    title: lang === 'fr' ? 'Rapport de laboratoire' : 'Laboratory Report',
    dob: lang === 'fr' ? 'Né(e) le' : 'DOB',
    estAge: lang === 'fr' ? 'ans (estimé)' : 'yrs (estimated)',
    orderedBy: lang === 'fr' ? 'Prescrit par' : 'Ordered by',
    test: lang === 'fr' ? 'Examen' : 'Test',
    result: lang === 'fr' ? 'Résultat' : 'Result',
    refRange: lang === 'fr' ? 'Valeurs de référence' : 'Reference range',
    interpretation: lang === 'fr' ? 'Interprétation' : 'Interpretation',
    sentExternal: lang === 'fr' ? 'Envoyé à un laboratoire externe — résultat non disponible' : 'Sent to external laboratory — result not available',
    pending: lang === 'fr' ? 'Résultat en attente' : 'Pending result',
    critical: lang === 'fr' ? 'CRITIQUE' : 'CRITICAL',
    abnormal: lang === 'fr' ? 'Anormal' : 'Abnormal',
    normal: 'Normal',
    unverified: lang === 'fr' ? ' (non validé)' : ' (unverified)',
    footer: lang === 'fr'
      ? 'Ce document est généré électroniquement et reflète les résultats enregistrés au moment de l\'impression.'
      : 'This document is electronically generated and reflects results recorded at the time of printing.',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', borderBottom: '2px solid #16211E', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>{clinic?.name}</h1>
          <p style={{ fontSize: '13px', color: '#5C6B65', margin: '4px 0 0' }}>
            {clinic?.quartier}, {clinic?.city}
            {clinic?.phone ? ` · ${clinic.phone}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '13px', color: '#5C6B65', margin: 0 }}>{L.title}</p>
          <p style={{ fontSize: '13px', margin: '4px 0 0' }}>
            {new Date(order.ordered_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', margin: '0 0 2px' }}><strong>{patient?.full_name}</strong></p>
        <p style={{ fontSize: '13px', color: '#5C6B65', margin: 0 }}>
          {patient?.patient_code}
          {patient?.date_of_birth
            ? ` · ${L.dob}: ${new Date(patient.date_of_birth).toLocaleDateString(locale)}`
            : patient?.estimated_age
            ? ` · ${patient.estimated_age} ${L.estAge}`
            : ''}
          {patient?.sex ? ` · ${patient.sex}` : ''}
        </p>
        <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
          {L.orderedBy}: {orderingDoctor?.full_name}
        </p>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #16211E' }}>
            <th style={{ textAlign: 'left', padding: '6px 4px' }}>{L.test}</th>
            <th style={{ textAlign: 'left', padding: '6px 4px' }}>{L.result}</th>
            <th style={{ textAlign: 'left', padding: '6px 4px' }}>{L.refRange}</th>
            <th style={{ textAlign: 'left', padding: '6px 4px' }}>{L.interpretation}</th>
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((item: any) => {
            if (item.item_type === 'external') {
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #DCE3DE' }}>
                  <td style={{ padding: '6px 4px' }}>{item.external_test_name}</td>
                  <td colSpan={3} style={{ padding: '6px 4px', color: '#5C6B65', fontStyle: 'italic' }}>
                    {L.sentExternal}
                  </td>
                </tr>
              )
            }
            const itemResults = (results ?? []).filter((r: any) => r.lab_order_item_id === item.id)
            if (itemResults.length === 0) {
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #DCE3DE' }}>
                  <td style={{ padding: '6px 4px' }}>{name(item.lab_panels) ?? name(item.lab_test_catalog)}</td>
                  <td colSpan={3} style={{ padding: '6px 4px', color: '#5C6B65', fontStyle: 'italic' }}>{L.pending}</td>
                </tr>
              )
            }
            return itemResults.map((r: any, i: number) => (
              <tr key={`${item.id}-${i}`} style={{ borderBottom: '1px solid #DCE3DE' }}>
                <td style={{ padding: '6px 4px' }}>{name(r.lab_test_catalog)}</td>
                <td style={{ padding: '6px 4px', fontWeight: r.is_abnormal ? 600 : 400 }}>
                  {r.numeric_value ?? r.qualitative_value} {r.lab_test_catalog?.unit ?? ''}
                </td>
                <td style={{ padding: '6px 4px', color: '#5C6B65' }}>
                  {r.reference_range_low != null && r.reference_range_high != null
                    ? `${r.reference_range_low} – ${r.reference_range_high}`
                    : '—'}
                </td>
                <td style={{ padding: '6px 4px' }}>
                  {r.is_critical ? L.critical : r.is_abnormal ? L.abnormal : L.normal}
                  {!r.verified_at && L.unverified}
                </td>
              </tr>
            ))
          })}
        </tbody>
      </table>

      <p style={{ fontSize: '11px', color: '#5C6B65', marginTop: '40px' }}>
        {L.footer}
      </p>
    </div>
  )
}
