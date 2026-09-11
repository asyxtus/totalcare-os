'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n/LangContext'
import { registerPatientIdempotent, type OfflinePatientRegistrationPayload } from '@/lib/actions/patientRegistrationOffline'
import { enqueueOfflineOperation } from '@/lib/offline/outbox'
import { hasWorkingConnection } from '@/lib/offline/connectivity'

interface Insurer { id: string; name: string; payer_type: string }

const STR = {
  fr: {
    title: 'Nouveau patient', fullName: 'Nom complet *', sex: 'Sexe', female: 'Féminin', male: 'Masculin',
    payCat: 'Catégorie de paiement', cash: 'Comptant', employer: 'Régime employeur', privateIns: 'Assurance privée',
    coverageInfo: 'Informations de couverture', insurer: 'Assureur / Organisme *', select: 'Sélectionner…',
    noInsurer: 'Aucun organisme de ce type enregistré — ajoutez-en un depuis Facturation → Assurance.',
    policyNo: 'N° de police / adhérent *', policyholder: 'Titulaire (si différent du patient)', age: 'Âge', dob: 'Date de naissance',
    estAge: 'Âge estimé', agePh: 'ex. 45', cni: 'Numéro CNI (si disponible)', phone: 'Téléphone', quartier: 'Quartier', city: 'Ville',
    nextOfKin: 'Personne à contacter', name: 'Nom', history: 'Antécédents médicaux', allergies: 'Allergies connues',
    allergiesPh: 'ex. Pénicilline, arachides…', chronic: 'Maladies chroniques', chronicPh: 'ex. Hypertension, diabète type 2…',
    save: 'Enregistrer le patient', saving: 'Enregistrement…', queued: 'Patient enregistré localement. Il sera synchronisé automatiquement dès que la connexion revient.',
    onlineError: 'Impossible d’enregistrer le patient. Vérifiez la connexion puis réessayez.', back: '←', duplicate: 'Créer quand même', existing: 'Ouvrir le dossier existant',
  },
  en: {
    title: 'New patient', fullName: 'Full name *', sex: 'Sex', female: 'Female', male: 'Male', payment: 'Payment category',
    payCat: 'Payment category', cash: 'Cash', employer: 'Employer scheme', privateIns: 'Private insurance', coverageInfo: 'Coverage information',
    insurer: 'Insurer / Organization *', select: 'Select…', noInsurer: 'No organization of this type registered — add one from Billing → Insurance.',
    policyNo: 'Policy / member no. *', policyholder: 'Policyholder (if different from patient)', age: 'Age', dob: 'Date of birth', estAge: 'Estimated age',
    agePh: 'e.g. 45', cni: 'National ID number (if available)', phone: 'Phone', quartier: 'Neighborhood', city: 'City', nextOfKin: 'Emergency contact',
    name: 'Name', history: 'Medical history', allergies: 'Known allergies', allergiesPh: 'e.g. Penicillin, peanuts…', chronic: 'Chronic conditions',
    chronicPh: 'e.g. Hypertension, type 2 diabetes…', save: 'Save patient', saving: 'Saving…', queued: 'Patient saved locally. It will synchronize automatically when the connection returns.',
    onlineError: 'Could not save the patient. Check the connection and try again.', back: '←', duplicate: 'Create anyway', existing: 'Open existing record',
  },
} as const

