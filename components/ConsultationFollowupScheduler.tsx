'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

function localDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ConsultationFollowupScheduler() {
  const pathname = usePathname()
  const [enabled, setEnabled] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const isConsultationPage = /^\/visits\/[^/]+\/consultation\/?$/.test(pathname ?? '')
  const today = useMemo(() => localDateString(), [])

  useEffect(() => {
    if (!isConsultationPage) return

    const form = document.querySelector('form')
    if (!form) return

    const names = ['followup_date', 'followup_time', 'followup_reason']
    const values = [enabled ? date : '', enabled ? time : '', enabled ? reason : '']

    names.forEach((name, index) => {
      let input = form.querySelector<HTMLInputElement>(`input[data-followup-field="${name}"]`)
      if (!input) {
        input = document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.dataset.followupField = name
        form.appendChild(input)
      }
      input.value = values[index]
    })
  }, [isConsultationPage, enabled, date, time, reason])

  if (!isConsultationPage) return null

  const incomplete = enabled && (!date || !time)

  return (
    <div style={{
      maxWidth: '640px',
      margin: '0 auto 1rem',
      padding: '14px',
      border: enabled ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-surface)',
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => {
            setEnabled(e.target.checked)
            setTouched(false)
          }}
        />
        Programmer un rendez-vous de suivi
      </label>

      {enabled && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
            Le rendez-vous sera créé directement à partir de cette consultation. Le système déterminera automatiquement le tarif de suivi selon la règle de la clinique. Le médecin ne saisit jamais lui-même une remise.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Date du suivi
              </label>
              <input
                type="date"
                value={date}
                min={today}
                onChange={e => {
                  setDate(e.target.value)
                  setTouched(true)
                }}
                required={enabled}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Heure
              </label>
              <input
                type="time"
                value={time}
                onChange={e => {
                  setTime(e.target.value)
                  setTouched(true)
                }}
                required={enabled}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 12 }}
              />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Motif du suivi (facultatif)
            </label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="ex. Contrôle HTA, réévaluation du traitement…"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 12 }}
            />
          </div>

          {incomplete && touched && (
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--color-danger, #b42318)' }}>
              La date et l'heure doivent être renseignées pour programmer le suivi.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
