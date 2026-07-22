// app/print/admissions/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

const DISCHARGE_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  routine: { fr: 'Routine', en: 'Routine' },
  transfer_out: { fr: 'Transfert', en: 'Transfer to another facility' },
  against_medical_advice: { fr: 'Contre avis médical', en: 'Against medical advice' },
  deceased: { fr: 'Décès', en: 'Deceased' },
}

export default async function PrintDischargeSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const { data: admission, error } = await supabase
    .from('admissions')
    .select(`
      admission_number, admission_reason, recommended_at, bed_assigned_at, discharged_at, discharged_by,
      discharge_summary, discharge_type, discharge_outcome,
      clinics(name, city, quartier, phone),
      patients(full_name, patient_code, date_of_birth),
      wards(name), beds(bed_number)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !admission) notFound()

  const clinic = admission.clinics as any
  const patient = admission.patients as any
  const ward = admission.wards as any
  const bed = admission.beds as any

  let dischargedByName = '—'
  if (admission.discharged_by) {
    const { data: dischargedByStaff } = await supabase.from('staff').select('full_name').eq('id', admission.discharged_by).maybeSingle()
    dischargedByName = dischargedByStaff?.full_name ?? '—'
  }

  const { data: notes } = await supabase
    .from('inpatient_notes')
    .select('note, recorded_at, recorded_by')
    .eq('admission_id', id)
    .order('recorded_at', { ascending: true })

  const noteStaffIds = [...new Set((notes ?? []).map((n) => n.recorded_by).filter(Boolean))]
  const { data: noteStaff } = noteStaffIds.length > 0
    ? await supabase.from('staff').select('id, full_name').in('id', noteStaffIds)
    : { data: [] }
  const noteStaffNameById = new Map((noteStaff ?? []).map((s) => [s.id, s.full_name]))

  const L = {
    title: lang === 'fr' ? 'Résumé de sortie' : 'Discharge Summary',
    dob: lang === 'fr' ? 'Né(e) le' : 'DOB',
    wardBed: lang === 'fr' ? 'Service / Lit' : 'Ward / Bed',
    bed: lang === 'fr' ? 'Lit' : 'Bed',
    admitted: lang === 'fr' ? 'Admis le' : 'Admitted',
    discharged: lang === 'fr' ? 'Sorti le' : 'Discharged',
    dischargeType: lang === 'fr' ? 'Type de sortie' : 'Discharge type',
    outcome: lang === 'fr' ? 'Résultat' : 'Outcome',
    reasonForAdmission: lang === 'fr' ? "Motif d'admission" : 'Reason for admission',
    dischargeSummary: lang === 'fr' ? 'Résumé de sortie' : 'Discharge summary',
    followUpNotes: lang === 'fr' ? 'Journal de suivi' : 'Follow-up notes',
    authorizedBy: lang === 'fr' ? 'Sortie autorisée par' : 'Discharge authorized by',
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid #16211E', paddingBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{clinic?.name}</h1>
        <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
          {clinic?.quartier}, {clinic?.city}{clinic?.phone ? ` · ${clinic.phone}` : ''}
        </p>
        <p style={{ fontSize: '13px', margin: '10px 0 0' }}>{L.title} — {admission.admission_number}</p>
      </div>

      <p style={{ fontSize: '14px', margin: '0 0 4px' }}><strong>{patient?.full_name}</strong> — {patient?.patient_code}</p>
      {patient?.date_of_birth && <p style={{ fontSize: '12px', color: '#5C6B65', margin: '0 0 16px' }}>{L.dob}: {new Date(patient.date_of_birth).toLocaleDateString(locale)}</p>}

      <table style={{ width: '100%', fontSize: '13px', marginBottom: '16px', borderCollapse: 'collapse' }}>
        <tbody>
          <tr><td style={{ padding: '4px 0', color: '#5C6B65' }}>{L.wardBed}</td><td>{ward?.name} — {L.bed} {bed?.bed_number}</td></tr>
          <tr><td style={{ padding: '4px 0', color: '#5C6B65' }}>{L.admitted}</td><td>{new Date(admission.recommended_at).toLocaleString(locale)}</td></tr>
          <tr><td style={{ padding: '4px 0', color: '#5C6B65' }}>{L.discharged}</td><td>{admission.discharged_at ? new Date(admission.discharged_at).toLocaleString(locale) : '—'}</td></tr>
          <tr><td style={{ padding: '4px 0', color: '#5C6B65' }}>{L.dischargeType}</td><td>{DISCHARGE_TYPE_LABELS[admission.discharge_type ?? '']?.[lang] ?? admission.discharge_type}</td></tr>
          {admission.discharge_outcome && <tr><td style={{ padding: '4px 0', color: '#5C6B65' }}>{L.outcome}</td><td>{admission.discharge_outcome}</td></tr>}
        </tbody>
      </table>

      {admission.admission_reason && (
        <>
          <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }}>{L.reasonForAdmission}</p>
          <p style={{ fontSize: '13px', margin: '0 0 16px' }}>{admission.admission_reason}</p>
        </>
      )}

      <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }}>{L.dischargeSummary}</p>
      <p style={{ fontSize: '13px', margin: '0 0 16px' }}>{admission.discharge_summary}</p>

      {notes && notes.length > 0 && (
        <>
          <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 8px' }}>{L.followUpNotes}</p>
          {notes.map((n: any, i: number) => (
            <p key={i} style={{ fontSize: '12px', margin: '0 0 6px' }}>
              <span style={{ color: '#5C6B65' }}>{new Date(n.recorded_at).toLocaleDateString(locale)} — {noteStaffNameById.get(n.recorded_by) ?? '—'} :</span> {n.note}
            </p>
          ))}
        </>
      )}

      <p style={{ fontSize: '12px', color: '#5C6B65', marginTop: '30px' }}>
        {L.authorizedBy}: {dischargedByName}
      </p>
    </div>
  )
}
