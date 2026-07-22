// app/print/referral/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

const URGENCY_STYLE: Record<string, { fr: string; en: string; color: string }> = {
  routine:   { fr: 'Routine',           en: 'Routine',           color: '#2F6F62' },
  urgent:    { fr: 'URGENT',            en: 'URGENT',            color: '#D4840A' },
  emergency: { fr: 'URGENCE MÉDICALE',  en: 'MEDICAL EMERGENCY', color: '#C0392B' },
}

export default async function PrintReferralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })

  const { data: referral } = await supabase
    .from('external_referrals')
    .select(`
      id, specialty, specialist_name, facility_name, facility_address,
      urgency, reason, clinical_summary, specific_request, created_at,
      patients(full_name, patient_code, date_of_birth, estimated_age, sex, phone, allergies, chronic_conditions),
      staff!referred_by(full_name, license_number),
      clinics!clinic_id(name, city, quartier, phone)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!referral) notFound()

  const patient = referral.patients as any
  const doctor = (referral as any).staff
  const clinic = (referral as any).clinics
  const urgencyMeta = URGENCY_STYLE[referral.urgency] ?? URGENCY_STYLE.routine

  const L = {
    title: lang === 'fr' ? 'Lettre de référence' : 'Referral Letter',
    to: lang === 'fr' ? 'À' : 'To',
    from: lang === 'fr' ? 'De' : 'From',
    patient: lang === 'fr' ? 'Patient' : 'Patient',
    name: lang === 'fr' ? 'Nom' : 'Name',
    code: lang === 'fr' ? 'Code' : 'Code',
    dob: lang === 'fr' ? 'Né(e) le' : 'DOB',
    age: lang === 'fr' ? 'Âge' : 'Age',
    yrs: lang === 'fr' ? 'ans' : 'yrs',
    sex: lang === 'fr' ? 'Sexe' : 'Sex',
    phone: lang === 'fr' ? 'Tél' : 'Phone',
    history: lang === 'fr' ? 'ATCD' : 'History',
    reason: lang === 'fr' ? 'Motif de référence' : 'Reason for Referral',
    clinicalSummary: lang === 'fr' ? 'Résumé clinique' : 'Clinical Summary',
    specificRequest: lang === 'fr' ? 'Demande spécifique' : 'Specific Request',
    closing: lang === 'fr'
      ? 'Nous vous remercions de bien vouloir recevoir notre patient et de nous faire part de vos conclusions.'
      : 'We thank you for seeing our patient and look forward to your findings.',
    signature: lang === 'fr' ? 'Signature du médecin référent' : "Referring doctor's signature",
    ref: lang === 'fr' ? 'Réf.' : 'Ref.',
    no: lang === 'fr' ? 'N°' : 'No.',
  }

  return (
    <div style={{ fontFamily: 'Georgia, serif', color: '#1a2820', maxWidth: '680px', margin: '0 auto', padding: '0 16px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '3px solid #2F6F62', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{clinic?.name}</h1>
          <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
            {clinic?.quartier}, {clinic?.city}{clinic?.phone ? ` · ${clinic.phone}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#2F6F62' }}>
            {L.title}
          </p>
          <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
            {fmtDate(referral.created_at)}
          </p>
          {referral.urgency !== 'routine' && (
            <p style={{ fontSize: '13px', fontWeight: 700, color: urgencyMeta.color, margin: '6px 0 0' }}>
              ⚠ {urgencyMeta[lang]}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div style={{ background: '#F4F7F5', padding: '12px 14px', borderRadius: '6px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5C6B65', margin: '0 0 6px' }}>
            {L.to}
          </p>
          <p style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>
            {referral.specialist_name ? referral.specialist_name : referral.specialty}
          </p>
          {referral.specialist_name && (
            <p style={{ fontSize: '13px', color: '#5C6B65', margin: '0 0 2px' }}>
              {referral.specialty}
            </p>
          )}
          {referral.facility_name && (
            <p style={{ fontSize: '13px', margin: '4px 0 0' }}>{referral.facility_name}</p>
          )}
          {referral.facility_address && (
            <p style={{ fontSize: '12px', color: '#5C6B65', margin: '2px 0 0' }}>{referral.facility_address}</p>
          )}
        </div>
        <div style={{ background: '#F4F7F5', padding: '12px 14px', borderRadius: '6px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5C6B65', margin: '0 0 6px' }}>
            {L.from}
          </p>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Dr. {doctor?.full_name}</p>
          {doctor?.license_number && (
            <p style={{ fontSize: '12px', color: '#5C6B65', margin: '2px 0 0' }}>{L.no} {doctor.license_number}</p>
          )}
          <p style={{ fontSize: '13px', margin: '4px 0 0' }}>{clinic?.name}</p>
        </div>
      </div>

      <div style={{ border: '1px solid #DCE3DE', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5C6B65', margin: '0 0 8px' }}>
          {L.patient}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', fontSize: '13px' }}>
          <div><span style={{ color: '#5C6B65' }}>{L.name}: </span><strong>{patient?.full_name}</strong></div>
          <div><span style={{ color: '#5C6B65' }}>{L.code}: </span><span style={{ fontFamily: 'monospace' }}>{patient?.patient_code}</span></div>
          {patient?.date_of_birth && (
            <div><span style={{ color: '#5C6B65' }}>{L.dob}: </span>{new Date(patient.date_of_birth).toLocaleDateString(locale)}</div>
          )}
          {!patient?.date_of_birth && patient?.estimated_age && (
            <div><span style={{ color: '#5C6B65' }}>{L.age}: </span>{patient.estimated_age} {L.yrs}</div>
          )}
          {patient?.sex && <div><span style={{ color: '#5C6B65' }}>{L.sex}: </span>{patient.sex}</div>}
          {patient?.phone && <div><span style={{ color: '#5C6B65' }}>{L.phone}: </span>{patient.phone}</div>}
        </div>
        {(patient?.allergies || patient?.chronic_conditions) && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #DCE3DE', fontSize: '12px' }}>
            {patient.allergies && (
              <p style={{ color: '#C0392B', margin: '0 0 2px' }}>⚠ Allergies: {patient.allergies}</p>
            )}
            {patient.chronic_conditions && (
              <p style={{ color: '#5C6B65', margin: 0 }}>{L.history}: {patient.chronic_conditions}</p>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#2F6F62', borderBottom: '1.5px solid #2F6F62', paddingBottom: '4px', margin: '0 0 10px' }}>
          {L.reason}
        </p>
        <p style={{ fontSize: '13px', lineHeight: '1.65', margin: 0, whiteSpace: 'pre-wrap' }}>{referral.reason}</p>
      </div>

      {referral.clinical_summary && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#2F6F62', borderBottom: '1.5px solid #2F6F62', paddingBottom: '4px', margin: '0 0 10px' }}>
            {L.clinicalSummary}
          </p>
          <p style={{ fontSize: '13px', lineHeight: '1.65', margin: 0, whiteSpace: 'pre-wrap' }}>{referral.clinical_summary}</p>
        </div>
      )}

      {referral.specific_request && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#2F6F62', borderBottom: '1.5px solid #2F6F62', paddingBottom: '4px', margin: '0 0 10px' }}>
            {L.specificRequest}
          </p>
          <p style={{ fontSize: '13px', lineHeight: '1.65', margin: 0, whiteSpace: 'pre-wrap' }}>{referral.specific_request}</p>
        </div>
      )}

      <p style={{ fontSize: '13px', margin: '24px 0', fontStyle: 'italic', color: '#5C6B65' }}>
        {L.closing}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '48px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '12px', margin: '0 0 40px', color: '#5C6B65' }}>
            {L.signature}
          </p>
          <div style={{ borderTop: '1px solid #1a2820', paddingTop: '6px', minWidth: '200px' }}>
            <p style={{ fontSize: '13px', margin: 0 }}>Dr. {doctor?.full_name}</p>
            {doctor?.license_number && (
              <p style={{ fontSize: '11px', color: '#5C6B65', margin: '2px 0 0' }}>{L.no} {doctor.license_number}</p>
            )}
          </div>
        </div>
        <p style={{ fontSize: '10px', color: '#5C6B65', textAlign: 'right' }}>
          {clinic?.name} · {L.ref} {id.slice(0, 8).toUpperCase()}
        </p>
      </div>
    </div>
  )
}
