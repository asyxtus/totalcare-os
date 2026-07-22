'use client'

// components/AppointmentsList.tsx

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarPlus, CalendarDays } from 'lucide-react'
import { Button, EmptyState } from './ui'
import { useLang } from '@/lib/i18n/LangContext'
import BookAppointmentForm from './BookAppointmentForm'
import { cancelAppointmentAction, markNoShowAction } from '@/lib/actions/appointments'

interface Appointment {
  id: string
  scheduled_at: string
  duration_minutes: number
  reason: string | null
  status: 'scheduled' | 'arrived' | 'cancelled' | 'no_show'
  cancelled_reason: string | null
  visit_id: string | null
  patients: { id: string; full_name: string; patient_code: string; phone: string | null } | null
  staff: { id: string; full_name: string } | null
  service_prices: { id: string; service_name: string; price_xaf: number } | null
}
interface Doctor { id: string; full_name: string }
interface ConsultationType { id: string; service_name: string; price_xaf: number }

function fmtTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' })
}
function fmtDateLabel(dateStr: string, locale: string) {
  return new Date(`${dateStr}T12:00:00+01:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function shiftDate(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00+01:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const STR = {
  fr: {
    checkInArrival: 'Arrivée / Check-in',
    noShow: 'Absent',
    cancel: 'Annuler RDV',
    viewVisit: 'Voir la visite →',
    cancelReasonPh: 'Motif d\'annulation…',
    confirm: 'Confirmer',
    back: 'Retour',
    prev: '← Précédent',
    next: 'Suivant →',
    newAppt: '+ Nouveau rendez-vous',
    emptyDay: 'Aucun rendez-vous ce jour-là.',
    scheduleFirst: 'Planifiez le premier rendez-vous de la journée.',
    locale: 'fr-FR',
  },
  en: {
    checkInArrival: 'Arrival / Check-in',
    noShow: 'No-show',
    cancel: 'Cancel appt.',
    viewVisit: 'View visit →',
    cancelReasonPh: 'Cancellation reason…',
    confirm: 'Confirm',
    back: 'Back',
    prev: '← Previous',
    next: 'Next →',
    newAppt: '+ New appointment',
    emptyDay: 'No appointments on this day.',
    scheduleFirst: 'Schedule the first appointment of the day.',
    locale: 'en-US',
  },
} as const

const STATUS_META: Record<string, { fr: string; en: string; bg: string; text: string }> = {
  scheduled:  { fr: 'Prévu',    en: 'Scheduled', bg: 'var(--color-bg)',          text: 'var(--color-text-secondary)' },
  confirmed:  { fr: 'Confirmé', en: 'Confirmed',  bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
  arrived:    { fr: 'Arrivé',   en: 'Arrived',    bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
  no_show:    { fr: 'Absent',   en: 'No-show',    bg: 'var(--color-critical-bg)',text: 'var(--color-critical-text)' },
  cancelled:  { fr: 'Annulé',   en: 'Cancelled',  bg: 'var(--color-bg)',         text: 'var(--color-text-secondary)' },
  completed:  { fr: 'Terminé',  en: 'Completed',  bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
}

function AppointmentRow({ appt }: { appt: Appointment }) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const meta = STATUS_META[appt.status]
  const metaLabel = meta[lang]

  async function handleCancel() {
    setError(null); setPending(true)
    const result = await cancelAppointmentAction(appt.id, cancelReason)
    if (result && 'error' in result && result.error) setError(result.error)
    else { router.refresh(); setCancelling(false) }
    setPending(false)
  }

  async function handleNoShow() {
    setError(null); setPending(true)
    const result = await markNoShowAction(appt.id)
    if (result && 'error' in result && result.error) setError(result.error)
    else router.refresh()
    setPending(false)
  }

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 600, width: '52px', flexShrink: 0 }}>
          {fmtTime(appt.scheduled_at, t.locale)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>
            {appt.patients?.full_name ?? '—'}
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400, fontSize: '11px' }}>
              {' '}· {appt.patients?.patient_code}{appt.patients?.phone ? ` · ${appt.patients.phone}` : ''}
            </span>
          </p>
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {[appt.staff?.full_name, appt.service_prices?.service_name, appt.reason].filter(Boolean).join(' · ') || '—'}
          </p>
          {appt.status === 'cancelled' && appt.cancelled_reason && (
            <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '2px 0 0' }}>{appt.cancelled_reason}</p>
          )}
          {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '4px 0 0' }}>{error}</p>}
        </div>

        <span style={{
          fontSize: '10px', padding: '2px 9px', borderRadius: '999px', fontWeight: 500,
          background: meta.bg, color: meta.text, whiteSpace: 'nowrap',
        }}>
          {metaLabel}
        </span>

        {appt.status === 'scheduled' && !cancelling && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <Link href={`/patients/${appt.patients?.id}?appointment_id=${appt.id}`} style={{
              fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', textDecoration: 'none', whiteSpace: 'nowrap',
            }}>
              {t.checkInArrival}
            </Link>
            <button onClick={handleNoShow} disabled={pending} style={{
              fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-warning-text)', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {t.noShow}
            </button>
            <button onClick={() => setCancelling(true)} disabled={pending} style={{
              fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-critical-text)', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {t.cancel}
            </button>
          </div>
        )}

        {appt.status === 'arrived' && appt.visit_id && (
          <Link href={`/patients/${appt.patients?.id}`} style={{ fontSize: '11px', color: 'var(--color-accent)' }}>
            {t.viewVisit}
          </Link>
        )}
      </div>

      {cancelling && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)' }}>
          <input
            value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t.cancelReasonPh} autoFocus
            style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
          />
          <button onClick={handleCancel} disabled={pending || !cancelReason.trim()} style={{
            fontSize: '11px', padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-critical-text)', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {t.confirm}
          </button>
          <button onClick={() => setCancelling(false)} style={{
            fontSize: '11px', padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer',
          }}>
            {t.back}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppointmentsList({
  date, appointments, doctors, consultationTypes, newPatient,
}: { date: string; appointments: Appointment[]; doctors: Doctor[]; consultationTypes: ConsultationType[]; newPatient?: { id: string; full_name: string; patient_code: string } | null }) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()
  // Auto-open booking form if arriving from new patient registration
  const [booking, setBooking] = useState(!!newPatient)

  function goToDate(d: string) {
    router.push(`/reception?tab=appointments&date=${d}`)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => goToDate(shiftDate(date, -1))} style={{
            fontSize: '13px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text-primary)', cursor: 'pointer',
          }}>
            {t.prev}
          </button>
          <button onClick={() => goToDate(shiftDate(date, 0))} style={{
            fontSize: '13px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text-primary)', cursor: 'pointer', textTransform: 'capitalize',
          }}>
            {fmtDateLabel(date, t.locale)}
          </button>
          <button onClick={() => goToDate(shiftDate(date, 1))} style={{
            fontSize: '13px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text-primary)', cursor: 'pointer',
          }}>
            {t.next}
          </button>
        </div>

        {!booking && (
          <Button icon={CalendarPlus} onClick={() => setBooking(true)}>
            {t.newAppt}
          </Button>
        )}
      </div>

      {booking && (
        <BookAppointmentForm
          defaultDate={date}
          doctors={doctors}
          consultationTypes={consultationTypes}
          onDone={() => setBooking(false)}
          preSelectedPatient={newPatient ?? null}
        />
      )}

      {appointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t.emptyDay}
          action={!booking ? (
            <Button variant="secondary" size="sm" icon={CalendarPlus} onClick={() => setBooking(true)}>
              {t.scheduleFirst}
            </Button>
          ) : undefined}
        />
      ) : (
        appointments.map((a) => <AppointmentRow key={a.id} appt={a} />)
      )}
    </div>
  )
}
