'use client'

import { useState } from 'react'
import { createConsultationAddendum, signConsultation, updateUnsignedSoap } from '@/lib/actions/consultationDocumentation'
import { useLang } from '@/lib/i18n/LangContext'

interface Props {
  visitId: string
  consultationId: string
  doctorId: string
  currentStaffId: string
  completedAt: string
  signedAt?: string | null
  signedBy?: string | null
  initialValues: { subjective: string; objective: string; diagnosis: string; treatmentPlan: string }
  addenda: Array<{ id: string; section: string; reason: string; content: string; created_at: string }>
}

export default function ConsultationDocumentationPanel({
  visitId, consultationId, doctorId, currentStaffId, completedAt, signedAt, initialValues, addenda,
}: Props) {
  const lang = useLang()
  const fr = lang === 'fr'
  const [subjective, setSubjective] = useState(initialValues.subjective)
  const [objective, setObjective] = useState(initialValues.objective)
  const [diagnosis, setDiagnosis] = useState(initialValues.diagnosis)
  const [plan, setPlan] = useState(initialValues.treatmentPlan)
  const [section, setSection] = useState('other')
  const [reason, setReason] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const isDoctor = currentStaffId === doctorId
  const isSigned = Boolean(signedAt)
  const canEdit = !isSigned && isDoctor

  async function save() {
    setBusy(true); setMessage(null)
    const result = await updateUnsignedSoap({ consultationId, visitId, subjective, objective, diagnosis, treatmentPlan: plan })
    setMessage(result.error ? `❌ ${result.error}` : (fr ? '✓ Note mise à jour.' : '✓ Note updated.'))
    setBusy(false)
  }

  async function sign() {
    if (!window.confirm(fr ? 'Signer et verrouiller cette note clinique ? Elle ne pourra ensuite être modifiée que par addendum.' : 'Sign and lock this clinical note? It can then only be changed by addendum.')) return
    setBusy(true); setMessage(null)
    const result = await signConsultation({ consultationId, visitId })
    if (!result.error) window.location.reload()
    setMessage(result.error ? `❌ ${result.error}` : null)
    setBusy(false)
  }

  async function addAddendum() {
    setBusy(true); setMessage(null)
    const result = await createConsultationAddendum({ consultationId, visitId, section, reason, content })
    if (!result.error) { setReason(''); setContent(''); window.location.reload() }
    setMessage(result.error ? `❌ ${result.error}` : null)
    setBusy(false)
  }

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{label}</span>
      <textarea value={value} onChange={e => set(e.target.value)} disabled={!canEdit} rows={4} style={{ width: '100%', padding: 10, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', resize: 'vertical' }} />
    </label>
  )

  return (
    <section style={{ marginTop: 20, borderTop: '1px solid var(--color-border)', paddingTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, margin: 0 }}>{fr ? 'Documentation clinique' : 'Clinical documentation'}</h2>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            {isSigned ? `🔒 ${fr ? 'Note signée et verrouillée' : 'Signed and locked'}${signedAt ? ` · ${new Date(signedAt).toLocaleString()}` : ''}` : `✏️ ${fr ? 'Consultation terminée — note non signée et modifiable' : 'Consultation completed — note unsigned and editable'}`}
          </p>
        </div>
      </div>

      {canEdit && <>
        {field(fr ? 'S — Subjectif' : 'S — Subjective', subjective, setSubjective)}
        {field(fr ? 'O — Objectif' : 'O — Objective', objective, setObjective)}
        {field(fr ? 'A — Analyse / Diagnostic' : 'A — Assessment / Diagnosis', diagnosis, setDiagnosis)}
        {field(fr ? 'P — Plan' : 'P — Plan', plan, setPlan)}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={save} style={{ padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}>{busy ? '…' : (fr ? '💾 Enregistrer les modifications' : '💾 Save changes')}</button>
          <button type="button" disabled={busy} onClick={sign} style={{ padding: '8px 14px', border: 0, borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: 'white' }}>{fr ? '🔐 Signer et verrouiller' : '🔐 Sign & lock'}</button>
        </div>
      </>}

      {isSigned && isDoctor && <div style={{ marginTop: 10 }}>
        <h3 style={{ fontSize: 14 }}>{fr ? 'Ajouter une correction / un addendum' : 'Add a correction / addendum'}</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <select value={section} onChange={e => setSection(e.target.value)} style={{ padding: 8, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}>
            <option value="subjective">{fr ? 'Subjectif' : 'Subjective'}</option>
            <option value="objective">{fr ? 'Objectif' : 'Objective'}</option>
            <option value="assessment">{fr ? 'Analyse / Diagnostic' : 'Assessment / Diagnosis'}</option>
            <option value="plan">Plan</option>
            <option value="other">{fr ? 'Autre' : 'Other'}</option>
          </select>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder={fr ? 'Motif de la correction (obligatoire)' : 'Reason for correction (required)'} style={{ padding: 9, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }} />
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder={fr ? 'Contenu de l’addendum…' : 'Addendum content…'} style={{ padding: 9, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }} />
          <button type="button" disabled={busy || !reason.trim() || !content.trim()} onClick={addAddendum} style={{ width: 'fit-content', padding: '8px 14px', border: 0, borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: 'white' }}>{fr ? '📝 Enregistrer l’addendum' : '📝 Save addendum'}</button>
        </div>
      </div>}

      {message && <p style={{ fontSize: 13, marginTop: 10 }}>{message}</p>}

      {isSigned && <div style={{ marginTop: 18 }}>
        <h3 style={{ fontSize: 14 }}>{fr ? 'Addenda précédents' : 'Previous addenda'}</h3>
        {addenda.length === 0 ? <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>—</p> : addenda.map(a => (
          <div key={a.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{a.section} · {new Date(a.created_at).toLocaleString()}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}><strong>{fr ? 'Motif :' : 'Reason:'}</strong> {a.reason}</div>
            <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{a.content}</div>
          </div>
        ))}
      </div>}
    </section>
  )
}
