import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import ImagingWorkQueue from '@/components/ImagingWorkQueue'

export default async function ImagingPage() {
  const staff = await getCurrentStaff()
  if (!['admin','doctor','lab_technician'].includes(staff.role)) redirect('/dashboard')
  const supabase = await createClient()
  const { data, error } = await supabase.from('imaging_work_queue').select('*').eq('clinic_id', staff.clinicId).order('ordered_at',{ascending:true})
  return <div><h1 style={{fontSize:18,fontWeight:500,margin:'0 0 4px'}}>{staff.preferredLanguage==='fr'?'Imagerie':'Imaging'}</h1><p style={{fontSize:13,color:'var(--color-text-secondary)',margin:'0 0 1.25rem'}}>{staff.preferredLanguage==='fr'?'File de travail, examens et comptes rendus':'Work queue, examinations and reports'}</p>{error?<div style={{padding:10,borderRadius:'var(--radius-sm)',background:'var(--color-critical-bg)',color:'var(--color-critical-text)',fontSize:12}}>{staff.preferredLanguage==='fr'?'Impossible de charger la file d’imagerie.':'Unable to load imaging work queue.'}</div>:<ImagingWorkQueue rows={(data??[]) as any} lang={staff.preferredLanguage}/>}</div>
}
