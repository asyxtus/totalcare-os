'use client'

// components/TriageForm.tsx

import { useState } from 'react'
import { saveTriageData, finalizeTriage } from '@/lib/actions/triage'
import { enqueueOfflineOperation } from '@/lib/offline/outbox'
import { hasWorkingConnection } from '@/lib/offline/connectivity'
import type { OfflineTriagePayload } from '@/lib/actions/triageOffline'
import { useLang } from '@/lib/i18n/LangContext'

interface TriageFormProps {
  visitId: string
  clinicId: string
  staffId: string
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', fontSize: '14px',
  background: 'var(--color-surface)', color: 'var(--color-text-primary)',
}
const labelStyle: React.CSSProperties = {
  fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px',
}

const STR = {
  fr: {
    vitals: 'Constantes', sysBP: 'Tension systolique', diaBP: 'Tension diastolique',
    pulse: 'Pouls', temp: 'Température (°C)', rr: 'Fréq. respiratoire',
    weight: 'Poids (kg)', height: 'Taille (cm)',
    nursing: 'Évaluation infirmière', complaint: 'Motif de consultation',
    hxMed: 'Antécédents médicaux', hxMedPh: 'ex. Hypertension connue, chirurgie antérieure…',
    hxSoc: 'Antécédents sociaux', hxSocPh: 'ex. Tabac, alcool, profession…',
    saving: 'Enregistrement…', save: 'Terminer le triage',
    sending: 'Envoi…', confirmBtn: "J'ai pris connaissance — continuer",
    queued: 'Triage enregistré localement. Il sera synchronisé automatiquement dès que la connexion revient.',
    queueError: 'Impossible d’enregistrer le triage hors connexion. Vérifiez le stockage local et réessayez.',
    invalidMeasurement: 'Une valeur de constante n’est pas valide. Vérifiez les valeurs saisies.',
  },
  en: {
    vitals: 'Vital signs', sysBP: 'Systolic BP', diaBP: 'Diastolic BP',
    pulse: 'Pulse', temp: 'Temperature (°C)', rr: 'Respiratory rate',
    weight: 'Weight (kg)', height: 'Height (cm)',
    nursing: 'Nursing assessment', complaint: 'Chief complaint',
    hxMed: 'Medical history', hxMedPh: 'e.g. Known hypertension, prior surgery…',
    hxSoc: 'Social history', hxSocPh: 'e.g. Tobacco, alcohol, occupation…',
    saving: 'Saving…', save: 'Complete triage',
    sending: 'Sending…', confirmBtn: 'Acknowledged — continue',
    queued: 'Triage saved locally. It will synchronize automatically when the connection returns.',
    queueError: 'Could not save the triage record offline. Check local storage and try again.',
    invalidMeasurement: 'One of the vital-sign values is invalid. Check the entered values.',
  },
} as const

