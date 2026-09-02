// app/(authenticated)/reception/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import ReceptionHub from '@/components/ReceptionHub'
import { todayInDouala, dayRangeUtc } from '@/lib/utils/doualaTime'

export default async function ReceptionPage({ searchParams }: { searchParams: Promise<{ tab?: string; date?: string; new_patient?: string }> }) {
  const { tab: tabParam, date: dateParam, new_patient: newPatientId } = await searchParams
  const staff = await getCurrentStaff(); const lang = staff.preferredLanguage; const supabase = await createClient()
  let newPatient: null | { id: string; full_name: string; patient_code: string } = null
  if (newPatientId) { const { data } = await supabase.from('patients').select('id,full_name,patient_code').eq('id', newPatientId).eq('clinic_id', staff.clinicId).maybeSingle(); newPatient = data }

  const { data: awaitingPayment, error: awaitingPaymentError } = await supabase.from('visits').select('id,status,visit_reason,created_at,is_emergency,patients(id,full_name,patient_code)').eq('status','registered').order('created_at',{ascending:true})
  const { data: waitingForDoctor, error: waitingForDoctorError } = await supabase.from('visits').select('id,visit_reason,created_at,is_emergency,assigned_doctor_id,patients(id,full_name,patient_code)').eq('status','waiting_consultation').order('created_at',{ascending:true})
  const { data: primaryDoctors } = await supabase.from('staff').select('id,full_name').eq('clinic_id',staff.clinicId).eq('role','doctor').eq('is_active',true)
  const { data: secondaryDoctorRows } = await supabase.from('staff_secondary_roles').select('staff:staff_id(id,full_name,is_active,clinic_id)').eq('role','doctor')
  const secondaryDoctors = (secondaryDoctorRows ?? []).map((r:any) => r.staff).filter((s:any) => s?.is_active && s?.clinic_id === staff.clinicId)
  const doctorList = [...(primaryDoctors ?? []), ...secondaryDoctors].filter((d,i,arr) => arr.findIndex(x => x.id === d.id) === i)
  const todayStart = new Date(); todayStart.setUTCHours(-1,0,0,0)
  const { count: newPatientsToday } = await supabase.from('patients').select('id',{count:'exact',head:true}).eq('clinic_id',staff.clinicId).gte('created_at',todayStart.toISOString())

  const { data: directLabTests } = await supabase.from('clinic_lab_tests').select('id,price_xaf,lab_test_catalog(id,name_fr,name_en,category)').eq('clinic_id',staff.clinicId).eq('is_active',true).order('price_xaf',{ascending:true})
  const { data: directLabPanels } = await supabase.from('clinic_lab_panels').select('id,price_xaf,lab_panels(id,name_fr,name_en)').eq('clinic_id',staff.clinicId).eq('is_active',true).order('price_xaf',{ascending:true})
  const { data: imagingCatalog } = await supabase.from('imaging_catalog').select('id,code,name_en,name_fr,modality,price_xaf,turnaround_minutes,preparation_instructions,clinical_notes,is_active').eq('clinic_id',staff.clinicId).eq('is_active',true).order('modality').order('name_en')

  // Query pending laboratory items directly. The previous nested lab_orders
  // filter could silently omit valid payment items. Reception owns payment
  // selection, so the source of truth here is lab_order_items itself.
  const { data: pendingLabItems } = await supabase
    .from('lab_order_items')
    .select('id,item_type,status,billing_status,service_charge_id,lab_panel_id,lab_test_catalog_id,external_test_name,service_charges(amount_xaf),lab_panels(name_fr,name_en),lab_test_catalog(name_fr,name_en),lab_orders!inner(id,visit_id,clinic_id,billing_mode,ordered_at,visits!inner(id,is_emergency,patients!inner(id,full_name,patient_code)))')
    .eq('clinic_id',staff.clinicId)
    .eq('status','pending')
    .in('billing_status',['pending_payment','deferred'])
    .order('created_at',{ascending:true})

  const testPrices = new Map((directLabTests ?? []).map((x:any) => [x.id, Number(x.price_xaf ?? 0)]))
  const panelPrices = new Map((directLabPanels ?? []).map((x:any) => [x.id, Number(x.price_xaf ?? 0)]))
  const labPaymentMap = new Map<string, any>()
  for (const item of (pendingLabItems ?? []) as any[]) {
    const order = item.lab_orders; const visit = order?.visits
    if (!visit?.patients) continue
    const existing = labPaymentMap.get(order.visit_id) ?? { visitId: order.visit_id, patientName: visit.patients.full_name, patientCode: visit.patients.patient_code, isEmergency: !!visit.is_emergency, items: [] }
    const charge = Array.isArray(item.service_charges) ? item.service_charges[0] : item.service_charges
    const price = Number(charge?.amount_xaf ?? (item.item_type === 'panel' ? panelPrices.get(item.lab_panel_id) : testPrices.get(item.lab_test_catalog_id)) ?? 0)
    const name = item.external_test_name || (item.item_type === 'panel' ? item.lab_panels?.name_fr : item.lab_test_catalog?.name_fr) || (lang === 'fr' ? 'Examen de laboratoire' : 'Laboratory investigation')
    existing.items.push({ id: item.id, status: item.status, billing_status: item.billing_status, item_type: item.item_type, price_xaf: price, name })
    labPaymentMap.set(order.visit_id, existing)
  }
  const labPaymentRows = [...labPaymentMap.values()]

  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayInDouala(); const { start, end } = dayRangeUtc(date)
  const { data: appointments, error: appointmentsError } = await supabase.from('appointments').select(`id,scheduled_at,duration_minutes,reason,status,cancelled_reason,visit_id,patients(id,full_name,patient_code,phone),staff!doctor_id(id,full_name),service_prices(id,service_name,price_xaf)`).eq('clinic_id',staff.clinicId).gte('scheduled_at',start).lt('scheduled_at',end).order('scheduled_at',{ascending:true})
  const { data: consultationTypes } = await supabase.from('service_prices').select('id,service_name,price_xaf').eq('clinic_id',staff.clinicId).eq('category','consultation').eq('is_active',true).order('price_xaf',{ascending:true})
  const reminderDate = (() => { const d = new Date(new Date(todayInDouala()+'T12:00:00Z').getTime()+86400000); return d.toISOString().slice(0,10) })()
  const { data: reminderRows } = await supabase.rpc('appointment_reminder_list',{p_clinic_id:staff.clinicId,p_date:reminderDate})
  const initialTab:any = tabParam==='reminders'?'reminders':tabParam==='direct_lab'?'direct_lab':tabParam==='direct_imaging'?'direct_imaging':!!newPatientId||tabParam==='appointments'||!!dateParam?'appointments':'queue'

  return <div><h1 style={{fontSize:18,fontWeight:500,margin:'0 0 4px'}}>{lang==='fr'?'Réception':'Reception'}</h1><p style={{fontSize:13,color:'var(--color-text-secondary)',margin:'0 0 1.25rem'}}>{lang==='fr'?"File d'attente et rendez-vous":'Queue and appointments'}</p><ReceptionHub initialTab={initialTab} queueProps={{awaitingPayment:(awaitingPayment??[]) as any,waitingForDoctor:(waitingForDoctor??[]) as any,doctorList:doctorList??[],newPatientsToday:newPatientsToday??0,lang,labPaymentRows}} appointmentsProps={{date,appointments:(appointments??[]) as any,doctors:doctorList??[],consultationTypes:consultationTypes??[],newPatient}} reminderProps={{rows:(reminderRows??[]) as any,targetDate:reminderDate}} directLabProps={{lang,tests:(directLabTests??[]) as any,panels:(directLabPanels??[]) as any}} directImagingProps={{lang,items:(imagingCatalog??[]) as any}} /></div>
}
