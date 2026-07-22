// app/print/clinical-summary/[visitId]/page.tsx
//
// The complete clinical record for a visit in one printable document.
// For outpatient-only visits: triage vitals + SOAP consultation +
// prescriptions + lab orders/results.
// For hospitalised patients: all of the above + the full inpatient stay —
// MAR, nursing vitals, round notes, care tasks, and discharge summary.
//
// Designed to be the one document a patient or referral letter needs.

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

const DISCHARGE_LABELS: Record<string, { fr: string; en: string }> = {
  routine:                { fr: 'Routine', en: 'Routine' },
  transfer_out:           { fr: 'Transfert établissement', en: 'Transfer to another facility' },
  against_medical_advice: { fr: 'Contre avis médical', en: 'Against medical advice' },
  deceased:               { fr: 'Décès', en: 'Deceased' },
}

const ADMIN_STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  administered: { fr: 'Administré', en: 'Administered' },
  refused:      { fr: 'Refusé', en: 'Refused' },
  missed:       { fr: 'Manqué', en: 'Missed' },
}

const ROUND_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  doctor_round:      { fr: 'Visite médecin', en: 'Doctor Round' },
  nurse_round:       { fr: 'Visite infirmière', en: 'Nurse Round' },
  specialist_review: { fr: 'Avis spécialiste', en: 'Specialist Review' },
}

// Typography helpers — keep consistent through the whole page
const H = {
  sectionHeader: {
    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const,
    letterSpacing: '0.07em', color: '#2F6F62', margin: '28px 0 8px',
    paddingBottom: '4px', borderBottom: '1.5px solid #2F6F62',
  },
  subHeader: {
    fontSize: '12px', fontWeight: 600, color: '#3d4a45', margin: '14px 0 4px',
  },
  label: { fontSize: '11px', color: '#5C6B65' },
  body: { fontSize: '13px', lineHeight: '1.65', margin: 0 },
  mono: { fontSize: '12px', fontFamily: 'monospace', color: '#2F4F4F' },
}

