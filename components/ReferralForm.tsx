'use client'

// components/ReferralForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n/LangContext'
import { createReferralAction } from '@/lib/actions/referral'

const SPECIALTIES_FR = [
  'Cardiologie', 'Neurologie', 'Pneumologie', 'Gastro-entérologie',
  'Endocrinologie / Diabétologie', 'Néphrologie', 'Rhumatologie',
  'Dermatologie', 'Ophtalmologie', 'ORL', 'Urologie', 'Gynécologie',
  'Pédiatrie', 'Chirurgie générale', 'Orthopédie', 'Psychiatrie',
  'Oncologie', 'Hématologie', 'Infectiologie', 'Radiologie / Imagerie',
  'Autre spécialité',
]
const SPECIALTIES_EN = [
  'Cardiology', 'Neurology', 'Pulmonology', 'Gastroenterology',
  'Endocrinology / Diabetology', 'Nephrology', 'Rheumatology',
  'Dermatology', 'Ophthalmology', 'ENT', 'Urology', 'Gynaecology',
  'Paediatrics', 'General Surgery', 'Orthopaedics', 'Psychiatry',
  'Oncology', 'Haematology', 'Infectious Diseases', 'Radiology / Imaging',
  'Other specialty',
]

const STR = {
  fr: {
    title: 'Référer à un spécialiste',
    specialty: 'Spécialité *', specialtyPh: 'Choisir ou saisir…',
    specialist: 'Nom du spécialiste', specialistPh: 'ex. Dr. Mbarga Jean',
    facility: 'Établissement', facilityPh: 'ex. CHU Yaoundé, Clinique des Spécialistes',
    address: 'Adresse', addressPh: 'Optionnel',
    urgency: 'Urgence',
    routine: 'Routine', urgent: 'Urgent', emergency: 'Urgence médicale',
    reason: 'Motif de référence *', reasonPh: 'Pourquoi ce patient est référé…',
    summary: 'Résumé clinique', summaryPh: 'Antécédents pertinents, traitements en cours, résultats récents…',
    request: 'Demande spécifique', requestPh: 'Avis diagnostique, traitement, suivi à long terme…',
    cancel: 'Annuler',
    submit: 'Créer la lettre de référence',
    submitting: 'Création…',
    success: 'Référence créée — lettre disponible dans le dossier du patient.',
    printNow: 'Imprimer maintenant →',
  },
  en: {
    title: 'Refer to specialist',
    specialty: 'Specialty *', specialtyPh: 'Choose or type…',
    specialist: 'Specialist name', specialistPh: 'e.g. Dr. Jean Mbarga',
    facility: 'Facility', facilityPh: 'e.g. Yaoundé University Hospital',
    address: 'Address', addressPh: 'Optional',
    urgency: 'Urgency',
    routine: 'Routine', urgent: 'Urgent', emergency: 'Medical emergency',
    reason: 'Referral reason *', reasonPh: 'Why this patient is being referred…',
    summary: 'Clinical summary', summaryPh: 'Relevant history, current medications, recent results…',
    request: 'Specific request', requestPh: 'Diagnostic opinion, treatment, long-term follow-up…',
    cancel: 'Cancel',
    submit: 'Create referral letter',
    submitting: 'Creating…',
    success: 'Referral created — letter available in the patient record.',
    printNow: 'Print now →',
  },
} as const

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', fontSize: '13px',
  background: 'var(--color-bg)', color: 'var(--color-text-primary)',
}
const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px',
}

interface Props {
  visitId: string
  consultationId: string | null
  patientId: string
  onDone: () => void
}

export default function ReferralForm({ visitId, consultationId, patientId, onDone }: Props) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ referralId: string } | null>(null)
  const [specialtyInput, setSpecialtyInput] = useState('')
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine')

  const specialties = lang === 'fr' ? SPECIALTIES_FR : SPECIALTIES_EN

  async function handleSubmit(formData: FormData) {
    formData.set('visit_id', visitId)
    formData.set('patient_id', patientId)
    if (consultationId) formData.set('consultation_id', consultationId)
    formData.set('urgency', urgency)

    setError(null)
    setSubmitting(true)
    const result = await createReferralAction(formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else if (result?.success) {
      setDone({ referralId: result.referralId! })
      router.refresh()
    }
  }

  if (done) {
    return (
      <div style={{
        background: 'var(--color-success-bg)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '1rem', marginTop: '10px',
      }}>
        <p style={{ fontSize: '13px', color: 'var(--color-success-text)', margin: '0 0 10px' }}>
          ✓ {t.success}
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href={`/print/referral/${done.referralId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px', padding: '7px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
              textDecoration: 'none', border: 'none',
            }}
          >
            🖨 {t.printNow}
          </a>
          <button onClick={onDone} style={{
            fontSize: '12px', padding: '7px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-secondary)', cursor: 'pointer',
          }}>
            {t.cancel}
          </button>
        </div>
      </div>
    )
  }

  const URGENCY_OPTIONS = [
    { id: 'routine' as const, label: t.routine, color: 'var(--color-text-secondary)' },
    { id: 'urgent' as const, label: t.urgent, color: 'var(--color-warning-text)' },
    { id: 'emergency' as const, label: t.emergency, color: 'var(--color-critical-text)' },
  ]

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem', marginTop: '10px',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 12px' }}>{t.title}</p>
      <form action={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label style={labelStyle}>{t.specialty}</label>
            <input
              name="specialty" required list="specialties-list"
              value={specialtyInput} onChange={e => setSpecialtyInput(e.target.value)}
              placeholder={t.specialtyPh} style={inputStyle}
            />
            <datalist id="specialties-list">
              {specialties.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label style={labelStyle}>{t.specialist}</label>
            <input name="specialist_name" placeholder={t.specialistPh} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t.facility}</label>
            <input name="facility_name" placeholder={t.facilityPh} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t.address}</label>
            <input name="facility_address" placeholder={t.addressPh} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={labelStyle}>{t.urgency}</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {URGENCY_OPTIONS.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => setUrgency(o.id)}
                style={{
                  fontSize: '12px', padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${urgency === o.id ? o.color : 'var(--color-border)'}`,
                  background: urgency === o.id ? `color-mix(in srgb, ${o.color} 12%, transparent)` : 'transparent',
                  color: urgency === o.id ? o.color : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={labelStyle}>{t.reason}</label>
          <textarea name="reason" required rows={2} placeholder={t.reasonPh}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={labelStyle}>{t.summary}</label>
          <textarea name="clinical_summary" rows={3} placeholder={t.summaryPh}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>{t.request}</label>
          <textarea name="specific_request" rows={2} placeholder={t.requestPh}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {error && (
          <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '0 0 10px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" disabled={submitting} style={{
            fontSize: '12px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? t.submitting : t.submit}
          </button>
          <button type="button" onClick={onDone} style={{
            fontSize: '12px', padding: '8px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-secondary)', cursor: 'pointer',
          }}>
            {t.cancel}
          </button>
        </div>
      </form>
    </div>
  )
}
