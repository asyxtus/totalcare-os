'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n/LangContext'
import { searchPatientsForBookingAction } from '@/lib/actions/appointments'
import { bookAppointmentIdempotent, type OfflineAppointmentPayload } from '@/lib/actions/appointmentOffline'
import { enqueueOfflineOperation } from '@/lib/offline/outbox'
import { getOfflineCache, setOfflineCache } from '@/lib/offline/cache'
import { hasWorkingConnection } from '@/lib/offline/connectivity'

interface Patient { id: string; full_name: string; patient_code: string; phone: string | null }
interface Doctor { id: string; full_name: string }
interface ConsultationType { id: string; service_name: string; price_xaf: number }

const STR = {
  fr: {
    title: 'Nouveau rendez-vous', patient: 'Patient *', change: 'Changer', searchPh: 'Nom, code, ou téléphone…', searching: 'Recherche…',
    notFound: 'Aucun patient trouvé. ', createNew: 'Créer un nouveau patient', date: 'Date *', time: 'Heure *', duration: 'Durée (min)',
    doctor: 'Médecin', unassigned: 'Non assigné', consultType: 'Type de consultation', unspecified: 'Non précisé', reason: 'Motif',
    reasonPh: 'ex. Contrôle tensionnel, suivi…', selectPatient: 'Sélectionnez un patient dans la liste.', create: 'Créer le rendez-vous',
    queued: 'Rendez-vous enregistré localement. Il sera synchronisé automatiquement dès que la connexion revient.', error: 'Impossible de créer le rendez-vous. La synchronisation réessaiera automatiquement.',
    cancel: 'Annuler', locale: 'fr-FR', offlineResults: 'Résultats locaux — vérifiez que le patient est toujours actif.', invalidDateTime: 'Veuillez saisir une date et une heure valides.',
  },
  en: {
    title: 'New appointment', patient: 'Patient *', change: 'Change', searchPh: 'Name, code, or phone…', searching: 'Searching…',
    notFound: 'No patient found. ', createNew: 'Create a new patient', date: 'Date *', time: 'Time *', duration: 'Duration (min)',
    doctor: 'Doctor', unassigned: 'Unassigned', consultType: 'Consultation type', unspecified: 'Not specified', reason: 'Reason',
    reasonPh: 'e.g. Blood pressure follow-up…', selectPatient: 'Select a patient from the list.', create: 'Create appointment',
    queued: 'Appointment saved locally. It will synchronize automatically when the connection returns.', error: 'Could not create the appointment. Synchronization will retry automatically.',
    cancel: 'Cancel', locale: 'en-US', offlineResults: 'Local results — verify that the patient is still active.', invalidDateTime: 'Please enter a valid date and time.',
  },
} as const

const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '100%' }
const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }
const CACHE_TTL_MS = 15 * 60 * 1000

