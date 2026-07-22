// components/QueueTab.tsx
import QueueList from './QueueList'
import TransferControl from './TransferControl'
import { StatCard, StatCardRow } from './dashboard/StatCard'

function timeAgo(dateStr: string, lang: 'fr' | 'en'): string {
  const minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (lang === 'fr') {
    if (minutes < 1) return "à l'instant"
    if (minutes < 60) return `il y a ${minutes} min`
    return `il y a ${Math.floor(minutes / 60)} h`
  }
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ago`
}

const STR = {
  fr: {
    awaitingPayment: 'En attente de paiement',
    awaitingDoctor: 'En attente de médecin',
    newPatientsToday: "Nouveaux patients (aujourd'hui)",
    emptyPayment: 'Aucun patient en attente de paiement.',
    waitingDoctorHeader: "En attente d'un médecin",
    emptyConsult: 'Aucun patient en attente de consultation.',
    emergency: 'URGENCE',
    unassigned: 'Non assigné',
  },
  en: {
    awaitingPayment: 'Awaiting payment',
    awaitingDoctor: 'Awaiting doctor',
    newPatientsToday: 'New patients (today)',
    emptyPayment: 'No patients awaiting payment.',
    waitingDoctorHeader: 'Awaiting a doctor',
    emptyConsult: 'No patients waiting for consultation.',
    emergency: 'EMERGENCY',
    unassigned: 'Unassigned',
  },
} as const

interface Visit {
  id: string
  status?: string
  visit_reason: string | null
  created_at: string
  is_emergency: boolean
  assigned_doctor_id?: string | null
  patients: { id: string; full_name: string; patient_code: string } | null
}
interface Doctor { id: string; full_name: string }

export default function QueueTab({
  awaitingPayment, waitingForDoctor, doctorList, newPatientsToday, lang,
}: {
  awaitingPayment: Visit[]
  waitingForDoctor: Visit[]
  doctorList: Doctor[]
  newPatientsToday: number
  lang: 'fr' | 'en'
}) {
  const t = STR[lang]
  return (
    <div>
      <StatCardRow>
        <StatCard label={t.awaitingPayment} value={awaitingPayment.length} />
        <StatCard label={t.awaitingDoctor} value={waitingForDoctor.length} />
        <StatCard label={t.newPatientsToday} value={newPatientsToday} />
      </StatCardRow>

      <QueueList
        visits={awaitingPayment as any}
        lang={lang}
        getHref={(v) => `/patients/${v.patients?.id}`}
        emptyMessage={t.emptyPayment}
      />

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '1.5rem 0 8px' }}>
        {t.waitingDoctorHeader}
      </p>

      {waitingForDoctor.length === 0 && (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          {t.emptyConsult}
        </p>
      )}

      {waitingForDoctor.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {waitingForDoctor.map((visit, i) => {
            const patient = visit.patients
            const assignedDoctor = doctorList.find((d) => d.id === visit.assigned_doctor_id)
            return (
              <div key={visit.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: i < waitingForDoctor.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: '13px' }}>
                    {patient?.full_name ?? '—'}
                    {visit.is_emergency && (
                      <span style={{
                        fontSize: '10px', marginLeft: '6px', padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
                      }}>
                        {t.emergency}
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {patient?.patient_code} · {assignedDoctor ? `Dr. ${assignedDoctor.full_name}` : t.unassigned}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{timeAgo(visit.created_at, lang)}</span>
                  <TransferControl visitId={visit.id} doctors={doctorList} currentDoctorId={visit.assigned_doctor_id ?? null} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
