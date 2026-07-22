'use client'

// components/ReminderCallList.tsx
//
// The receptionist's daily call list. Shows tomorrow's scheduled appointments
// with the patient's phone number, ordered by time. For each one the
// receptionist calls, then marks the outcome (confirmed / no answer /
// rescheduled / cancelled). No SMS gateway needed — this is the low-tech,
// high-impact no-show reducer.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markAppointmentReminded } from '@/lib/actions/appointments'
import { useLang } from '@/lib/i18n/LangContext'

interface ReminderRow {
  appointment_id: string
  scheduled_at: string
  patient_id: string
  patient_name: string
  patient_phone: string | null
  doctor_name: string | null
  reason: string | null
  reminder_called_at: string | null
  reminder_outcome: string | null
}

const OUTCOME_META: Record<string, { fr: string; en: string; bg: string; color: string }> = {
  confirmed:   { fr: 'Confirmé',    en: 'Confirmed',   bg: 'var(--color-success-bg)',  color: 'var(--color-success-text)' },
  no_answer:   { fr: 'Sans réponse', en: 'No answer',   bg: 'var(--color-warning-bg)',  color: 'var(--color-warning-text)' },
  rescheduled: { fr: 'Reprogrammé',  en: 'Rescheduled', bg: 'var(--color-bg)',          color: 'var(--color-text-secondary)' },
  cancelled:   { fr: 'Annulé',       en: 'Cancelled',   bg: 'var(--color-critical-bg)', color: 'var(--color-critical-text)' },
}

export default function ReminderCallList({ rows, targetDate }: { rows: ReminderRow[]; targetDate: string }) {
  const lang = useLang()
  const router = useRouter()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<Set<string>>(new Set())

  async function mark(appointmentId: string, outcome: string) {
    setBusy(appointmentId)
    await markAppointmentReminded(appointmentId, outcome)
    setBusy(null)
    setEditing(prev => { const n = new Set(prev); n.delete(appointmentId); return n })
    router.refresh()
  }

  const dateLabel = new Date(targetDate + 'T12:00:00Z').toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const called = rows.filter(r => r.reminder_called_at).length
  const total = rows.length

  if (total === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {lang === 'fr'
            ? `Aucun rendez-vous prévu pour ${dateLabel}.`
            : `No appointments scheduled for ${dateLabel}.`}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
          {lang === 'fr'
            ? 'Les rappels apparaissent ici la veille des rendez-vous programmés.'
            : 'Reminders appear here the day before scheduled appointments.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, textTransform: 'capitalize' }}>{dateLabel}</p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {lang === 'fr'
              ? `${called}/${total} patient(s) appelé(s)`
              : `${called}/${total} patient(s) called`}
          </p>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textAlign: 'right', maxWidth: '200px' }}>
          {lang === 'fr'
            ? 'Appelez chaque patient pour confirmer sa présence et réduire les absences.'
            : 'Call each patient to confirm and reduce no-shows.'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((r) => {
          const time = new Date(r.scheduled_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
          const outcome = r.reminder_outcome ? OUTCOME_META[r.reminder_outcome] : null
          const isDone = !!r.reminder_called_at

          // Build a tel: link and a WhatsApp link from the phone
          const phoneDigits = r.patient_phone?.replace(/[^\d]/g, '') ?? ''
          const waPhone = phoneDigits.length === 9 ? '237' + phoneDigits
            : phoneDigits.length === 10 && phoneDigits.startsWith('0') ? '237' + phoneDigits.slice(1)
            : phoneDigits

          return (
            <div key={r.appointment_id} style={{
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
              padding: '12px 14px', background: isDone ? 'var(--color-surface)' : 'var(--color-bg)',
              opacity: isDone ? 0.85 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                {/* Left: patient + time */}
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>{time}</span>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{r.patient_name}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {r.doctor_name ? `${lang === 'fr' ? 'Dr' : 'Dr'} ${r.doctor_name}` : (lang === 'fr' ? 'Médecin non assigné' : 'No doctor assigned')}
                    {r.reason ? ` · ${r.reason}` : ''}
                  </div>
                </div>

                {/* Middle: phone + call links */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {r.patient_phone ? (
                    <>
                      <a href={`tel:${r.patient_phone}`} style={{
                        fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)',
                        textDecoration: 'none', padding: '4px 10px', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap',
                      }}>
                        📞 {r.patient_phone}
                      </a>
                      {waPhone.length >= 11 && (
                        <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer" style={{
                          fontSize: '12px', color: '#fff', background: '#25D366', textDecoration: 'none',
                          padding: '5px 10px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap',
                        }}>
                          WhatsApp
                        </a>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--color-critical-text)' }}>
                      ⚠ {lang === 'fr' ? 'Pas de numéro' : 'No phone number'}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom: outcome buttons or the recorded outcome */}
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)' }}>
                {outcome && !editing.has(r.appointment_id) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '999px', background: outcome.bg, color: outcome.color, fontWeight: 500 }}>
                      ✓ {outcome[lang]}
                    </span>
                    <button onClick={() => setEditing(prev => new Set(prev).add(r.appointment_id))} disabled={busy === r.appointment_id} style={{
                      fontSize: '11px', color: 'var(--color-text-secondary)', background: 'none',
                      border: 'none', cursor: 'pointer', textDecoration: 'underline',
                    }}>
                      {lang === 'fr' ? 'Modifier' : 'Change'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginRight: '4px' }}>
                      {lang === 'fr' ? 'Résultat de l\'appel :' : 'Call outcome:'}
                    </span>
                    {(['confirmed', 'no_answer', 'rescheduled', 'cancelled'] as const).map((o) => (
                      <button key={o} onClick={() => mark(r.appointment_id, o)} disabled={busy === r.appointment_id} style={{
                        fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${OUTCOME_META[o].color}`, background: 'transparent',
                        color: OUTCOME_META[o].color, cursor: busy === r.appointment_id ? 'wait' : 'pointer',
                      }}>
                        {OUTCOME_META[o][lang]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
