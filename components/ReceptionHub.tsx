'use client'

// components/ReceptionHub.tsx

import { useState } from 'react'
import { ListOrdered, CalendarDays, PhoneCall, FlaskConical } from 'lucide-react'
import { TabBar, type TabDef } from './ui'
import QueueTab from './QueueTab'
import AppointmentsList from './AppointmentsList'
import ReminderCallList from './ReminderCallList'
import DirectLaboratoryTab from './DirectLaboratoryTab'

type Tab = 'queue' | 'appointments' | 'reminders' | 'direct_lab'

export default function ReceptionHub({
  initialTab, queueProps, appointmentsProps, reminderProps, directLabProps,
}: {
  initialTab: Tab
  queueProps: React.ComponentProps<typeof QueueTab>
  appointmentsProps: React.ComponentProps<typeof AppointmentsList>
  reminderProps: React.ComponentProps<typeof ReminderCallList>
  directLabProps: React.ComponentProps<typeof DirectLaboratoryTab>
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const lang = queueProps.lang

  const pendingCalls = reminderProps.rows.filter((r) => !r.reminder_called_at).length

  const tabs: TabDef<Tab>[] = [
    { id: 'queue', label: lang === 'fr' ? "File d'attente" : 'Queue', icon: ListOrdered },
    { id: 'appointments', label: lang === 'fr' ? 'Rendez-vous' : 'Appointments', icon: CalendarDays },
    {
      id: 'direct_lab',
      label: lang === 'fr' ? 'Laboratoire direct' : 'Direct laboratory',
      icon: FlaskConical,
    },
    {
      id: 'reminders',
      label: (lang === 'fr' ? 'Rappels' : 'Reminders') + (pendingCalls > 0 ? ` (${pendingCalls})` : ''),
      icon: PhoneCall,
    },
  ]

  return (
    <div>
      <TabBar tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'queue' && <QueueTab {...queueProps} />}
      {tab === 'appointments' && <AppointmentsList {...appointmentsProps} newPatient={appointmentsProps.newPatient} />}
      {tab === 'direct_lab' && <DirectLaboratoryTab {...directLabProps} />}
      {tab === 'reminders' && <ReminderCallList {...reminderProps} />}
    </div>
  )
}
