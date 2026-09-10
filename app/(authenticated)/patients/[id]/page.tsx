// app/(authenticated)/patients/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { formatAgeDisplay } from '@/lib/utils/age'
import CheckInPanel from '@/components/CheckInPanel'
import WhatsAppSummaryButton from '@/components/WhatsAppSummaryButton'

export default async function PatientDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ appointment_id?: string }> }) {
  const { id } = await params
  const { appointment_id: appointmentIdParam } = await searchParams
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const VISIT_STATUS_LABELS_FR: Record<string, string> = { registered: 'En attente de paiement', triage: 'Triage', waiting_consultation: 'En attente de consultation', in_consultation: 'En consultation', waiting_lab: 'En attente de laboratoire', waiting_pharmacy: 'En attente de pharmacie', billing: 'Facturation', discharged: 'Sorti(e)', admitted: 'Hospitalisé(e)', cancelled: 'Annulé' }
  const supabase = await createClient()
  const { data: clinicRow } = await supabase.from('clinics').select('name').eq('id', staff.clinicId).maybeSingle()
  const clinicName = clinicRow?.name ?? 'TotalCare'
  const { data: patient, error } = await supabase.from('patients').select('*').eq('id', id).maybeSingle()
  if (error || !patient) notFound()

  const { data: activeVisit } = await supabase.from('visits').select('id, status, visit_reason, created_at, is_emergency').eq('patient_id', id).not('status', 'in', '(discharged,cancelled)').order('created_at', { ascending: false }).limit(1).maybeSingle()
  let appointmentForCheckIn: { id: string; service_price_id: string | null; doctor_id: string | null; reason: string | null } | null = null
  if (appointmentIdParam && !activeVisit) {
    const { data: appt } = await supabase.from('appointments').select('id, service_price_id, doctor_id, reason, status, patient_id').eq('id', appointmentIdParam).eq('patient_id', id).eq('status', 'scheduled').maybeSingle()
    if (appt) appointmentForCheckIn = { id: appt.id, service_price_id: appt.service_price_id, doctor_id: appt.doctor_id, reason: appt.reason }
  }

  let pendingCharge: { id: string; amount_xaf: number; amount_paid_xaf: number; status: string } | null = null
  let pendingInvoiceId: string | null = null
  if (activeVisit?.status === 'registered' && !activeVisit.is_emergency) {
    const { data: charge } = await supabase.from('service_charges').select('id, amount_xaf, amount_paid_xaf, status').eq('visit_id', activeVisit.id).eq('category', 'consultation').neq('status', 'void').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (charge) { pendingCharge = charge; const { data: invoice } = await supabase.from('invoices').select('id').eq('visit_id', activeVisit.id).limit(1).maybeSingle(); pendingInvoiceId = invoice?.id ?? null }
  }

  let consultationTypes: { id: string; service_name: string; price_xaf: number }[] = []
  let doctors: { id: string; full_name: string }[] = []
  if (!activeVisit) {
    const { data: prices } = await supabase.from('service_prices').select('id, service_name, price_xaf').eq('category', 'consultation').eq('is_active', true).order('price_xaf', { ascending: true }); consultationTypes = prices ?? []
    const { data: doctorList } = await supabase.from('staff').select('id, full_name').eq('clinic_id', staff.clinicId).eq('role', 'doctor').eq('is_active', true).order('full_name'); doctors = doctorList ?? []
  }

  const { data: patientVisitIds } = await supabase.from('visits').select('id').eq('patient_id', id)
  const visitIdList = (patientVisitIds ?? []).map(v => v.id)
  const { data: prescriptionHistory } = visitIdList.length ? await supabase.from('prescriptions').select('id, created_at, visits(visit_reason)').in('visit_id', visitIdList).order('created_at', { ascending: false }) : { data: [] }
  // Include signed_at so the patient chart can route signed and unsigned notes through the same clinical-note screen.
  const { data: consultationHistory } = visitIdList.length ? await supabase.from('consultations').select('id, started_at, completed_at, diagnosis, treatment_plan, visit_id, signed_at').in('visit_id', visitIdList).order('started_at', { ascending: false }) : { data: [] }
  const consultationIds = (consultationHistory ?? []).map((c: any) => c.id)
  const { data: rxRows } = consultationIds.length ? await supabase.from('prescriptions').select('consultation_id, prescription_items(dose, frequency, duration_days, instructions, products(name), drug_name_freetext)').in('consultation_id', consultationIds) : { data: [] }
  const rxByConsultation = new Map<string, any[]>()
  for (const p of (rxRows ?? [])) { const items = ((p as any).prescription_items ?? []).map((it: any) => ({ name: it.products?.name ?? it.drug_name_freetext ?? '—', dose: it.dose, frequency: it.frequency, durationDays: it.duration_days, instructions: it.instructions })); const existing = rxByConsultation.get((p as any).consultation_id) ?? []; rxByConsultation.set((p as any).consultation_id, [...existing, ...items]) }
  const { data: labOrderHistory } = visitIdList.length ? await supabase.from('lab_orders').select('id, ordered_at').in('visit_id', visitIdList).order('ordered_at', { ascending: false }) : { data: [] }
  const { data: referralHistory } = visitIdList.length ? await supabase.from('external_referrals').select('id, specialty, specialist_name, facility_name, urgency, created_at').in('visit_id', visitIdList).order('created_at', { ascending: false }) : { data: [] }
  const row = (label: string, value: string | number | null | undefined) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}><span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{label}</span><span style={{ fontSize: '13px' }}>{value || '—'}</span></div>
  const ageDisplay = formatAgeDisplay(patient.date_of_birth, patient.estimated_age, patient.estimated_age_recorded_at, 'fr')

  return <div style={{ maxWidth: '520px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}><Link href="/patients" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link><div><h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{patient.full_name}</h1><p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>{patient.patient_code}</p></div></div>
    {patient.allergies && <div style={{ background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px', fontWeight: 500 }}>⚠ Allergies : {patient.allergies}</div>}
    <CheckInPanel patientId={id} activeVisit={activeVisit ?? null} pendingCharge={pendingCharge} pendingInvoiceId={pendingInvoiceId} consultationTypes={consultationTypes} doctors={doctors} statusLabel={activeVisit ? (VISIT_STATUS_LABELS_FR[activeVisit.status] ?? activeVisit.status) : ''} appointment={appointmentForCheckIn} />
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 1rem' }}>{row('Sexe', patient.sex)}{row('Âge', ageDisplay)}{row('Date de naissance', patient.date_of_birth)}{row('CNI', patient.national_id_number)}{row(lang==='fr'?'Téléphone':'Phone', patient.phone)}{row('Quartier', patient.quartier)}{row('Ville', patient.city)}{row(lang==='fr'?'Personne à contacter':'Emergency contact', patient.next_of_kin_name)}{row(lang==='fr'?'Téléphone contact':'Contact phone', patient.next_of_kin_phone)}{row('Allergies', patient.allergies)}{row('Maladies chroniques', patient.chronic_conditions)}{row(lang==='fr'?'Catégorie de paiement':'Payment category', ({ cash: 'Comptant / Cash', employer_scheme: 'Régime employeur / Employer scheme', private_insurance: 'Assurance privée / Private insurance' } as Record<string,string>)[patient.payment_category as string] ?? patient.payment_category)}{patient.status !== 'active' && row('Statut', patient.status === 'deceased' ? (lang==='fr'?'Décédé(e)':'Deceased') : (lang==='fr'?'Inactif':'Inactive'))}</div>
    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '1.25rem 0 8px' }}>Consultations</p>
    {(!consultationHistory || !consultationHistory.length) && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucune consultation terminée.':'No completed consultations.'}</p>}
    {!!consultationHistory?.length && <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>{consultationHistory.map((c: any, i: number) => { const label = c.signed_at ? (lang === 'fr' ? '🔒 Voir SOAP →' : '🔒 View SOAP →') : (lang === 'fr' ? '📝 Modifier SOAP →' : '📝 Edit SOAP →'); return <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < consultationHistory.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}><span style={{ fontSize: '13px' }}>{new Date(c.started_at).toLocaleDateString(locale)}{c.diagnosis ? ` · ${c.diagnosis}` : ''}{!c.completed_at && <span style={{ fontSize: '10px', marginLeft: '8px', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>en cours</span>}</span><div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}><Link href={`/visits/${c.visit_id}/consultation-note`} style={{ fontSize: '12px', color: c.signed_at ? 'var(--color-text-secondary)' : 'var(--color-accent)', fontWeight: c.signed_at ? 400 : 500 }}>{label}</Link><a href={`/print/clinical-summary/${c.visit_id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--color-accent)', fontWeight: 500 }}>🖨 {lang === 'fr' ? 'Dossier complet' : 'Full record'} →</a><a href={`/print/visit-statement/${c.visit_id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--color-accent)', fontWeight: 500 }}>🧾 {lang === 'fr' ? 'Relevé de visite' : 'Visit statement'} →</a>{c.completed_at && <WhatsAppSummaryButton compact patientPhone={patient.phone} patientName={patient.full_name} clinicName={clinicName} visitDate={new Date(c.started_at).toLocaleDateString(locale)} diagnosis={c.diagnosis} followUp={c.treatment_plan} prescriptions={rxByConsultation.get(c.id) ?? []} />}</div></div> })}</div>}
    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>Ordonnances</p>{(!prescriptionHistory || !prescriptionHistory.length) && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucune ordonnance.' : 'No prescriptions.'}</p>}
    {prescriptionHistory && prescriptionHistory.length > 0 && <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>{prescriptionHistory.map((rx: any, i: number) => <div key={rx.id ?? i} style={{ padding: '10px 14px', borderBottom: i < prescriptionHistory.length - 1 ? '1px solid var(--color-border-subtle)' : 'none', fontSize: '13px' }}>{new Date(rx.created_at).toLocaleDateString(locale)} · Prescription</div>)}</div>}
    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>Laboratoire</p>{(!labOrderHistory || !labOrderHistory.length) && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Aucune demande de laboratoire.</p>}
    {labOrderHistory && labOrderHistory.length > 0 && <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>{labOrderHistory.map((l: any, i: number) => <div key={l.id} style={{ padding: '10px 14px', borderBottom: i < labOrderHistory.length - 1 ? '1px solid var(--color-border-subtle)' : 'none', fontSize: '13px' }}>{new Date(l.ordered_at).toLocaleDateString(locale)} · Laboratory order</div>)}</div>}
    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>Références</p>{(!referralHistory || !referralHistory.length) && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Aucune référence.</p>}
    {referralHistory && referralHistory.length > 0 && <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>{referralHistory.map((r: any, i: number) => <div key={r.id} style={{ padding: '10px 14px', borderBottom: i < referralHistory.length - 1 ? '1px solid var(--color-border-subtle)' : 'none', fontSize: '13px' }}>{new Date(r.created_at).toLocaleDateString(locale)} · {r.specialty ?? 'Referral'}</div>)}</div>}
  </div>
}
