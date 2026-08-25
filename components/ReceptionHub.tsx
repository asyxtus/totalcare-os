'use client'

import { useState } from 'react'
import { ListOrdered, CalendarDays, PhoneCall, FlaskConical, ScanLine } from 'lucide-react'
import { TabBar, type TabDef } from './ui'
import QueueTab from './QueueTab'
import AppointmentsList from './AppointmentsList'
import ReminderCallList from './ReminderCallList'
import DirectLaboratoryTab from './DirectLaboratoryTab'
import DirectImagingTab from './DirectImagingTab'

type Tab = 'queue' | 'appointments' | 'reminders' | 'direct_lab' | 'direct_imaging'

export default function ReceptionHub({ initialTab, queueProps, appointmentsProps, reminderProps, directLabProps, directImagingProps }: {
  initialTab: Tab
  queueProps: React.ComponentProps<typeof QueueTab>
  appointmentsProps: React.ComponentProps<typeof AppointmentsList>
  reminderProps: React.ComponentProps<typeof ReminderCallList>
  directLabProps: React.ComponentProps<typeof DirectLaboratoryTab>
  directImagingProps: React.ComponentProps<typeof DirectImagingTab>
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const lang = queueProps.lang
  const pendingCalls = reminderProps.rows.filter(r => !r.reminder_called_at).length

  const tabs: TabDef<Tab>[] = [
    { id: 'queue', label: lang === 'fr' ? "File d'attente" : 'Queue', icon: ListOrdered },
    { id: 'direct_lab', label: lang === 'fr' ? 'Laboratoire direct' : 'Direct laboratory', icon: FlaskConical },
    { id: 'direct_imaging', label: lang === 'fr' ? 'Imagerie directe' : 'Direct imaging', icon: ScanLine },
    { id: 'appointments', label: lang === 'fr' ? 'Rendez-vous' : 'Appointments', icon: CalendarDays },
    { id: 'reminders', label: (lang === 'fr' ? 'Rappels' : 'Reminders') + (pendingCalls > 0 ? ` (${pendingCalls})` : ''), icon: PhoneCall },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>
            {lang === 'fr' ? 'Accès rapide aux services sans consultation' : 'Quick access to services without a consultation'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTab('direct_imaging')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', background: 'var(--color-success-bg)', color: 'var(--color-accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          <ScanLine size={14} aria-hidden />
          {lang === 'fr' ? 'Nouvelle imagerie directe' : 'New direct imaging'}
        </button>
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} className="reception-tabs" />

      {tab === 'queue' && <QueueTab {...queueProps} />}
      {tab === 'appointments' && <AppointmentsList {...appointmentsProps} newPatient={appointmentsProps.newPatient} />}
      {tab === 'direct_lab' && <DirectLaboratoryTab {...directLabProps} />}
      {tab === 'direct_imaging' && <DirectImagingTab {...directImagingProps} />}
      {tab === 'reminders' && <ReminderCallList {...reminderProps} />}
    </div>
  )
}
