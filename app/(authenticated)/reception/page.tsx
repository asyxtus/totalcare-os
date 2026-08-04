// app/(authenticated)/reception/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import ReceptionHub from '@/components/ReceptionHub'
import { todayInDouala, dayRangeUtc } from '@/lib/utils/doualaTime'

export default async function ReceptionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; date?: string; new_patient?: string }>
}) {
  const { tab: tabParam, date: dateParam, new_patient: newPatientId } = await searchParams
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  // If arriving from new patient registration, fetch that patient's basic
  // info so the booking form opens pre-selected — receptionist doesn't
  // have to search for someone they just registered.
  let newPatient: { id: string; full_name: string; patient_code: string } | null = null
  if (newPatientId) {
    const { data } = await supabase
      .from('patients')
      .select('id, full_name, patient_code')
      .eq('id', newPatientId)
      .eq('clinic_id', staff.clinicId)
      .maybeSingle()
    newPatient = data
  }

  // ── Queue tab data (unchanged from the old standalone Reception page) ──
  const { data: awaitingPayment, error: awaitingPaymentError } = await supabase
    .from('visits')
    .select('id, status, visit_reason, created_at, is_emergency, patients(id, full_name, patient_code)')
    .eq('status', 'registered')
    .order('created_at', { ascending: true })

  const { data: waitingForDoctor, error: waitingForDoctorError } = await supabase
    .from('visits')
    .select('id, visit_reason, created_at, is_emergency, assigned_doctor_id, patients(id, full_name, patient_code)')
    .eq('status', 'waiting_consultation')
    .order('created_at', { ascending: true })

  // THE FIX: explicit clinic_id filter on both doctor queries — previously
  // relied on RLS alone, which leaked another clinic's doctors into this
  // list for any account that happens to also be an active platform
  // admin (see migration 143). staff_secondary_roles has no clinic_id
  // of its own, so it's filtered through the nested staff:staff_id(...)
  // relationship instead.
  const { data: primaryDoctors } = await supabase
    .from('staff')
    .select('id, full_name')
    .eq('clinic_id', staff.clinicId)
    .eq('role', 'doctor')
    .eq('is_active', true)

  // Someone whose PRIMARY role is something else but who holds "doctor"
  // as a secondary role — via the multi-role switcher — should still
  // show up here as someone a patient can be assigned/checked in to.
  const { data: secondaryDoctorRows } = await supabase
    .from('staff_secondary_roles')
    .select('staff:staff_id(id, full_name, is_active, clinic_id)')
    .eq('role', 'doctor')
  const secondaryDoctors = (secondaryDoctorRows ?? [])
    .map((r: any) => r.staff)
    .filter((s: any) => s?.is_active && s?.clinic_id === staff.clinicId)

  const doctorList = [...(primaryDoctors ?? []), ...secondaryDoctors]
    .filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i)

  const todayStart = new Date()
  todayStart.setUTCHours(-1, 0, 0, 0)
  const { count: newPatientsToday } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', staff.clinicId)
    .gte('created_at', todayStart.toISOString())

  // ── Appointments tab data (moved from the old standalone /appointments) ──
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayInDouala()
  const { start, end } = dayRangeUtc(date)

  const { data: appointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select(`
      id, scheduled_at, duration_minutes, reason, status, cancelled_reason, visit_id,
      patients ( id, full_name, patient_code, phone ),
      staff!doctor_id ( id, full_name ),
      service_prices ( id, service_name, price_xaf )
    `)
    .eq('clinic_id', staff.clinicId)
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .order('scheduled_at', { ascending: true })

  const { data: consultationTypes } = await supabase
    .from('service_prices')
    .select('id, service_name, price_xaf')
    .eq('clinic_id', staff.clinicId)
    .eq('category', 'consultation')
    .eq('is_active', true)
    .order('price_xaf', { ascending: true })

  // ── Reminder call list — tomorrow's scheduled appointments ──
  // Compute tomorrow in Douala time (today + 1 day)
  const reminderDate = (() => {
    const d = new Date(new Date(todayInDouala() + 'T12:00:00Z').getTime() + 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })()
  const { data: reminderRows } = await supabase.rpc('appointment_reminder_list', {
    p_clinic_id: staff.clinicId,
    p_date: reminderDate,
  })

  // Land on appointments tab if arriving from new patient registration,
  // if a specific date is requested, or if explicitly asked for.
  // Otherwise default to the queue — the higher-frequency task.
  const initialTab: 'queue' | 'appointments' | 'reminders' =
    tabParam === 'reminders' ? 'reminders'
    : !!newPatientId || tabParam === 'appointments' || !!dateParam ? 'appointments'
    : 'queue'

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>{lang==='fr'?'Réception':'Reception'}</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        {lang === 'fr' ? "File d'attente et rendez-vous" : 'Queue and appointments'}
      </p>

      <ReceptionHub
        initialTab={initialTab}
        queueProps={{
          awaitingPayment: (awaitingPayment ?? []) as any,
          waitingForDoctor: (waitingForDoctor ?? []) as any,
          doctorList: doctorList ?? [],
          newPatientsToday: newPatientsToday ?? 0,
          lang: staff.preferredLanguage,
        }}
        appointmentsProps={{
          date,
          appointments: (appointments ?? []) as any,
          doctors: doctorList ?? [],
          consultationTypes: consultationTypes ?? [],
          newPatient,
        }}
        reminderProps={{
          rows: (reminderRows ?? []) as any,
          targetDate: reminderDate,
        }}
      />
    </div>
  )
}
