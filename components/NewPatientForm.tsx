'use client'

// components/NewPatientForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPatient } from '@/lib/actions/patients'
import { useLang } from '@/lib/i18n/LangContext'

interface Insurer { id: string; name: string; payer_type: string }

const STR = {
  fr: {
    title: 'Nouveau patient',
    fullName: 'Nom complet *',
    sex: 'Sexe', female: 'Féminin', male: 'Masculin',
    payCat: 'Catégorie de paiement', cash: 'Comptant', employer: 'Régime employeur', privateIns: 'Assurance privée',
    coverageInfo: 'Informations de couverture',
    insurer: 'Assureur / Organisme *', select: 'Sélectionner…',
    noInsurerOfType: "Aucun organisme de ce type enregistré — ajoutez-en un depuis Facturation → Assurance avant de continuer.",
    policyNo: 'N° de police / adhérent *', policyholder: 'Titulaire (si différent du patient)',
    age: 'Âge', dob: 'Date de naissance', estAge: 'Âge estimé', agePh: 'ex. 45',
    cni: 'Numéro CNI (si disponible)',
    phone: 'Téléphone', quartier: 'Quartier', city: 'Ville',
    nextOfKin: 'Personne à contacter', name: 'Nom',
    history: 'Antécédents médicaux',
    allergies: 'Allergies connues', allergiesPh: 'ex. Pénicilline, arachides…',
    chronic: 'Maladies chroniques', chronicPh: 'ex. Hypertension, diabète type 2…',
    saving: 'Enregistrement…', save: 'Enregistrer le patient',
  },
  en: {
    title: 'New patient',
    fullName: 'Full name *',
    sex: 'Sex', female: 'Female', male: 'Male',
    payCat: 'Payment category', cash: 'Cash', employer: 'Employer scheme', privateIns: 'Private insurance',
    coverageInfo: 'Coverage information',
    insurer: 'Insurer / Organization *', select: 'Select…',
    noInsurerOfType: 'No organization of this type registered — add one from Billing → Insurance before continuing.',
    policyNo: 'Policy / member no. *', policyholder: 'Policyholder (if different from patient)',
    age: 'Age', dob: 'Date of birth', estAge: 'Estimated age', agePh: 'e.g. 45',
    cni: 'National ID number (if available)',
    phone: 'Phone', quartier: 'Neighborhood', city: 'City',
    nextOfKin: 'Emergency contact', name: 'Name',
    history: 'Medical history',
    allergies: 'Known allergies', allergiesPh: 'e.g. Penicillin, peanuts…',
    chronic: 'Chronic conditions', chronicPh: 'e.g. Hypertension, type 2 diabetes…',
    saving: 'Saving…', save: 'Save patient',
  },
} as const