export default function OfflineBookAppointmentForm({
  defaultDate, doctors, consultationTypes, onDone, preSelectedPatient, clinicId, staffId,
}: {
  defaultDate: string
  doctors: Doctor[]
  consultationTypes: ConsultationType[]
  onDone: () => void
  preSelectedPatient?: { id: string; full_name: string; patient_code: string } | null
  clinicId: string
  staffId: string
}) {
  const lang = useLang(); const t = STR[lang]; const router = useRouter()
  const [query, setQuery] = useState(''); const [results, setResults] = useState<Patient[]>([])
  const [selected, setSelected] = useState<Patient | null>(preSelectedPatient ? { ...preSelectedPatient, phone: null } : null)
  const [searching, setSearching] = useState(false); const [error, setError] = useState<string | null>(null)
  const [queued, setQueued] = useState(false); const [pending, setPending] = useState(false); const [usingCache, setUsingCache] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cacheKey = `reception:appointment-patient-search:${clinicId}`

  useEffect(() => {
    if (selected) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setResults([]); setUsingCache(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true); setUsingCache(false)
      try {
        if (await hasWorkingConnection(2500)) {
          const remote = await searchPatientsForBookingAction(query)
          setResults(remote); await setOfflineCache(cacheKey, remote, CACHE_TTL_MS)
        } else {
          const cached = await getOfflineCache<Patient[]>(cacheKey)
          const q = query.trim().toLowerCase()
          const filtered = (cached ?? []).filter(p => `${p.full_name} ${p.patient_code} ${p.phone ?? ''}`.toLowerCase().includes(q)).slice(0, 8)
          setResults(filtered); setUsingCache(true)
        }
      } catch {
        const cached = await getOfflineCache<Patient[]>(cacheKey).catch(() => null)
        const q = query.trim().toLowerCase()
        setResults((cached ?? []).filter(p => `${p.full_name} ${p.patient_code} ${p.phone ?? ''}`.toLowerCase().includes(q)).slice(0, 8)); setUsingCache(true)
      } finally { setSearching(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, selected, cacheKey])

  async function handleSubmit(formData: FormData) {
    if (!selected) { setError(t.selectPatient); return }
    setError(null); setQueued(false); setPending(true)
    const date = String(formData.get('date') ?? '').trim(); const time = String(formData.get('time') ?? '').trim()
    const duration = Number.parseInt(String(formData.get('duration_minutes') ?? '30'), 10)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      setError(t.invalidDateTime); setPending(false); return
    }

    const scheduledDate = new Date(`${date}T${time}:00`)
    if (!Number.isFinite(scheduledDate.getTime())) {
      setError(t.invalidDateTime); setPending(false); return
    }

    const payload: OfflineAppointmentPayload = {
      patient_id: selected.id,
      doctor_id: String(formData.get('doctor_id') ?? '').trim(),
      service_price_id: String(formData.get('service_price_id') ?? '').trim(),
      scheduled_at: scheduledDate.toISOString(),
      duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : 30,
      reason: String(formData.get('reason') ?? '').trim(),
    }
    const operationId = crypto.randomUUID()
    try {
      if (!(await hasWorkingConnection(2500))) {
        await enqueueOfflineOperation({ operation: 'appointment-booking', clinicId, staffId, payload, id: operationId })
        setQueued(true); return
      }
      const result = await bookAppointmentIdempotent(operationId, payload)
      if (result.error || !result.appointmentId) {
        setError(result.error ?? t.error); return
      }
      router.refresh(); onDone()
    } catch {
      await enqueueOfflineOperation({ operation: 'appointment-booking', clinicId, staffId, payload, id: operationId })
      setQueued(true)
    } finally { setPending(false) }
  }

  return (
    <form action={handleSubmit} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 10px' }}>{t.title}</p>
      {queued && <p role="status" style={{ fontSize: '12px', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>{t.queued}</p>}
      <div style={{ marginBottom: '10px', position: 'relative' }}>
        <label style={labelStyle}>{t.patient}</label>
        {selected ? <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)' }}><span style={{ fontSize: '13px' }}>{selected.full_name} <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>· {selected.patient_code}</span></span><button type="button" onClick={() => { setSelected(null); setQuery('') }} style={{ fontSize: '11px', border: 'none', background: 'none', color: 'var(--color-critical-text)', cursor: 'pointer' }}>{t.change}</button></div> : <><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchPh} style={inputStyle} autoComplete="off" />{query.trim().length >= 2 && <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', maxHeight: 200, overflowY: 'auto' }}>{searching ? <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: 10 }}>{t.searching}</p> : <>{usingCache && results.length > 0 && <p style={{ fontSize: 10, color: 'var(--color-warning-text)', padding: '6px 10px', margin: 0 }}>{t.offlineResults}</p>}{results.length === 0 ? <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: 10 }}>{t.notFound}<a href="/patients/new" style={{ color: 'var(--color-accent)' }}>{t.createNew}</a></p> : results.map(p => <button key={p.id} type="button" onClick={() => { setSelected(p); setResults([]) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-primary)' }}>{p.full_name} <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>· {p.patient_code}{p.phone ? ` · ${p.phone}` : ''}</span></button>)}</>}</div>}</>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div><label style={labelStyle}>{t.date}</label><input name="date" type="date" required defaultValue={defaultDate} style={inputStyle} /></div>
        <div><label style={labelStyle}>{t.time}</label><input name="time" type="time" required defaultValue="08:00" style={inputStyle} /></div>
        <div><label style={labelStyle}>{t.duration}</label><input name="duration_minutes" type="number" min="5" step="5" defaultValue="30" style={inputStyle} /></div>
        <div><label style={labelStyle}>{t.doctor}</label><select name="doctor_id" style={inputStyle} defaultValue=""><option value="">{t.unassigned}</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
        <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>{t.consultType}</label><select name="service_price_id" style={inputStyle} defaultValue=""><option value="">{t.unspecified}</option>{consultationTypes.map(s => <option key={s.id} value={s.id}>{s.service_name} — {s.price_xaf.toLocaleString(t.locale)} FCFA</option>)}</select></div>
      </div>
      <div style={{ marginBottom: 10 }}><label style={labelStyle}>{t.reason}</label><input name="reason" placeholder={t.reasonPh} style={inputStyle} /></div>
      {error && <p role="alert" style={{ fontSize: 12, color: 'var(--color-critical-text)', margin: '0 0 10px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}><button type="submit" disabled={pending} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>{pending ? '…' : t.create}</button><button type="button" onClick={onDone} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>{t.cancel}</button></div>
    </form>
  )
}