export default function TriageForm({ visitId, clinicId, staffId }: TriageFormProps) {
  const lang = useLang()
  const t = STR[lang]
  const [error, setError] = useState<string | null>(null)
  const [criticalFlags, setCriticalFlags] = useState<any[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [queued, setQueued] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)

    const numberValue = (key: string): number | null => {
      const raw = String(formData.get(key) ?? '').trim()
      if (!raw) return null
      const value = Number(raw)
      return Number.isFinite(value) ? value : NaN
    }

    const triage_priority = String(formData.get('triage_priority') ?? 'routine') as OfflineTriagePayload['triage_priority']
    const payload: OfflineTriagePayload = {
      visit_id: visitId,
      clinic_id: clinicId,
      systolic_bp: numberValue('systolic_bp'),
      diastolic_bp: numberValue('diastolic_bp'),
      pulse: numberValue('pulse'),
      temperature: numberValue('temperature'),
      spo2: numberValue('spo2'),
      respiratory_rate: numberValue('respiratory_rate'),
      weight_kg: numberValue('weight_kg'),
      height_cm: numberValue('height_cm'),
      chief_complaint: String(formData.get('chief_complaint') ?? '').trim(),
      medical_history: String(formData.get('medical_history') ?? '').trim(),
      social_history: String(formData.get('social_history') ?? '').trim(),
      triage_priority,
      priority_note: String(formData.get('priority_note') ?? '').trim(),
    }

    const measurements = [
      payload.systolic_bp, payload.diastolic_bp, payload.pulse, payload.temperature,
      payload.spo2, payload.respiratory_rate, payload.weight_kg, payload.height_cm,
    ]
    if (measurements.some((value) => Number.isNaN(value))) {
      setError(t.invalidMeasurement)
      setSubmitting(false)
      return
    }

    // Offline capture is durable and idempotent. We never call the normal
    // two-step triage action while offline because it can partially write
    // vitals/assessment before a connection failure. The sync RPC performs
    // the whole mutation atomically when connectivity returns.
    if (!(await hasWorkingConnection(2500))) {
      try {
        await enqueueOfflineOperation({
          operation: 'triage-capture',
          clinicId,
          staffId,
          payload,
          id: crypto.randomUUID(),
        })
        setQueued(true)
        setSubmitting(false)
        return
      } catch {
        setError(t.queueError)
        setSubmitting(false)
        return
      }
    }

    const result = await saveTriageData(visitId, clinicId, formData)

    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    if (result?.saved && result?.flags) {
      setCriticalFlags(result.flags)
      setSubmitting(false)
      return
    }
    // Otherwise saveTriageData already redirected server-side.
  }

  async function confirmDespiteFlags() {
    setSubmitting(true)
    const result = await finalizeTriage(visitId)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    }
  }

  if (criticalFlags) {
    return (
      <div style={{ background: 'var(--color-critical-bg)', border: '1px solid var(--color-critical-text)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-critical-text)', margin: '0 0 10px' }}>
          {lang === 'fr' ? '⚠ Valeurs critiques détectées' : '⚠ Critical values detected'}
        </p>
        {criticalFlags.filter(f => f.severity === 'critical').map((f, i) => (
          <p key={i} style={{ fontSize: '13px', color: 'var(--color-critical-text)', margin: '4px 0' }}>
            {lang === 'fr' ? f.message_fr : (f.message_en ?? f.message_fr)} ({f.value})
          </p>
        ))}
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '10px 0' }}>
          Confirmez-vous avoir pris connaissance de ces valeurs avant de continuer ?
        </p>
        <button onClick={confirmDespiteFlags} disabled={submitting} style={{ background: 'var(--color-critical-text)', color: 'white', border: 'none', padding: '9px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
          {submitting ? t.sending : t.confirmBtn}
        </button>
      </div>
    )
  }

  return (
    <form action={handleSubmit}>
      {queued && <p role="status" style={{ fontSize: '13px', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>{t.queued}</p>}
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{t.vitals}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '1.25rem' }}>
        <div><label style={labelStyle}>{t.sysBP}</label><input name="systolic_bp" type="number" style={inputStyle} /></div>
        <div><label style={labelStyle}>{t.diaBP}</label><input name="diastolic_bp" type="number" style={inputStyle} /></div>
        <div><label style={labelStyle}>{t.pulse}</label><input name="pulse" type="number" style={inputStyle} /></div>
        <div><label style={labelStyle}>{t.temp}</label><input name="temperature" type="number" step="0.1" style={inputStyle} /></div>
        <div><label style={labelStyle}>SpO2 (%)</label><input name="spo2" type="number" style={inputStyle} /></div>
        <div><label style={labelStyle}>{t.rr}</label><input name="respiratory_rate" type="number" style={inputStyle} /></div>
        <div><label style={labelStyle}>{t.weight}</label><input name="weight_kg" type="number" step="0.1" style={inputStyle} /></div>
        <div><label style={labelStyle}>{t.height}</label><input name="height_cm" type="number" step="0.1" style={inputStyle} /></div>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{t.nursing}</p>
      <div style={{ marginBottom: '10px' }}><label style={labelStyle}>{t.complaint}</label><input name="chief_complaint" style={inputStyle} /></div>
      <div style={{ marginBottom: '10px' }}><label style={labelStyle}>{t.hxMed}</label><input name="medical_history" placeholder={t.hxMedPh} style={inputStyle} /></div>
      <div style={{ marginBottom: '1.25rem' }}><label style={labelStyle}>{t.hxSoc}</label><input name="social_history" placeholder={t.hxSocPh} style={inputStyle} /></div>

      {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ marginBottom: '1rem', padding: '12px 16px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 10px', color: 'var(--color-text-primary)' }}>{lang === 'fr' ? 'Priorité pour le médecin' : 'Priority for doctor'}</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {([
            { val: 'routine', fr: 'Routine', en: 'Routine', color: 'var(--color-text-secondary)' },
            { val: 'urgent', fr: 'Urgent', en: 'Urgent', color: 'var(--color-warning-text)' },
            { val: 'critical', fr: '⚠ Critique', en: '⚠ Critical', color: 'var(--color-critical-text)' },
          ] as const).map((opt) => (
            <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: `1px solid ${opt.color}`, cursor: 'pointer', background: 'transparent', fontSize: '13px', color: opt.color, fontWeight: 500 }}>
              <input type="radio" name="triage_priority" value={opt.val} defaultChecked={opt.val === 'routine'} style={{ accentColor: opt.color }} />
              {lang === 'fr' ? opt.fr : opt.en}
            </label>
          ))}
        </div>
        <textarea name="priority_note" rows={2} placeholder={lang === 'fr' ? 'Note pour le médecin (optionnel) — ex. SpO2 82%, douleur thoracique, patient très agité…' : 'Note for doctor (optional) — e.g. SpO2 82%, chest pain, very agitated patient…'} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', resize: 'vertical' }} />
      </div>

      <button type="submit" disabled={submitting} style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
        {submitting ? t.saving : t.save}
      </button>
    </form>
  )
}