function fmt(iso: string | null | undefined, lang = 'fr') {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function fmtDate(iso: string | null | undefined, lang = 'fr') {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function Divider() {
  return <div style={{ borderTop: '1px solid #DCE3DE', margin: '10px 0' }} />
}

function SectionHeader({ fr, en, lang }: { fr: string; en: string; lang: 'fr' | 'en' }) {
  return <p style={H.sectionHeader}>{lang === 'fr' ? fr : (en || fr)}</p>
}

function BiLabel({ fr, en, value, lang }: { fr: string; en: string; value: React.ReactNode; lang: 'fr' | 'en' }) {
  return (
    <div style={{ display: 'flex', marginBottom: '6px' }}>
      <span style={{ ...H.label, width: '200px', flexShrink: 0 }}>{lang === 'fr' ? fr : (en || fr)}</span>
      <span style={H.body}>{value ?? '—'}</span>
    </div>
  )
}

export default async function PrintClinicalSummaryPage({
  params,
}: {
  params: Promise<{ visitId: string }>
}) {
  const { visitId } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  // ─── Core visit ──────────────────────────────────────────────────────────
  const { data: visit, error: visitError } = await supabase
    .from('visits')
    .select(`
      id, visit_reason, status, created_at,
      patients(
        id, full_name, patient_code, date_of_birth, estimated_age, sex,
        phone, quartier, city, allergies, chronic_conditions, payment_category
      ),
      clinics(name, city, quartier, phone)
    `)
    .eq('id', visitId)
    .maybeSingle()

  if (visitError || !visit) notFound()

  const patient = visit.patients as any
  const clinic = visit.clinics as any

  // ─── Triage ───────────────────────────────────────────────────────────────
  const { data: triage } = await supabase
    .from('triage_assessments')
    .select('*')
    .eq('visit_id', visitId)
    .maybeSingle()

  // ─── Consultation (SOAP) ──────────────────────────────────────────────────
  const { data: consultation } = await supabase
    .from('consultations')
    .select(`
      id, started_at, completed_at,
      subjective_notes, examination_notes, diagnosis, diagnosis_code, treatment_plan,
      staff(full_name, license_number)
    `)
    .eq('visit_id', visitId)
    .maybeSingle()

  const doctor = (consultation as any)?.staff

  // ─── Prescriptions ────────────────────────────────────────────────────────
  const { data: prescriptions } = await supabase
    .from('prescriptions')
    .select(`
      id, created_at,
      prescription_items(
        id, dose, frequency, duration_days, quantity_prescribed, route, instructions,
        products(name), drug_name_freetext
      )
    `)
    .eq('visit_id', visitId)
    .order('created_at')

  // ─── Lab orders ───────────────────────────────────────────────────────────
  const { data: labOrders } = await supabase
    .from('lab_orders')
    .select(`
      id, ordered_at,
      lab_order_items(
        id, item_type, external_test_name,
        lab_panels(name_fr, name_en),
        lab_test_catalog(name_fr, name_en, unit),
        lab_results(
          numeric_value, qualitative_value,
          reference_range_low, reference_range_high,
          is_abnormal, is_critical, verified_at
        )
      )
    `)
    .eq('visit_id', visitId)
    .order('ordered_at')

  // ─── Admission (if hospitalised) ─────────────────────────────────────────
  const { data: admission } = await supabase
    .from('admissions')
    .select(`
      id, admission_number, admission_reason, status,
      recommended_at, bed_assigned_at, discharged_at,
      discharge_type, discharge_outcome, discharge_summary,
      wards(name), beds(bed_number),
      recommended_by:staff!recommended_by(full_name),
      discharged_by:staff!discharged_by(full_name)
    `)
    .eq('visit_id', visitId)
    .maybeSingle()

  let admissionDetails: {
    vitals: any[]; notes: any[]; careTasks: any[]; marRecords: any[]
    vitalStaffNames: Map<string, string>; noteStaffNames: Map<string, string>
    careStaffNames: Map<string, string>; marStaffNames: Map<string, string>
  } | null = null

  if (admission) {
    const admId = admission.id

    const [{ data: vitals }, { data: notes }, { data: careTasks }, { data: marRecords }] =
      await Promise.all([
        supabase.from('vital_signs').select('*').eq('admission_id', admId).order('recorded_at'),
        supabase.from('inpatient_notes').select('*').eq('admission_id', admId).order('recorded_at'),
        supabase.from('care_tasks').select('*').eq('admission_id', admId).order('completed_at'),
        supabase.from('medication_administrations')
          .select('*, prescription_items(products(name), drug_name_freetext, dose, frequency)')
          .eq('admission_id', admId).order('administered_at'),
      ])

    // Resolve staff names for all four record types in parallel
    const staffIdSets = [
      new Set((vitals ?? []).map((v: any) => v.recorded_by).filter(Boolean)),
      new Set((notes ?? []).map((n: any) => n.recorded_by).filter(Boolean)),
      new Set((careTasks ?? []).map((c: any) => c.completed_by).filter(Boolean)),
      new Set((marRecords ?? []).map((m: any) => m.administered_by).filter(Boolean)),
    ]
    const allStaffIds = [...new Set([...staffIdSets[0], ...staffIdSets[1], ...staffIdSets[2], ...staffIdSets[3]])]

    const { data: staffRows } = allStaffIds.length > 0
      ? await supabase.from('staff').select('id, full_name').in('id', allStaffIds)
      : { data: [] as any[] }

    const nameById = new Map((staffRows ?? []).map((s: any) => [s.id, s.full_name]))

    admissionDetails = {
      vitals: vitals ?? [], notes: notes ?? [],
      careTasks: careTasks ?? [], marRecords: marRecords ?? [],
      vitalStaffNames: nameById, noteStaffNames: nameById,
      careStaffNames: nameById, marStaffNames: nameById,
    }
  }

  const isHospitalised = !!admission

  return (
    <div style={{ fontFamily: 'Georgia, serif', color: '#1a2820', maxWidth: '700px', margin: '0 auto', padding: '0 16px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '3px solid #2F6F62', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#16211E' }}>{clinic?.name}</h1>
          <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
            {clinic?.quartier}, {clinic?.city}{clinic?.phone ? ` · ${clinic.phone}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#2F6F62' }}>
            {isHospitalised
              ? 'Dossier clinique complet / Complete Clinical Record'
              : 'Compte-rendu de consultation / Consultation Report'}
          </p>
          <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
            {fmtDate(visit.created_at, lang)}
          </p>
          {isHospitalised && admission && (
            <p style={{ ...H.mono, margin: '4px 0 0', color: '#2F6F62' }}>
              {admission.admission_number}
            </p>
          )}
        </div>
      </div>

      {/* ── Patient identity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '20px', background: '#F4F7F5', padding: '12px 16px', borderRadius: '6px' }}>
        <div>
          <p style={{ ...H.label, margin: '0 0 2px' }}>Patient</p>
          <p style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#16211E' }}>{patient?.full_name}</p>
          <p style={{ ...H.mono, margin: '2px 0 0' }}>{patient?.patient_code}</p>
        </div>
        <div>
          {patient?.date_of_birth && (
            <BiLabel lang={lang} fr="Né(e) le" en="DOB" value={new Date(patient.date_of_birth).toLocaleDateString(locale)} />
          )}
          {!patient?.date_of_birth && patient?.estimated_age && (
            <BiLabel lang={lang} fr="Âge estimé" en="Est. age" value={`${patient.estimated_age} ans / yrs`} />
          )}
          <BiLabel lang={lang} fr="Sexe" en="Sex" value={patient?.sex} />
          {patient?.phone && <BiLabel lang={lang} fr="Tél." en="Phone" value={patient.phone} />}
          {patient?.payment_category && patient.payment_category !== 'cash' && (
            <BiLabel lang={lang} fr="Couverture" en="Coverage" value={patient.payment_category} />
          )}
        </div>
        {(patient?.allergies || patient?.chronic_conditions) && (
          <div style={{ gridColumn: '1 / -1', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid #DCE3DE' }}>
            {patient.allergies && (
              <p style={{ fontSize: '12px', color: '#C0392B', margin: '0 0 2px' }}>
                ⚠ Allergies : {patient.allergies}
              </p>
            )}
            {patient.chronic_conditions && (
              <p style={{ ...H.label, margin: 0 }}>
                Antécédents / History: {patient.chronic_conditions}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Triage vitals ── */}
      {triage && (
        <>
          <SectionHeader lang={lang} fr="Triage infirmier" en="Nursing Triage" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
            {[
              { fr: 'TA / BP', en: '', value: triage.systolic_bp && triage.diastolic_bp ? `${triage.systolic_bp}/${triage.diastolic_bp} mmHg` : null },
              { fr: 'Pouls / Pulse', en: '', value: triage.pulse ? `${triage.pulse} bpm` : null },
              { fr: 'Temp.', en: '', value: triage.temperature_celsius ? `${triage.temperature_celsius} °C` : null },
              { fr: 'SpO2', en: '', value: triage.spo2 ? `${triage.spo2}%` : null },
              { fr: 'FR / RR', en: '', value: triage.respiratory_rate ? `${triage.respiratory_rate}/min` : null },
              { fr: 'Poids / Weight', en: '', value: triage.weight_kg ? `${triage.weight_kg} kg` : null },
              { fr: 'Taille / Height', en: '', value: triage.height_cm ? `${triage.height_cm} cm` : null },
            ].filter(v => v.value).map((v, i) => (
              <div key={i} style={{ background: '#F4F7F5', padding: '6px 10px', borderRadius: '4px' }}>
                <p style={{ ...H.label, margin: '0 0 2px' }}>{v.fr}</p>
                <p style={{ ...H.mono, fontSize: '13px', fontWeight: 600, margin: 0, color: '#16211E' }}>{v.value}</p>
              </div>
            ))}
          </div>
          {triage.chief_complaint && <BiLabel lang={lang} fr="Motif" en="Chief complaint" value={triage.chief_complaint} />}
          {triage.medical_history && <BiLabel lang={lang} fr="Antécédents" en="Medical history" value={triage.medical_history} />}
          {triage.social_history && <BiLabel lang={lang} fr="Contexte social" en="Social history" value={triage.social_history} />}
        </>
      )}

      {/* ── SOAP Consultation ── */}
      {consultation && (
        <>
          <SectionHeader lang={lang} fr="Consultation" en="Consultation" />
          <p style={{ ...H.label, margin: '0 0 10px' }}>
            {fmt(consultation.started_at, lang)} · {doctor?.full_name}
            {doctor?.license_number ? ` — N° ${doctor.license_number}` : ''}
          </p>
          {consultation.subjective_notes && (
            <>
              <p style={H.subHeader}>S — Subjectif / Subjective</p>
              <p style={{ ...H.body, whiteSpace: 'pre-wrap', marginBottom: '10px' }}>{consultation.subjective_notes}</p>
            </>
          )}
          {consultation.examination_notes && (
            <>
              <p style={H.subHeader}>O — Objectif / Objective</p>
              <p style={{ ...H.body, whiteSpace: 'pre-wrap', marginBottom: '10px' }}>{consultation.examination_notes}</p>
            </>
          )}
          {(consultation.diagnosis || consultation.diagnosis_code) && (
            <>
              <p style={H.subHeader}>A — Évaluation / Assessment</p>
              <p style={{ ...H.body, marginBottom: '10px' }}>
                {consultation.diagnosis}
                {consultation.diagnosis_code ? ` (ICD-10: ${consultation.diagnosis_code})` : ''}
              </p>
            </>
          )}
          {consultation.treatment_plan && (
            <>
              <p style={H.subHeader}>P — Plan</p>
              <p style={{ ...H.body, whiteSpace: 'pre-wrap', marginBottom: '10px' }}>{consultation.treatment_plan}</p>
            </>
          )}
        </>
      )}

      {/* ── Prescriptions ── */}
      {prescriptions && prescriptions.length > 0 && (
        <>
          <SectionHeader lang={lang} fr="Ordonnances" en="Prescriptions" />
          {(prescriptions as any[]).map((rx: any, ri: number) => (
            <div key={rx.id} style={{ marginBottom: '10px' }}>
              {prescriptions.length > 1 && (
                <p style={{ ...H.label, marginBottom: '4px' }}>
                  {lang === 'fr' ? 'Ordonnance' : 'Prescription'} {ri + 1} · {fmt(rx.created_at, lang)}
                </p>
              )}
              {(rx.prescription_items ?? []).map((item: any, ii: number) => (
                <div key={item.id} style={{ display: 'flex', gap: '8px', marginBottom: '4px', paddingLeft: '8px' }}>
                  <span style={{ color: '#2F6F62', flexShrink: 0 }}>{ii + 1}.</span>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      {item.products?.name ?? item.drug_name_freetext}
                    </span>
                    <span style={{ fontSize: '12px', color: '#5C6B65', marginLeft: '8px' }}>
                      {[item.dose, item.route, item.frequency, item.duration_days ? `${item.duration_days}j/${item.duration_days}d` : null, `Qté/Qty: ${item.quantity_prescribed}`].filter(Boolean).join(' · ')}
                    </span>
                    {item.instructions && (
                      <p style={{ fontSize: '11px', color: '#5C6B65', margin: '1px 0 0', fontStyle: 'italic' }}>{item.instructions}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* ── Lab results ── */}
      {labOrders && labOrders.length > 0 && (
        <>
          <SectionHeader lang={lang} fr="Examens de laboratoire" en="Laboratory Tests" />
          {(labOrders as any[]).map((order: any) => (
            <div key={order.id} style={{ marginBottom: '12px' }}>
              <p style={{ ...H.label, marginBottom: '4px' }}>
                {fmt(order.ordered_at, lang)}
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #16211E' }}>
                    <th style={{ textAlign: 'left', padding: '3px 6px' }}>Examen / Test</th>
                    <th style={{ textAlign: 'left', padding: '3px 6px' }}>Résultat / Result</th>
                    <th style={{ textAlign: 'left', padding: '3px 6px' }}>Référence / Ref. range</th>
                    <th style={{ textAlign: 'left', padding: '3px 6px' }}>Interp.</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.lab_order_items ?? []).map((item: any) => {
                    if (item.item_type === 'external') {
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #E8EDEB' }}>
                          <td style={{ padding: '4px 6px' }}>{item.external_test_name}</td>
                          <td colSpan={3} style={{ padding: '4px 6px', color: '#5C6B65', fontStyle: 'italic' }}>
                            Externe / External
                          </td>
                        </tr>
                      )
                    }
                    const name = item.lab_panels?.name_fr ?? item.lab_test_catalog?.name_fr
                    const results = item.lab_results ?? []
                    if (results.length === 0) {
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #E8EDEB' }}>
                          <td style={{ padding: '4px 6px' }}>{name}</td>
                          <td colSpan={3} style={{ padding: '4px 6px', color: '#5C6B65', fontStyle: 'italic' }}>En attente / Pending</td>
                        </tr>
                      )
                    }
                    return results.map((r: any, ri: number) => (
                      <tr key={ri} style={{ borderBottom: '1px solid #E8EDEB', color: r.is_critical ? '#C0392B' : r.is_abnormal ? '#D4840A' : 'inherit' }}>
                        <td style={{ padding: '4px 6px' }}>{name}</td>
                        <td style={{ padding: '4px 6px', fontWeight: r.is_abnormal ? 700 : 400, fontFamily: 'monospace' }}>
                          {r.numeric_value ?? r.qualitative_value ?? '—'} {item.lab_test_catalog?.unit ?? ''}
                        </td>
                        <td style={{ padding: '4px 6px', color: '#5C6B65', fontFamily: 'monospace' }}>
                          {r.reference_range_low != null && r.reference_range_high != null
                            ? `${r.reference_range_low}–${r.reference_range_high}` : '—'}
                        </td>
                        <td style={{ padding: '4px 6px', fontSize: '11px' }}>
                          {r.is_critical ? '⚠ CRITIQUE/CRITICAL' : r.is_abnormal ? 'Anormal/Abnorm.' : 'Normal'}
                          {!r.verified_at && ' †'}
                        </td>
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
              <p style={{ fontSize: '10px', color: '#5C6B65', margin: '4px 0 0' }}>
                † Résultat non validé / Unverified result
              </p>
            </div>
          ))}
        </>
      )}

      {/* ── INPATIENT SECTION ── */}
      {admission && admissionDetails && (
        <>
          <div style={{ borderTop: '3px solid #2F6F62', marginTop: '32px', paddingTop: '8px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#2F6F62', margin: '0 0 2px' }}>
              Dossier d'hospitalisation / Inpatient Record · {admission.admission_number}
            </p>
          </div>

          {/* Admission header */}
          <SectionHeader lang={lang} fr="Admission" en="Admission" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <BiLabel lang={lang} fr="Motif d'admission" en="Reason" value={admission.admission_reason} />
            <BiLabel lang={lang} fr="Service / Ward" en="" value={(admission as any).wards?.name} />
            <BiLabel lang={lang} fr="Lit / Bed" en="" value={(admission as any).beds?.bed_number} />
            <BiLabel lang={lang} fr="Admis le / Admitted" en="" value={fmt(admission.recommended_at, lang)} />
            {admission.discharged_at && (
              <BiLabel lang={lang} fr="Sorti le / Discharged" en="" value={fmt(admission.discharged_at, lang)} />
            )}
            {admission.discharge_type && (
              <BiLabel lang={lang} fr="Type de sortie" en="Discharge type"
                value={`${DISCHARGE_LABELS[admission.discharge_type]?.fr ?? admission.discharge_type} / ${DISCHARGE_LABELS[admission.discharge_type]?.en ?? admission.discharge_type}`} />
            )}
          </div>

          {/* Inpatient vitals */}
          {admissionDetails.vitals.length > 0 && (
            <>
              <SectionHeader lang={lang} fr="Surveillance des constantes" en="Vital Signs Monitoring" />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #16211E', color: '#5C6B65' }}>
                    <th style={{ textAlign: 'left', padding: '3px 4px' }}>Date / Time</th>
                    <th style={{ padding: '3px 4px' }}>TA/BP</th>
                    <th style={{ padding: '3px 4px' }}>FC/HR</th>
                    <th style={{ padding: '3px 4px' }}>T°C</th>
                    <th style={{ padding: '3px 4px' }}>SpO2</th>
                    <th style={{ padding: '3px 4px' }}>FR/RR</th>
                    <th style={{ textAlign: 'left', padding: '3px 4px' }}>Par / By</th>
                  </tr>
                </thead>
                <tbody>
                  {admissionDetails.vitals.map((v: any) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #E8EDEB' }}>
                      <td style={{ padding: '3px 4px', fontFamily: 'monospace', fontSize: '10px' }}>{fmt(v.recorded_at, lang)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'center', fontFamily: 'monospace' }}>
                        {v.blood_pressure_systolic && v.blood_pressure_diastolic ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}` : '—'}
                      </td>
                      <td style={{ padding: '3px 4px', textAlign: 'center', fontFamily: 'monospace' }}>{v.heart_rate ?? '—'}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'center', fontFamily: 'monospace' }}>{v.temperature_celsius ?? '—'}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'center', fontFamily: 'monospace' }}>{v.oxygen_saturation ? `${v.oxygen_saturation}%` : '—'}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'center', fontFamily: 'monospace' }}>{v.respiratory_rate ?? '—'}</td>
                      <td style={{ padding: '3px 4px', fontSize: '10px', color: '#5C6B65' }}>{admissionDetails.vitalStaffNames.get(v.recorded_by) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Round notes */}
          {admissionDetails.notes.length > 0 && (
            <>
              <SectionHeader lang={lang} fr="Journal de rondes" en="Round Notes" />
              {admissionDetails.notes.map((n: any) => (
                <div key={n.id} style={{ marginBottom: '10px', paddingLeft: '8px', borderLeft: '2px solid #DCE3DE' }}>
                  <p style={{ ...H.label, margin: '0 0 2px' }}>
                    {ROUND_TYPE_LABELS[n.round_type]?.fr ?? n.round_type} / {ROUND_TYPE_LABELS[n.round_type]?.en ?? n.round_type}
                    {' · '}{admissionDetails.noteStaffNames.get(n.recorded_by) ?? '—'}
                    {' · '}{fmt(n.recorded_at, lang)}
                  </p>
                  <p style={{ ...H.body }}>{n.note}</p>
                </div>
              ))}
            </>
          )}

          {/* MAR */}
          {admissionDetails.marRecords.length > 0 && (
            <>
              <SectionHeader lang={lang} fr="Feuille d'administration des médicaments (MAR)" en="Medication Administration Record (MAR)" />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #16211E', color: '#5C6B65' }}>
                    <th style={{ textAlign: 'left', padding: '3px 4px' }}>Médicament / Medication</th>
                    <th style={{ textAlign: 'left', padding: '3px 4px' }}>Heure / Time</th>
                    <th style={{ textAlign: 'left', padding: '3px 4px' }}>Statut / Status</th>
                    <th style={{ textAlign: 'left', padding: '3px 4px' }}>Par / By</th>
                    <th style={{ textAlign: 'left', padding: '3px 4px' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {admissionDetails.marRecords.map((m: any) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #E8EDEB' }}>
                      <td style={{ padding: '3px 4px', fontWeight: 600 }}>
                        {m.prescription_items?.products?.name ?? m.prescription_items?.drug_name_freetext ?? '—'}
                        <span style={{ fontWeight: 400, color: '#5C6B65', marginLeft: '4px' }}>
                          {m.prescription_items?.dose} {m.prescription_items?.frequency}
                        </span>
                      </td>
                      <td style={{ padding: '3px 4px', fontFamily: 'monospace', fontSize: '10px' }}>{fmt(m.administered_at, lang)}</td>
                      <td style={{ padding: '3px 4px', color: m.status === 'administered' ? '#2F6F62' : m.status === 'refused' ? '#C0392B' : '#D4840A' }}>
                        {ADMIN_STATUS_LABELS[m.status]?.fr ?? m.status} / {ADMIN_STATUS_LABELS[m.status]?.en ?? m.status}
                      </td>
                      <td style={{ padding: '3px 4px', fontSize: '10px', color: '#5C6B65' }}>
                        {admissionDetails.marStaffNames.get(m.administered_by) ?? '—'}
                      </td>
                      <td style={{ padding: '3px 4px', fontSize: '10px', color: '#5C6B65' }}>{m.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Care tasks */}
          {admissionDetails.careTasks.length > 0 && (
            <>
              <SectionHeader lang={lang} fr="Tâches de soins infirmiers" en="Nursing Care Tasks" />
              {admissionDetails.careTasks.map((t: any) => (
                <div key={t.id} style={{ display: 'flex', gap: '12px', marginBottom: '4px', fontSize: '12px' }}>
                  <span style={{ color: '#5C6B65', flexShrink: 0, fontFamily: 'monospace', fontSize: '10px' }}>{fmt(t.completed_at, lang)}</span>
                  <span>{t.task_description}</span>
                  <span style={{ color: '#5C6B65', marginLeft: 'auto', flexShrink: 0 }}>
                    {admissionDetails.careStaffNames.get(t.completed_by) ?? ''}
                  </span>
                </div>
              ))}
            </>
          )}

          {/* Discharge summary */}
          {admission.discharge_summary && (
            <>
              <SectionHeader lang={lang} fr="Résumé de sortie" en="Discharge Summary" />
              <p style={{ ...H.body, whiteSpace: 'pre-wrap' }}>{admission.discharge_summary}</p>
              {admission.discharge_outcome && (
                <p style={{ ...H.label, marginTop: '6px' }}>
                  Résultat / Outcome: {admission.discharge_outcome}
                </p>
              )}
              {(admission as any).discharged_by?.full_name && (
                <p style={{ ...H.label, marginTop: '4px' }}>
                  Sortie autorisée par / Authorized by: {(admission as any).discharged_by.full_name}
                </p>
              )}
            </>
          )}
        </>
      )}

      {/* ── Signature ── */}
      <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        {doctor && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '12px', margin: '0 0 40px', color: '#5C6B65' }}>
              {lang === 'fr' ? 'Signature du médecin' : "Doctor's signature"}
            </p>
            <div style={{ borderTop: '1px solid #16211E', paddingTop: '6px', minWidth: '180px' }}>
              <p style={{ fontSize: '13px', margin: 0 }}>{doctor.full_name}</p>
              {doctor.license_number && (
                <p style={{ fontSize: '11px', color: '#5C6B65', margin: '2px 0 0' }}>N° {doctor.license_number}</p>
              )}
            </div>
          </div>
        )}
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '10px', color: '#5C6B65', margin: 0 }}>
            Document généré électroniquement / Electronically generated · {clinic?.name}
          </p>
          <p style={{ fontSize: '10px', color: '#5C6B65', margin: '2px 0 0' }}>
            Visite / Visit: {visitId.slice(0, 8).toUpperCase()}
            {isHospitalised && admission ? ` · ${admission.admission_number}` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
