'use client'

// components/CheckInPanel.tsx

import { useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n/LangContext'
import { startCheckIn, collectPaymentAndProceed, flagEmergencyAndProceed, proceedPastGateOnly } from '@/lib/actions/checkin'

interface ConsultationType {
  id: string
  service_name: string
  price_xaf: number
}

interface ActiveVisit {
  id: string
  status: string
  is_emergency: boolean
}

interface PendingCharge {
  id: string
  amount_xaf: number
  amount_paid_xaf: number
  status: string
}

interface Doctor {
  id: string
  full_name: string
}

interface AppointmentPrefill {
  id: string
  service_price_id: string | null
  doctor_id: string | null
  reason: string | null
}

interface CheckInPanelProps {
  patientId: string
  activeVisit: ActiveVisit | null
  pendingCharge: PendingCharge | null
  pendingInvoiceId: string | null
  consultationTypes: ConsultationType[]
  doctors: Doctor[]
  statusLabel: string
  appointment?: AppointmentPrefill | null
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', fontSize: '14px',
  background: 'var(--color-bg)', color: 'var(--color-text-primary)',
}

const VISIT_STATUS: Record<string, { fr: string; en: string }> = {
  registered: { fr: 'En attente de paiement', en: 'Awaiting payment' },
  triage: { fr: 'Triage', en: 'Triage' },
  waiting_consultation: { fr: 'En attente de consultation', en: 'Awaiting consultation' },
  in_consultation: { fr: 'En consultation', en: 'In consultation' },
  waiting_lab: { fr: 'En attente de laboratoire', en: 'Awaiting laboratory' },
  waiting_pharmacy: { fr: 'En attente de pharmacie', en: 'Awaiting pharmacy' },
  billing: { fr: 'Facturation', en: 'Billing' },
  discharged: { fr: 'Sorti(e)', en: 'Discharged' },
  admitted: { fr: 'Hospitalisé(e)', en: 'Admitted' },
  cancelled: { fr: 'Annulé', en: 'Cancelled' },
}

const STR = {
  fr: {
    registerVisit: 'Enregistrer une visite',
    apptPrefill: 'Rendez-vous prévu — les champs ci-dessous sont pré-remplis en conséquence.',
    consultType: 'Type de consultation',
    choose: 'Choisir…',
    noConsultTypes: 'Aucun type de consultation configuré pour cette clinique.',
    reason: 'Motif',
    reasonPlaceholder: 'ex. Contrôle tensionnel, douleur…',
    doctorOptional: "Médecin (optionnel — sinon file d'attente commune)",
    noneCommonQueue: "Aucun — file d'attente commune",
    saving: 'Enregistrement…',
    startVisit: 'Démarrer la visite',
    noInvoiceReload: 'Aucune facture à régler pour le moment — rechargez la page.',
    chargeMissing: "Cette visite n'a pas de frais de consultation associés. Contactez un administrateur — ne pas continuer sans corriger ceci.",
    alreadyPaid: (amt: string) => `Le paiement de ${amt} FCFA a déjà été reçu, mais la visite n'a pas encore avancé. Cliquez pour continuer.`,
    processing: 'Traitement…',
    continue: 'Continuer',
    awaitingPayment: (amt: string) => `En attente de paiement — ${amt} FCFA`,
    partial: ' (partiel)',
    noInvoiceForCharge: "Aucune facture n'a été créée pour ce frais — contactez un administrateur avant d'encaisser.",
    cash: 'Comptant',
    txRef: 'Réf. transaction (si mobile money)',
    collecting: 'Encaissement…',
    collect: 'Encaisser',
    flagEmergency: 'Signaler comme urgence (sans paiement)',
    emergencyReason: "Motif de l'urgence (obligatoire)",
    confirmEmergency: "Confirmer l'urgence",
    visitInProgress: 'Visite en cours :',
    emergencySuffix: ' (urgence)',
    viewQueue: "Voir la file d'attente",
    locale: 'fr-FR',
  },
  en: {
    registerVisit: 'Register a visit',
    apptPrefill: 'Scheduled appointment — the fields below are pre-filled accordingly.',
    consultType: 'Consultation type',
    choose: 'Choose…',
    noConsultTypes: 'No consultation types configured for this clinic.',
    reason: 'Reason',
    reasonPlaceholder: 'e.g. Blood pressure check, pain…',
    doctorOptional: 'Doctor (optional — otherwise shared queue)',
    noneCommonQueue: 'None — shared queue',
    saving: 'Saving…',
    startVisit: 'Start visit',
    noInvoiceReload: 'No invoice to settle right now — reload the page.',
    chargeMissing: 'This visit has no associated consultation charge. Contact an administrator — do not continue without fixing this.',
    alreadyPaid: (amt: string) => `The ${amt} FCFA payment was already received, but the visit has not advanced yet. Click to continue.`,
    processing: 'Processing…',
    continue: 'Continue',
    awaitingPayment: (amt: string) => `Awaiting payment — ${amt} FCFA`,
    partial: ' (partial)',
    noInvoiceForCharge: 'No invoice was created for this charge — contact an administrator before collecting.',
    cash: 'Cash',
    txRef: 'Transaction ref. (if mobile money)',
    collecting: 'Collecting…',
    collect: 'Collect',
    flagEmergency: 'Flag as emergency (without payment)',
    emergencyReason: 'Emergency reason (required)',
    confirmEmergency: 'Confirm emergency',
    visitInProgress: 'Visit in progress:',
    emergencySuffix: ' (emergency)',
    viewQueue: 'View the queue',
    locale: 'en-US',
  },
} as const

export default function CheckInPanel({
  patientId, activeVisit, pendingCharge, pendingInvoiceId, consultationTypes, doctors, statusLabel, appointment,
}: CheckInPanelProps) {
  const lang = useLang()
  const t = STR[lang]
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const remainingDue = pendingCharge ? pendingCharge.amount_xaf - pendingCharge.amount_paid_xaf : 0

  async function handleCheckIn(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await startCheckIn(patientId, formData)
    if (result?.error) {
      setError(result.error)
    }
    setSubmitting(false)
    // No redirect on success — startCheckIn calls revalidatePath, and this
    // client component's parent server page re-renders with the new state.
  }

  async function handlePayment(formData: FormData) {
    if (!activeVisit || !pendingInvoiceId || !pendingCharge) {
      setError(t.noInvoiceReload)
      return
    }
    setError(null)
    setSubmitting(true)
    const result = await collectPaymentAndProceed(activeVisit.id, pendingInvoiceId, remainingDue, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
    // On success this redirects server-side.
  }

  async function handleEmergency(formData: FormData) {
    if (!activeVisit) return
    setError(null)
    setSubmitting(true)
    const result = await flagEmergencyAndProceed(activeVisit.id, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
  }

  async function handleRecovery() {
    if (!activeVisit) return
    setError(null)
    setSubmitting(true)
    const result = await proceedPastGateOnly(activeVisit.id)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
  }

  const errorBanner = error && (
    <p role="alert" style={{
      fontSize: '13px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)',
      padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '10px',
    }}>
      {error}
    </p>
  )

  // STATE 1: no active visit
  if (!activeVisit) {
    return (
      <form action={handleCheckIn} style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem',
      }}>
        <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 10px' }}>{t.registerVisit}</p>
        {appointment && (
          <input type="hidden" name="appointment_id" value={appointment.id} />
        )}
        {appointment && (
          <p style={{
            fontSize: '12px', color: 'var(--color-accent)', background: 'var(--color-bg)',
            padding: '6px 10px', borderRadius: 'var(--radius-sm)', margin: '0 0 10px',
          }}>
            {t.apptPrefill}
          </p>
        )}
        {errorBanner}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
            {t.consultType}
          </label>
          <select name="service_price_id" required style={inputStyle} defaultValue={appointment?.service_price_id ?? ''}>
            <option value="" disabled>{t.choose}</option>
            {consultationTypes.map((s) => (
              <option key={s.id} value={s.id}>{s.service_name} — {s.price_xaf.toLocaleString(t.locale)} FCFA</option>
            ))}
          </select>
          {consultationTypes.length === 0 && (
            <p style={{ fontSize: '12px', color: 'var(--color-warning-text)', marginTop: '4px' }}>
              {t.noConsultTypes}
            </p>
          )}
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
            {t.reason}
          </label>
          <input name="visit_reason" placeholder={t.reasonPlaceholder} style={inputStyle} defaultValue={appointment?.reason ?? ''} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
            {t.doctorOptional}
          </label>
          <select name="assigned_doctor_id" style={inputStyle} defaultValue={appointment?.doctor_id ?? ''}>
            <option value="">{t.noneCommonQueue}</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={submitting} style={{
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
          border: 'none', padding: '9px 16px', borderRadius: 'var(--radius-sm)',
          fontSize: '13px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer',
          opacity: submitting ? 0.7 : 1,
        }}>
          {submitting ? t.saving : t.startVisit}
        </button>
      </form>
    )
  }

  // STATE 2: registered, awaiting payment
  if (activeVisit.status === 'registered' && !activeVisit.is_emergency) {
    if (!pendingCharge) {
      // Visit exists but its charge wasn't found — a real inconsistency
      // worth surfacing plainly rather than showing a broken payment form.
      return (
        <div style={{
          background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px',
        }}>
          {t.chargeMissing}
        </div>
      )
    }

    // RECOVERY STATE: the charge is already fully paid (a prior attempt
    // succeeded server-side even though the UI didn't reflect it at the
    // time) but the visit never advanced. Showing the payment form here
    // would only produce the "would exceed invoice total" error again —
    // instead, offer to just complete the stalled transition.
    if (pendingCharge.status === 'paid') {
      return (
        <div style={{
          background: 'var(--color-success-bg)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--color-success-text)', margin: '0 0 10px' }}>
            {t.alreadyPaid(pendingCharge.amount_xaf.toLocaleString(t.locale))}
          </p>
          {errorBanner}
          <button onClick={handleRecovery} disabled={submitting} style={{
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
            border: 'none', padding: '9px 16px', borderRadius: 'var(--radius-sm)',
            fontSize: '13px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? t.processing : t.continue}
          </button>
        </div>
      )
    }

    return (
      <div style={{
        background: 'var(--color-warning-bg)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem',
      }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-warning-text)', margin: '0 0 10px' }}>
          {t.awaitingPayment(remainingDue.toLocaleString(t.locale))}
          {pendingCharge.status === 'partial' ? t.partial : ''}
        </p>
        {errorBanner}

        {!pendingInvoiceId ? (
          <p style={{ fontSize: '13px', color: 'var(--color-critical-text)' }}>
            {t.noInvoiceForCharge}
          </p>
        ) : (
          <form action={handlePayment} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <select name="payment_method" required style={{ ...inputStyle, flex: 1 }} defaultValue="cash">
              <option value="cash">{t.cash}</option>
              <option value="momo">MTN MoMo</option>
              <option value="orange_money">Orange Money</option>
            </select>
            <input name="provider_transaction_ref" placeholder={t.txRef} style={{ ...inputStyle, flex: 1 }} />
            <button type="submit" disabled={submitting} style={{
              background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
              border: 'none', padding: '9px 16px', borderRadius: 'var(--radius-sm)',
              fontSize: '13px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer',
              whiteSpace: 'nowrap', opacity: submitting ? 0.7 : 1,
            }}>
              {submitting ? t.collecting : t.collect}
            </button>
          </form>
        )}

        <details>
          <summary style={{ fontSize: '12px', color: 'var(--color-critical-text)', cursor: 'pointer' }}>
            {t.flagEmergency}
          </summary>
          <form action={handleEmergency} style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input name="emergency_reason" required placeholder={t.emergencyReason} style={{ ...inputStyle, flex: 1 }} />
            <button type="submit" disabled={submitting} style={{
              background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
              border: '1px solid var(--color-critical-text)', padding: '9px 16px',
              borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 500,
              cursor: submitting ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: submitting ? 0.7 : 1,
            }}>
              {t.confirmEmergency}
            </button>
          </form>
        </details>
      </div>
    )
  }

  // STATE 3: past the gate
  return (
    <div style={{
      background: 'var(--color-success-bg)', color: 'var(--color-success-text)',
      padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem',
      fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span>
        {t.visitInProgress} {VISIT_STATUS[activeVisit.status]?.[lang] ?? statusLabel}
        {activeVisit.is_emergency && t.emergencySuffix}
      </span>
      <Link href="/dashboard" style={{ color: 'inherit', textDecoration: 'underline', fontSize: '12px' }}>
        {t.viewQueue}
      </Link>
    </div>
  )
}