export default function OfflineNewPatientForm({ insurers, clinicId, staffId }: { insurers: Insurer[]; clinicId: string; staffId: string }) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()
  const [ageMode, setAgeMode] = useState<'dob' | 'estimated'>('dob')
  const [paymentCategory, setPaymentCategory] = useState('cash')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queued, setQueued] = useState(false)
  const [duplicate, setDuplicate] = useState<{ id: string; name: string; code: string; operationId: string; payload: OfflinePatientRegistrationPayload } | null>(null)

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--color-surface)', color: 'var(--color-text-primary)' }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }
  const fieldGroup: React.CSSProperties = { marginBottom: '1rem' }

  function payloadFrom(form: FormData): OfflinePatientRegistrationPayload {
    const value = (key: string) => String(form.get(key) ?? '').trim()
    return {
      full_name: value('full_name'), sex: value('sex'), date_of_birth: value('date_of_birth'), estimated_age: value('estimated_age'),
      national_id_number: value('national_id_number'), phone: value('phone'), quartier: value('quartier'), city: value('city'),
      next_of_kin_name: value('next_of_kin_name'), next_of_kin_phone: value('next_of_kin_phone'), allergies: value('allergies'),
      chronic_conditions: value('chronic_conditions'), payment_category: value('payment_category') || 'cash', insurer_id: value('insurer_id'),
      policy_number: value('policy_number'), policyholder_name: value('policyholder_name'), confirm_duplicate: value('confirm_duplicate') === 'true',
    }
  }

  async function submitPayload(payload: OfflinePatientRegistrationPayload, existingOperationId?: string) {
    // A duplicate warning is a two-step transaction. Reusing the original
    // operation ID on confirmation makes the confirmation idempotent and
    // prevents the warning row from becoming orphaned under a second ID.
    const operationId = existingOperationId ?? crypto.randomUUID()
    const reachable = await hasWorkingConnection(2500)

    if (!reachable) {
      await enqueueOfflineOperation({ operation: 'patient-registration', clinicId, staffId, payload, id: operationId })
      setQueued(true)
      setSubmitting(false)
      return
    }

    try {
      const result = await registerPatientIdempotent(operationId, payload)
      if (result.duplicateWarning && result.existingPatient) {
        setDuplicate({ id: result.existingPatient.id, name: result.existingPatient.fullName, code: result.existingPatient.patientCode, operationId, payload })
        setSubmitting(false)
        return
      }
      if (result.error || !result.newPatientId) {
        setError(result.error ?? t.onlineError)
        setSubmitting(false)
        return
      }
      setDuplicate(null)
      router.push(`/reception?tab=appointments&new_patient=${result.newPatientId}`)
    } catch {
      // A transport exception after the reachability probe is exactly the
      // failure mode the outbox is intended to absorb. The same operation ID
      // is queued so a retry can never create a second patient.
      await enqueueOfflineOperation({ operation: 'patient-registration', clinicId, staffId, payload, id: operationId })
      setQueued(true)
      setSubmitting(false)
    }
  }

  async function handleSubmit(form: FormData) {
    setError(null); setQueued(false); setDuplicate(null); setSubmitting(true)
    await submitPayload(payloadFrom(form))
  }

  async function handleConfirmDuplicate() {
    if (!duplicate) return
    setSubmitting(true)
    await submitPayload({ ...duplicate.payload, confirm_duplicate: true }, duplicate.operationId)
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
        <button onClick={() => router.back()} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text-secondary)', padding: 0 }}>{t.back}</button>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{t.title}</h1>
      </div>

      {queued && <div role="status" style={{ marginBottom: '1rem', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-warning-text)', background: 'var(--color-warning-bg)', color: 'var(--color-text-primary)', fontSize: 13 }}>{t.queued}</div>}
      {error && <div role="alert" style={{ marginBottom: '1rem', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-critical-text)', color: 'var(--color-text-primary)', fontSize: 13 }}>{error}</div>}

      <form action={handleSubmit}>
        <div style={fieldGroup}><label style={labelStyle} htmlFor="full_name">{t.fullName}</label><input id="full_name" name="full_name" required style={inputStyle} /></div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
          <div style={{ flex: 1 }}><label style={labelStyle}>{t.sex}</label><select name="sex" style={inputStyle} defaultValue=""><option value="">—</option><option value="F">{t.female}</option><option value="M">{t.male}</option></select></div>
          <div style={{ flex: 1 }}><label style={labelStyle}>{t.payCat}</label><select name="payment_category" value={paymentCategory} onChange={e => setPaymentCategory(e.target.value)} style={inputStyle}><option value="cash">{t.cash}</option><option value="employer_scheme">{t.employer}</option><option value="cnps">CNPS</option><option value="private_insurance">{t.privateIns}</option></select></div>
        </div>

        {paymentCategory !== 'cash' && <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 10px' }}>{t.coverageInfo}</p>
          <div style={fieldGroup}><label style={labelStyle} htmlFor="insurer_id">{t.insurer}</label><select id="insurer_id" name="insurer_id" required style={inputStyle} defaultValue=""><option value="" disabled>{t.select}</option>{insurers.filter(i => i.payer_type === paymentCategory).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>{insurers.filter(i => i.payer_type === paymentCategory).length === 0 && <p style={{ fontSize: 11, color: 'var(--color-warning-text)', marginTop: 4 }}>{t.noInsurer}</p>}</div>
          <div style={{ display: 'flex', gap: '1rem' }}><div style={{ flex: 1 }}><label style={labelStyle} htmlFor="policy_number">{t.policyNo}</label><input id="policy_number" name="policy_number" required style={inputStyle} /></div><div style={{ flex: 1 }}><label style={labelStyle} htmlFor="policyholder_name">{t.policyholder}</label><input id="policyholder_name" name="policyholder_name" style={inputStyle} /></div></div>
        </div>}

        <div style={fieldGroup}><label style={labelStyle}>{t.age}</label><div style={{ display: 'flex', gap: 8, marginBottom: 6 }}><button type="button" onClick={() => setAgeMode('dob')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', cursor: 'pointer', background: ageMode === 'dob' ? 'var(--color-accent)' : 'var(--color-surface)', color: ageMode === 'dob' ? 'var(--color-accent-text-on)' : 'var(--color-text-primary)' }}>{t.dob}</button><button type="button" onClick={() => setAgeMode('estimated')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', cursor: 'pointer', background: ageMode === 'estimated' ? 'var(--color-accent)' : 'var(--color-surface)', color: ageMode === 'estimated' ? 'var(--color-accent-text-on)' : 'var(--color-text-primary)' }}>{t.estAge}</button></div>{ageMode === 'dob' ? <input type="date" name="date_of_birth" style={inputStyle} /> : <input type="number" name="estimated_age" min="0" max="130" placeholder={t.agePh} style={inputStyle} />}</div>
        <div style={fieldGroup}><label style={labelStyle} htmlFor="national_id_number">{t.cni}</label><input id="national_id_number" name="national_id_number" style={inputStyle} /></div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}><div style={{ flex: 1 }}><label style={labelStyle} htmlFor="phone">{t.phone}</label><input id="phone" name="phone" type="tel" style={inputStyle} /></div><div style={{ flex: 1 }}><label style={labelStyle} htmlFor="quartier">{t.quartier}</label><input id="quartier" name="quartier" style={inputStyle} /></div></div>
        <div style={fieldGroup}><label style={labelStyle} htmlFor="city">{t.city}</label><input id="city" name="city" defaultValue="Douala" style={inputStyle} /></div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '1.25rem 0 0.5rem' }}>{t.nextOfKin}</p>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}><div style={{ flex: 1 }}><label style={labelStyle} htmlFor="next_of_kin_name">{t.name}</label><input id="next_of_kin_name" name="next_of_kin_name" style={inputStyle} /></div><div style={{ flex: 1 }}><label style={labelStyle} htmlFor="next_of_kin_phone">{t.phone}</label><input id="next_of_kin_phone" name="next_of_kin_phone" type="tel" style={inputStyle} /></div></div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 0.5rem' }}>{t.history}</p>
        <div style={fieldGroup}><label style={labelStyle} htmlFor="allergies">{t.allergies}</label><input id="allergies" name="allergies" placeholder={t.allergiesPh} style={inputStyle} /></div>
        <div style={{ ...fieldGroup, marginBottom: '1.5rem' }}><label style={labelStyle} htmlFor="chronic_conditions">{t.chronic}</label><input id="chronic_conditions" name="chronic_conditions" placeholder={t.chronicPh} style={inputStyle} /></div>

        {duplicate && <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-text)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '1rem' }}><p style={{ fontSize: 13, color: 'var(--color-warning-text)', margin: '0 0 10px' }}>{lang === 'fr' ? `Un patient avec ce numéro CNI existe déjà : ${duplicate.name} (${duplicate.code}).` : `A patient with this national ID already exists: ${duplicate.name} (${duplicate.code}).`}</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" onClick={handleConfirmDuplicate} disabled={submitting} style={{ fontSize: 12, padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-warning-text)', color: 'white', cursor: 'pointer' }}>{t.duplicate}</button><a href={`/patients/${duplicate.id}`} style={{ fontSize: 12, padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', textDecoration: 'none' }}>{t.existing} →</a></div></div>}

        <button type="submit" disabled={submitting} style={{ width: '100%', padding: '10px 14px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: submitting ? 'wait' : 'pointer', fontSize: 13 }}>{submitting ? t.saving : t.save}</button>
      </form>
    </div>
  )
}