// Same field labels the design/schema decisions established: estimated
// age as a real alternative to date of birth, quartier as first-class
// (not buried under "address"), next of kin expected at registration.
// Insurance capture added: payment_category now genuinely writes
// through (previously hard-coded to 'cash' server-side while the
// Insurance module didn't exist).
export default function NewPatientForm({ insurers }: { insurers: Insurer[] }) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [ageMode, setAgeMode] = useState<'dob' | 'estimated'>('dob')
  const [paymentCategory, setPaymentCategory] = useState('cash')
  const [duplicateWarning, setDuplicateWarning] = useState<{
    message: string; existingId: string; existingCode: string; existingName: string
  } | null>(null)
  const formRef = useState<FormData | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setDuplicateWarning(null)
    setSubmitting(true)
    const result = await createPatient(formData)
    if (result?.duplicateWarning) {
      setDuplicateWarning({
        message: result.error ?? '',
        existingId: result.existingPatient?.id ?? '',
        existingCode: result.existingPatient?.patientCode ?? '',
        existingName: result.existingPatient?.fullName ?? '',
      })
      // Store the formData so we can resubmit with confirm_duplicate=true
      ;(formRef as any)[1](formData)
      setSubmitting(false)
      return
    }
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
    // On success, createPatient redirects server-side.
  }

  async function handleConfirmDuplicate() {
    const prevFormData = (formRef as any)[0]
    if (!prevFormData) return
    setSubmitting(true)
    setDuplicateWarning(null)
    const fd = new FormData()
    for (const [k, v] of (prevFormData as any).entries()) fd.append(k, v)
    fd.set('confirm_duplicate', 'true')
    const result = await createPatient(fd)
    if (result?.error) { setError(result.error); setSubmitting(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)', fontSize: '14px',
    background: 'var(--color-surface)', color: 'var(--color-text-primary)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px',
  }
  const fieldGroup: React.CSSProperties = { marginBottom: '1rem' }

  return (
    <div style={{ maxWidth: '520px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <button onClick={() => router.back()} type="button" style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px',
          color: 'var(--color-text-secondary)', padding: 0,
        }}>
          ←
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{t.title}</h1>
      </div>

      <form action={handleSubmit}>
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="full_name">{t.fullName}</label>
          <input id="full_name" name="full_name" required style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t.sex}</label>
            <select name="sex" style={inputStyle} defaultValue="">
              <option value="">—</option>
              <option value="F">{t.female}</option>
              <option value="M">{t.male}</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t.payCat}</label>
            <select name="payment_category" value={paymentCategory} onChange={(e) => setPaymentCategory(e.target.value)} style={inputStyle}>
              <option value="cash">{t.cash}</option>
              <option value="employer_scheme">{t.employer}</option>
              <option value="cnps">CNPS</option>
              <option value="private_insurance">{t.privateIns}</option>
            </select>
          </div>
        </div>

        {paymentCategory !== 'cash' && (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 10px' }}>{t.coverageInfo}</p>
            <div style={fieldGroup}>
              <label style={labelStyle} htmlFor="insurer_id">{t.insurer}</label>
              <select id="insurer_id" name="insurer_id" required style={inputStyle} defaultValue="">
                <option value="" disabled>{t.select}</option>
                {insurers
                  .filter((i) => i.payer_type === paymentCategory)
                  .map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              {insurers.filter((i) => i.payer_type === paymentCategory).length === 0 && (
                <p style={{ fontSize: '11px', color: 'var(--color-warning-text)', marginTop: '4px' }}>
                  {t.noInsurerOfType}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle} htmlFor="policy_number">{t.policyNo}</label>
                <input id="policy_number" name="policy_number" required={paymentCategory !== 'cash'} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle} htmlFor="policyholder_name">{t.policyholder}</label>
                <input id="policyholder_name" name="policyholder_name" style={inputStyle} />
              </div>
            </div>
          </div>
        )}

        <div style={fieldGroup}>
          <label style={labelStyle}>{t.age}</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
            <button type="button" onClick={() => setAgeMode('dob')} style={{
              fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', cursor: 'pointer',
              background: ageMode === 'dob' ? 'var(--color-accent)' : 'var(--color-surface)',
              color: ageMode === 'dob' ? 'var(--color-accent-text-on)' : 'var(--color-text-primary)',
            }}>
              {t.dob}
            </button>
            <button type="button" onClick={() => setAgeMode('estimated')} style={{
              fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', cursor: 'pointer',
              background: ageMode === 'estimated' ? 'var(--color-accent)' : 'var(--color-surface)',
              color: ageMode === 'estimated' ? 'var(--color-accent-text-on)' : 'var(--color-text-primary)',
            }}>
              {t.estAge}
            </button>
          </div>
          {ageMode === 'dob' ? (
            <input type="date" name="date_of_birth" style={inputStyle} />
          ) : (
            <input type="number" name="estimated_age" min="0" max="130" placeholder={t.agePh} style={inputStyle} />
          )}
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="national_id_number">{t.cni}</label>
          <input id="national_id_number" name="national_id_number" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle} htmlFor="phone">{t.phone}</label>
            <input id="phone" name="phone" type="tel" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle} htmlFor="quartier">{t.quartier}</label>
            <input id="quartier" name="quartier" style={inputStyle} />
          </div>
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="city">{t.city}</label>
          <input id="city" name="city" defaultValue="Douala" style={inputStyle} />
        </div>

        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '1.25rem 0 0.5rem' }}>
          {t.nextOfKin}
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle} htmlFor="next_of_kin_name">{t.name}</label>
            <input id="next_of_kin_name" name="next_of_kin_name" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle} htmlFor="next_of_kin_phone">{t.phone}</label>
            <input id="next_of_kin_phone" name="next_of_kin_phone" type="tel" style={inputStyle} />
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 0.5rem' }}>
          {t.history}
        </p>
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="allergies">
            {t.allergies}
          </label>
          <input
            id="allergies"
            name="allergies"
            placeholder={t.allergiesPh}
            style={inputStyle}
          />
        </div>
        <div style={{ ...fieldGroup, marginBottom: '1.5rem' }}>
          <label style={labelStyle} htmlFor="chronic_conditions">
            {t.chronic}
          </label>
          <input
            id="chronic_conditions"
            name="chronic_conditions"
            placeholder={t.chronicPh}
            style={inputStyle}
          />
        </div>

        {duplicateWarning && (
          <div style={{
            background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-text)',
            borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '1rem',
          }}>
            <p style={{ fontSize: '13px', color: 'var(--color-warning-text)', margin: '0 0 10px' }}>
              {duplicateWarning.message}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleConfirmDuplicate} disabled={submitting} style={{
                fontSize: '12px', padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: 'var(--color-warning-text)', color: 'white', cursor: 'pointer',
              }}>
                {lang === 'fr' ? 'Créer quand même' : 'Create anyway'}
              </button>
              <a href={`/patients/${duplicateWarning.existingId}`} style={{
                fontSize: '12px', padding: '7px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                color: 'var(--color-text-primary)', textDecoration: 'none',
              }}>
                {lang === 'fr' ? 'Ouvrir le dossier existant' : 'Open existing record'} →
              </a>
              <button type="button" onClick={() => setDuplicateWarning(null)} style={{
                fontSize: '12px', padding: '7px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-text-secondary)', cursor: 'pointer',
              }}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" style={{
            fontSize: '13px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)',
            padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem',
          }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} style={{
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
          border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-sm)',
          fontSize: '14px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer',
          opacity: submitting ? 0.7 : 1,
        }}>
          {submitting ? t.saving : t.save}
        </button>
      </form>
    </div>
  )
}
