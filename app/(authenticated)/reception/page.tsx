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

  // ── Queue tab data ──
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

  // Explicit clinic_id filter on both doctor queries — prevents cross-clinic
  // doctors appearing for platform-admin accounts.
  const { data: primaryDoctors } = await supabase
    .from('staff')
    .select('id, full_name')
    .eq('clinic_id', staff.clinicId)
    .eq('role', 'doctor')
    .eq('is_active', true)

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

  // ── Direct laboratory catalogue ──
  // Reception uses the clinic-specific catalogue so the displayed price is
  // exactly the price that the atomic database function will charge.
  const { data: directLabTests } = await supabase
    .from('clinic_lab_tests')
    .select('id, price_xaf, lab_test_catalog(id, name_fr, name_en, category)')
    .eq('clinic_id', staff.clinicId)
    .eq('is_active', true)
    .order('price_xaf', { ascending: true })

  const { data: directLabPanels } = await supabase
    .from('clinic_lab_panels')
    .select('id, price_xaf, lab_panels(id, name_fr, name_en)')
    .eq('clinic_id', staff.clinicId)
    .eq('is_active', true)
    .order('price_xaf', { ascending: true })

  // ── Appointments tab data ──
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

  // ── Reminder call list ──
  const reminderDate = (() => {
    const d = new Date(new Date(todayInDouala() + 'T12:00:00Z').getTime() + 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })()
  const { data: reminderRows } = await supabase.rpc('appointment_reminder_list', {
    p_clinic_id: staff.clinicId,
    p_date: reminderDate,
  })

  const initialTab: 'queue' | 'appointments' | 'reminders' | 'direct_lab' =
    tabParam === 'reminders' ? 'reminders'
    : tabParam === 'direct_lab' ? 'direct_lab'
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
        directLabProps={{
          lang: staff.preferredLanguage,
          tests: (directLabTests ?? []) as any,
          panels: (directLabPanels ?? []) as any,
        }}
      />
    </div>
  )
}
