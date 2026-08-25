import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import ImagingWorkQueue from '@/components/ImagingWorkQueue'
import ImagingCashierVerification from '@/components/ImagingCashierVerification'

export default async function ImagingPage() {
  const staff=await getCurrentStaff(); if(!['admin','doctor','lab_technician'].includes(staff.role)) redirect('/dashboard')
  const supabase=await createClient()
  const {data,error}=await supabase.from('imaging_work_queue').select('*').eq('clinic_id',staff.clinicId).order('ordered_at',{ascending:true})
  const rows=(data??[]) as any[]
  return <div><h1 style={{fontSize:18,fontWeight:500,margin:'0 0 4px'}}>{staff.preferredLanguage==='fr'?'Imagerie':'Imaging'}</h1><p style={{fontSize:13,color:'var(--color-text-secondary)',margin:'0 0 1.25rem'}}>{staff.preferredLanguage==='fr'?'File de travail, examens, comptes rendus et contrôle financier':'Work queue, reports and financial verification'}</p>{error?<div style={{padding:10,borderRadius:'var(--radius-sm)',background:'var(--color-critical-bg)',color:'var(--color-critical-text)',fontSize:12}}>{staff.preferredLanguage==='fr'?'Impossible de charger la file d’imagerie.':'Unable to load imaging work queue.'}</div>:<><ImagingCashierVerification rows={rows} lang={staff.preferredLanguage}/><ImagingWorkQueue rows={rows} lang={staff.preferredLanguage}/></>}</div>
}
