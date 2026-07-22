'use client'

// components/TriageForm.tsx

import { useState } from 'react'
import { saveTriageData, finalizeTriage } from '@/lib/actions/triage'
import { useLang } from '@/lib/i18n/LangContext'

interface TriageFormProps {
  visitId: string
  clinicId: string
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
    criticalTitle: '{t.criticalTitle}',
    confirmQ: '{t.confirmQ}',
    sending: 'Envoi…', confirmBtn: "J'ai pris connaissance — continuer",
  },
  en: {
    vitals: 'Vital signs', sysBP: 'Systolic BP', diaBP: 'Diastolic BP',
    pulse: 'Pulse', temp: 'Temperature (°C)', rr: 'Respiratory rate',
    weight: 'Weight (kg)', height: 'Height (cm)',
    nursing: 'Nursing assessment', complaint: 'Chief complaint',
    hxMed: 'Medical history', hxMedPh: 'e.g. Known hypertension, prior surgery…',
    hxSoc: 'Social history', hxSocPh: 'e.g. Tobacco, alcohol, occupation…',
    saving: 'Saving…', save: 'Complete triage',
    criticalTitle: '⚠ Critical values detected',
    confirmQ: 'Please confirm you have reviewed these values before continuing.',
    sending: 'Sending…', confirmBtn: 'Acknowledged — continue',
  },
} as const

export default function TriageForm({ visitId, clinicId }: TriageFormProps) {
  const lang = useLang()
  const t = STR[lang]
  const [error, setError] = useState<string | null>(null)
  const [criticalFlags, setCriticalFlags] = useState<any[] | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)

    const result = await saveTriageData(visitId, clinicId, formData)

    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    if (result?.saved && result?.flags) {
      // Data is already saved server-side. Just show the flags and wait
      // for confirmation — no form data needs to be held onto anymore.
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
    // On success, finalizeTriage redirects server-side.
  }

  if (criticalFlags) {
    return (
      <div style={{
        background: 'var(--color-critical-bg)', border: '1px solid var(--color-critical-text)',
        borderRadius: 'var(--radius-md)', padding: '1rem',
      }}>
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
        <button
          onClick={confirmDespiteFlags}
          disabled={submitting}
          style={{
            background: 'var(--color-critical-text)', color: 'white', border: 'none',
            padding: '9px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13px',
            fontWeight: 500, cursor: 'pointer',
          }}
        >
          {submitting ? t.sending : t.confirmBtn}
        </button>
      </div>
    )
  }

  return (
    <form action={handleSubmit}>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{t.vitals}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '1.25rem' }}>
        <div>
          <label style={labelStyle}>{t.sysBP}</label>
          <input name="systolic_bp" type="number" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t.diaBP}</label>
          <input name="diastolic_bp" type="number" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t.pulse}</label>
          <input name="pulse" type="number" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t.temp}</label>
          <input name="temperature" type="number" step="0.1" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>SpO2 (%)</label>
          <input name="spo2" type="number" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t.rr}</label>
          <input name="respiratory_rate" type="number" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t.weight}</label>
          <input name="weight_kg" type="number" step="0.1" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t.height}</label>
          <input name="height_cm" type="number" step="0.1" style={inputStyle} />
        </div>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{t.nursing}</p>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>{t.complaint}</label>
        <input name="chief_complaint" style={inputStyle} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>{t.hxMed}</label>
        <input name="medical_history" placeholder={t.hxMedPh} style={inputStyle} />
      </div>
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>{t.hxSoc}</label>
        <input name="social_history" placeholder={t.hxSocPh} style={inputStyle} />
      </div>

      {error && (
        <p role="alert" style={{
          fontSize: '13px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)',
          padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem',
        }}>
          {error}
        </p>
      )}

      {/* Priority — the nurse's clinical judgment about how urgently this
          patient needs to be seen. Routine stays FIFO; Urgent rises above
          routine patients; Critique goes to the top and triggers a banner
          on the doctor's screen. */}
      <div style={{ marginBottom: '1rem', padding: '12px 16px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 10px', color: 'var(--color-text-primary)' }}>
          {lang === 'fr' ? 'Priorité pour le médecin' : 'Priority for doctor'}
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {([
            { val: 'routine',  fr: 'Routine',   en: 'Routine',   color: 'var(--color-text-secondary)' },
            { val: 'urgent',   fr: 'Urgent',    en: 'Urgent',    color: 'var(--color-warning-text)' },
            { val: 'critical', fr: '⚠ Critique', en: '⚠ Critical', color: 'var(--color-critical-text)' },
          ] as const).map((opt) => (
            <label key={opt.val} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${opt.color}`, cursor: 'pointer',
              background: 'transparent', fontSize: '13px',
              color: opt.color, fontWeight: 500,
            }}>
              <input type="radio" name="triage_priority" value={opt.val} defaultChecked={opt.val === 'routine'} style={{ accentColor: opt.color }} />
              {lang === 'fr' ? opt.fr : opt.en}
            </label>
          ))}
        </div>
        <textarea
          name="priority_note"
          rows={2}
          placeholder={lang === 'fr' ? 'Note pour le médecin (optionnel) — ex. SpO2 82%, douleur thoracique, patient très agité…' : 'Note for doctor (optional) — e.g. SpO2 82%, chest pain, very agitated patient…'}
          style={{
            width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)', fontSize: '13px',
            background: 'var(--color-surface)', color: 'var(--color-text-primary)',
            resize: 'vertical',
          }}
        />
      </div>

      <button type="submit" disabled={submitting} style={{
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
        border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-sm)',
        fontSize: '14px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer',
        opacity: submitting ? 0.7 : 1,
      }}>
        {submitting ? t.saving : t.save}
      </button>
    </form>
  )
}
