// app/(authenticated)/visits/[id]/consultation/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import ConsultationForm from '@/components/ConsultationForm'

const VITAL_LABELS: Record<string, string> = {
  systolic_bp: 'Tension systolique / Systolic BP',
  diastolic_bp: 'Tension diastolique / Diastolic BP',
  pulse: 'Pouls / Pulse',
  temperature: 'Température / Temperature',
  spo2: 'SpO2',
  weight_kg: 'Poids / Weight (kg)',
  height_cm: 'Taille / Height (cm)',
  respiratory_rate: 'Fréq. respiratoire / Resp. rate',
}

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: visit, error } = await supabase
    .from('visits')
    .select('id, clinic_id, status, visit_reason, is_emergency, patient_id, patients(id, full_name, patient_code, allergies)')
    .eq('id', id)
    .maybeSingle()

  if (error || !visit) {
    notFound()
  }

  if (!['waiting_consultation', 'in_consultation'].includes(visit.status)) {
    return (
      <div>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          Cette visite n'est pas (ou plus) au stade de la consultation.
        </p>
        <Link href="/dashboard" style={{ fontSize: '13px', color: 'var(--color-accent)' }}>
          {lang==='fr'?"Retour à la file d'attente":'Back to queue'}
        </Link>
      </div>
    )
  }

  // Opening this screen IS starting the consultation, if not already started.
  let consultationId: string
  if (visit.status === 'waiting_consultation') {
    const { data: newConsultationId, error: startError } = await supabase.rpc('start_consultation', {
      p_visit_id: id,
      p_doctor_id: staff.staffId,
    })
    if (startError || !newConsultationId) {
      // A common real cause here: another doctor's request won the race
      // to start this exact consultation a moment earlier. That's a
      // correct outcome, not a bug — say so plainly instead of a generic
      // failure message.
      return (
        <div>
          <p style={{ fontSize: '14px', color: 'var(--color-critical-text)' }}>
            {lang==='fr'?"Impossible de démarrer cette consultation — un autre médecin l'a peut-être déjà prise en charge.":'Cannot start this consultation — another doctor may have already taken it.'}
          </p>
          <Link href="/doctor" style={{ fontSize: '13px', color: 'var(--color-accent)' }}>
            {lang==='fr'?"Retour à ma file d'attente":'Back to my queue'}
          </Link>
        </div>
      )
    }
    consultationId = newConsultationId
  } else {
    // THE OWNERSHIP CHECK: this visit is already in_consultation — verify
    // it's actually assigned to the doctor viewing it before rendering
    // anything. This is the real enforcement point, regardless of which
    // queue (Doctor, Dashboard) linked here.
    const { data: isOwner } = await supabase.rpc('is_assigned_doctor_for_visit', {
      p_visit_id: id,
      p_staff_id: staff.staffId,
    })

    if (!isOwner && staff.role !== 'admin') {
      return (
        <div>
          <p style={{ fontSize: '14px', color: 'var(--color-critical-text)' }}>
            {lang==='fr'?'Ce patient est actuellement en consultation avec un autre médecin.':'This patient is currently in consultation with another doctor.'}
          </p>
          <Link href="/doctor" style={{ fontSize: '13px', color: 'var(--color-accent)' }}>
            Retour à ma file d'attente
          </Link>
        </div>
      )
    }

    const { data: existing } = await supabase
      .from('consultations')
      .select('id')
      .eq('visit_id', id)
      .is('completed_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!existing) {
      return <p style={{ color: 'var(--color-critical-text)' }}>Consultation introuvable pour cette visite.</p>
    }
    consultationId = existing.id
  }

  // Whether newly created or reopened, fetch whatever's actually saved
  // on this consultation row — the fix for the SOAP-reset bug means this
  // may already have real content from before the lab order.
  const { data: consultationData } = await supabase
    .from('consultations')
    .select('subjective_notes, examination_notes, diagnosis, diagnosis_code, treatment_plan')
    .eq('id', consultationId)
    .single()

  const patient = visit.patients as any

  const { data: triageAssessment } = await supabase
    .from('triage_assessments')
    .select('chief_complaint, medical_history, social_history')
    .eq('visit_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: latestVitals } = await supabase
    .from('vitals')
    .select('systolic_bp, diastolic_bp, pulse, temperature, spo2, flags')
    .eq('visit_id', id)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // THE CONTINUITY-OF-CARE FIX: past visits for this patient, with their
  // diagnoses, so the doctor isn't deciding blind. This was flagged
  // explicitly in the architecture review as a real gap, not cosmetic.
  const { data: pastVisits } = await supabase
    .from('visits')
    .select('id, created_at, visit_reason, consultations(diagnosis, treatment_plan)')
    .eq('patient_id', visit.patient_id)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: products } = await supabase
    .rpc('get_products_with_stock', { p_clinic_id: visit.clinic_id })

  const { data: templates } = await supabase
    .from('consultation_templates')
    .select('id, category, name_fr, name_en, age_group_label, subjective_prompt, subjective_prompt_en, objective_prompt, objective_prompt_en, assessment_prompt, assessment_prompt_en, plan_prompt, plan_prompt_en, suggested_icd10_code')
    .eq('is_active', true)
    .order('category')

  const { data: icd10Codes } = await supabase
    .from('icd10_codes')
    .select('code, description_fr, category')
    .order('category')
    .order('description_fr')

  const { data: availablePanels } = await supabase
    .from('clinic_lab_panels')
    .select('lab_panel_id, price_xaf, lab_panels(name_fr, name_en, category)')
    .eq('clinic_id', visit.clinic_id)
    .eq('is_active', true)

  const { data: availableTests } = await supabase
    .from('clinic_lab_tests')
    .select('lab_test_catalog_id, price_xaf, lab_test_catalog(name_fr, name_en, category)')
    .eq('clinic_id', visit.clinic_id)
    .eq('is_active', true)

  // Existing lab orders/results for THIS visit — what the doctor sees
  // when returning to a patient after labs come back.
  const { data: labOrders } = await supabase
    .from('lab_orders')
    .select('id, lab_order_items(id, item_type, status, lab_panel_id, lab_test_catalog_id, external_test_name)')
    .eq('visit_id', id)

  const labOrderItemIds = (labOrders ?? []).flatMap((o) => o.lab_order_items.map((i: any) => i.id))

  const { data: labResults } = labOrderItemIds.length > 0
    ? await supabase
        .from('lab_results')
        .select('id, lab_order_item_id, lab_test_catalog_id, numeric_value, qualitative_value, is_abnormal, is_critical, verified_at, lab_test_catalog(name_fr, name_en, unit)')
        .in('lab_order_item_id', labOrderItemIds)
    : { data: [] }

  const { data: labAttachments } = labOrderItemIds.length > 0
    ? await supabase
        .from('lab_result_attachments')
        .select('id, lab_order_item_id, file_path')
        .in('lab_order_item_id', labOrderItemIds)
    : { data: [] }

  // Private bucket — attachments need a signed URL to be viewable at all,
  // a plain public path would just 404 or (worse) require making the
  // bucket public, defeating the patient-data privacy point of it.
  const attachmentsWithUrls = await Promise.all(
    (labAttachments ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage
        .from('lab-attachments')
        .createSignedUrl(a.file_path, 60 * 10) // 10 minutes — long enough to view, not a permanent link
      return { ...a, signedUrl: signed?.signedUrl ?? null }
    })
  )

  const flags = (latestVitals?.flags as any[]) ?? []

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/dashboard" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>
              Consultation — {patient?.full_name}
              {visit.is_emergency && (
                <span style={{
                  fontSize: '11px', marginLeft: '8px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', verticalAlign: 'middle',
                }}>
                  URGENCE
                </span>
              )}
            </h1>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              {patient?.patient_code}
            </p>
          </div>
        </div>
        <a
          href={`/print/clinical-summary/${id}`}
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
        <div style={{
          background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '10px', fontSize: '13px', fontWeight: 500,
        }}>
          ⚠ Allergies : {patient.allergies}
        </div>
      )}

      {flags.length > 0 && (
        <div style={{
          background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '10px', fontSize: '13px',
        }}>
          {flags.map((f, i) => <div key={i}>{f.severity === 'critical' ? '⚠ ' : ''}{f.message_fr}</div>)}
        </div>
      )}

      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem',
      }}>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 6px' }}>{lang === 'fr' ? 'Évaluation infirmière' : 'Nursing assessment'}</p>
        <p style={{ fontSize: '13px', margin: '0 0 4px' }}>
          <strong>{lang === 'fr' ? 'Motif :' : 'Reason:'}</strong> {triageAssessment?.chief_complaint || '—'}
        </p>
        {triageAssessment?.medical_history && (
          <p style={{ fontSize: '13px', margin: '0 0 4px' }}><strong>{lang === 'fr' ? 'Antécédents :' : 'History:'}</strong> {triageAssessment.medical_history}</p>
        )}
        {triageAssessment?.social_history && (
          <p style={{ fontSize: '13px', margin: 0 }}><strong>{lang === 'fr' ? 'Contexte social :' : 'Social context:'}</strong> {triageAssessment.social_history}</p>
        )}
        {latestVitals && (
          <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
            {Object.entries(VITAL_LABELS).map(([key, label]) => (
              (latestVitals as any)[key] != null && (
                <span key={key} style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {label}: <strong style={{ color: 'var(--color-text-primary)' }}>{(latestVitals as any)[key]}</strong>
                </span>
              )
            ))}
          </div>
        )}
      </div>

      {/* Lab results for this visit — critical flags always shown regardless
          of verification status, per the design decision from the Lab module:
          a dangerous value shouldn't wait on a bureaucratic verification step. */}
      {(labResults && labResults.length > 0) || attachmentsWithUrls.length > 0 ? (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
            Résultats de laboratoire
            {(labOrders ?? []).map((o: any) => (
              <a key={o.id} href={`/print/lab-orders/${o.id}`} target="_blank" rel="noopener noreferrer"
                 style={{ fontSize: '11px', color: 'var(--color-accent)', marginLeft: '10px' }}>
                Imprimer le rapport →
              </a>
            ))}
          </p>
          {(labResults ?? []).map((r: any) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
              <span>
                {(lang === 'en' && r.lab_test_catalog?.name_en) ? r.lab_test_catalog.name_en : r.lab_test_catalog?.name_fr}: <strong>{r.numeric_value ?? r.qualitative_value}</strong>
                {r.lab_test_catalog?.unit ? ` ${r.lab_test_catalog.unit}` : ''}
              </span>
              <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {r.is_critical && (
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)' }}>
                    CRITIQUE
                  </span>
                )}
                {r.is_abnormal && !r.is_critical && (
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>
                    Anormal
                  </span>
                )}
                {!r.verified_at && (
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>(non validé)</span>
                )}
              </span>
            </div>
          ))}
          {attachmentsWithUrls.map((a) => a.signedUrl && (
            <div key={a.id} style={{ padding: '4px 0' }}>
              <a href={a.signedUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--color-accent)' }}>
                📎 Voir le fichier joint (résultat imprimé)
              </a>
            </div>
          ))}
        </div>
      ) : null}

      {/* Past visit history — the continuity-of-care fix */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem',
      }}>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
          {lang === 'fr' ? 'Visites précédentes' : 'Previous visits'}
        </p>
        {(!pastVisits || pastVisits.length === 0) && (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {lang === 'fr' ? 'Aucune visite antérieure.' : 'No previous visits.'}
          </p>
        )}
        {pastVisits && pastVisits.length > 0 && pastVisits.map((v: any) => (
          <div key={v.id} style={{ fontSize: '13px', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {new Date(v.created_at).toLocaleDateString(lang==='fr'?'fr-FR':'en-US')}
            </span>
            {' — '}
            {v.consultations?.[0]?.diagnosis || v.visit_reason || 'Sans diagnostic enregistré'}
          </div>
        ))}
      </div>

      <ConsultationForm
        visitId={id}
        consultationId={consultationId}
        patientId={visit.patient_id}
        products={(products ?? []).map((p: any) => ({
          id: p.product_id,
          name: p.name,
          dosageForm: p.dosage_form ?? null,
          isAntibiotic: p.is_antibiotic ?? false,
          onHand: p.on_hand ?? 0,
          drugClassName: (lang === 'en' && p.drug_classes?.name_en) ? p.drug_classes.name_en : (p.drug_class_name ?? null),
        }))}
        patientAllergies={patient?.allergies ?? null}
        templates={templates ?? []}
        icd10Codes={icd10Codes ?? []}
        availablePanels={(availablePanels ?? []).map((p: any) => ({ id: p.lab_panel_id, name: lang === 'en' && p.lab_panels.name_en ? p.lab_panels.name_en : p.lab_panels.name_fr, category: p.lab_panels.category }))}
        availableTests={(availableTests ?? []).map((t: any) => ({ id: t.lab_test_catalog_id, name: lang === 'en' && t.lab_test_catalog.name_en ? t.lab_test_catalog.name_en : t.lab_test_catalog.name_fr, category: t.lab_test_catalog.category }))}
        initialValues={{
          subjective: consultationData?.subjective_notes ?? '',
          objective: consultationData?.examination_notes ?? '',
          diagnosis: consultationData?.diagnosis ?? '',
          diagnosisCode: consultationData?.diagnosis_code ?? '',
          treatmentPlan: consultationData?.treatment_plan ?? '',
        }}
      />
    </div>
  )
}
