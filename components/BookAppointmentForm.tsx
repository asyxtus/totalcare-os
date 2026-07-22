'use client'

// components/BookAppointmentForm.tsx

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { bookAppointmentAction, searchPatientsForBookingAction } from '@/lib/actions/appointments'
import { useLang } from '@/lib/i18n/LangContext'

interface Patient { id: string; full_name: string; patient_code: string; phone: string | null }
interface Doctor { id: string; full_name: string }
interface ConsultationType { id: string; service_name: string; price_xaf: number }

const STR = {
  fr: {
    title: 'Nouveau rendez-vous',
    patient: 'Patient *',
    change: 'Changer',
    searchPh: 'Nom, code, ou téléphone…',
    searching: 'Recherche…',
    notFound: 'Aucun patient trouvé. ',
    createNew: 'Créer un nouveau patient',
    date: 'Date *',
    time: 'Heure *',
    duration: 'Durée (min)',
    doctor: 'Médecin',
    unassigned: 'Non assigné',
    consultType: 'Type de consultation',
    unspecified: 'Non précisé',
    reason: 'Motif',
    reasonPh: 'ex. Contrôle tensionnel, suivi…',
    selectPatient: 'Sélectionnez un patient dans la liste.',
    create: 'Créer le rendez-vous',
    cancel: 'Annuler',
    locale: 'fr-FR',
  },
  en: {
    title: 'New appointment',
    patient: 'Patient *',
    change: 'Change',
    searchPh: 'Name, code, or phone…',
    searching: 'Searching…',
    notFound: 'No patient found. ',
    createNew: 'Create a new patient',
    date: 'Date *',
    time: 'Time *',
    duration: 'Duration (min)',
    doctor: 'Doctor',
    unassigned: 'Unassigned',
    consultType: 'Consultation type',
    unspecified: 'Not specified',
    reason: 'Reason',
    reasonPh: 'e.g. Blood pressure follow-up…',
    selectPatient: 'Select a patient from the list.',
    create: 'Create appointment',
    cancel: 'Cancel',
    locale: 'en-US',
  },
} as const

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '100%',
}
const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }

export default function BookAppointmentForm({
  defaultDate, doctors, consultationTypes, onDone, preSelectedPatient,
}: { defaultDate: string; doctors: Doctor[]; consultationTypes: ConsultationType[]; onDone: () => void; preSelectedPatient?: { id: string; full_name: string; patient_code: string } | null }) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Patient[]>([])
  const [selected, setSelected] = useState<Patient | null>(preSelectedPatient ?? null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (selected) return // don't re-search once a patient is picked
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const r = await searchPatientsForBookingAction(query)
      setResults(r)
      setSearching(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, selected])

  async function handleSubmit(formData: FormData) {
    if (!selected) { setError(t.selectPatient); return }
    formData.set('patient_id', selected.id)
    setError(null); setPending(true)
    const result = await bookAppointmentAction(formData)
    if (result?.error) setError(result.error)
    else { router.refresh(); onDone() }
    setPending(false)
  }

  return (
    <form action={handleSubmit} style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 10px' }}>{t.title}</p>

      <div style={{ marginBottom: '10px', position: 'relative' }}>
        <label style={labelStyle}>{t.patient}</label>
        {selected ? (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 12px', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)',
          }}>
            <span style={{ fontSize: '13px' }}>
              {selected.full_name} <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>· {selected.patient_code}</span>
            </span>
            <button type="button" onClick={() => { setSelected(null); setQuery('') }} style={{
              fontSize: '11px', border: 'none', background: 'none', color: 'var(--color-critical-text)', cursor: 'pointer',
            }}>
              {t.change}
            </button>
          </div>
        ) : (
          <>
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPh} style={inputStyle} autoComplete="off"
            />
            {query.trim().length >= 2 && (
              <div style={{
                position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, marginTop: '4px',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                maxHeight: '200px', overflowY: 'auto',
              }}>
                {searching ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '10px' }}>{t.searching}</p>
                ) : results.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '10px' }}>
                    {t.notFound}<a href="/patients/new" style={{ color: 'var(--color-accent)' }}>{t.createNew}</a>
                  </p>
                ) : results.map((p) => (
                  <button
                    key={p.id} type="button"
                    onClick={() => { setSelected(p); setResults([]) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                      background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-primary)',
                    }}
                  >
                    {p.full_name} <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>· {p.patient_code}{p.phone ? ` · ${p.phone}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div>
          <label style={labelStyle}>{t.date}</label>
          <input name="date" type="date" required defaultValue={defaultDate} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t.time}</label>
          <input name="time" type="time" required defaultValue="08:00" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t.duration}</label>
          <input name="duration_minutes" type="number" min="5" step="5" defaultValue="30" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t.doctor}</label>
          <select name="doctor_id" style={inputStyle} defaultValue="">
            <option value="">{t.unassigned}</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>{t.consultType}</label>
          <select name="service_price_id" style={inputStyle} defaultValue="">
            <option value="">{t.unspecified}</option>
            {consultationTypes.map((s) => <option key={s.id} value={s.id}>{s.service_name} — {s.price_xaf.toLocaleString(t.locale)} FCFA</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>{t.reason}</label>
        <input name="reason" placeholder={t.reasonPh} style={inputStyle} />
      </div>

      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={pending} style={{
          fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
        }}>
          {pending ? '…' : t.create}
        </button>
        <button type="button" onClick={onDone} style={{
          fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
          background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer',
        }}>
          {t.cancel}
        </button>
      </div>
    </form>
  )
}
