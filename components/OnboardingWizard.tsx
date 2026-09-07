'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { StaffRole } from '@/lib/types'

type Lang = 'fr' | 'en'
type Tour = { id:string; version:number; phase:number; tour_key:string; title_en:string; title_fr:string; description_en:string|null; description_fr:string|null }
type Step = { id:string; step_key:string; step_order:number; roles:string[]|null; title_en:string; title_fr:string; body_en:string; body_fr:string; action_en:string|null; action_fr:string|null; target_route:string|null; target_selector:string|null; metadata?:Record<string,unknown> }
type Progress = { id:string; enabled:boolean; completed:boolean; current_step:number }
type Rect = { top:number; left:number; width:number; height:number }

function moduleTourKey(pathname:string|null):string|null {
  if (!pathname) return null
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'module_dashboard'
  if (pathname === '/reception' || pathname.startsWith('/reception/')) return 'module_reception'
  if (pathname === '/doctor' || pathname.startsWith('/doctor/')) return 'module_doctor'
  if (pathname === '/laboratory' || pathname.startsWith('/laboratory/')) return 'module_laboratory'
  if (pathname === '/pharmacy' || pathname.startsWith('/pharmacy/')) return 'module_pharmacy'
  if (pathname === '/billing' || pathname.startsWith('/billing/')) return 'module_billing'
  if (pathname === '/patients' || pathname.startsWith('/patients/')) return 'module_patients'
  return null
}

export default function OnboardingWizard({staffId,clinicId,staffRole,lang}:{staffId:string;clinicId:string;staffRole:StaffRole;lang:Lang}) {
  const router = useRouter(); const pathname = usePathname(); const supabase = useMemo(() => createClient(), [])
  const [tour,setTour] = useState<Tour|null>(null); const [steps,setSteps] = useState<Step[]>([]); const [progress,setProgress] = useState<Progress|null>(null)
  const [open,setOpen] = useState(false); const [busy,setBusy] = useState(true); const [error,setError] = useState<string|null>(null); const [spotlight,setSpotlight] = useState<Rect|null>(null)
  const requestedModuleTour = useMemo(() => moduleTourKey(pathname), [pathname])
  const visibleSteps = useMemo(() => steps.filter(s => !s.roles?.length || s.roles.includes(staffRole)), [steps,staffRole])
  const currentIndex = Math.min(Math.max((progress?.current_step ?? 1)-1,0),Math.max(visibleSteps.length-1,0)); const currentStep = visibleSteps[currentIndex]; const isLast = visibleSteps.length>0 && currentIndex===visibleSteps.length-1; const isContextual = (tour?.phase ?? 1)>=2

  const findTarget = useCallback((selector:string|null):HTMLElement|null => {
    if (!selector || typeof document==='undefined') return null
    for (const candidate of selector.split(',').map(s=>s.trim()).filter(Boolean)) {
      try { const el = Array.from(document.querySelectorAll<HTMLElement>(candidate)).find(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(x).visibility!=='hidden'}); if(el) return el } catch {}
    }
    return null
  },[])

  const refreshSpotlight = useCallback(() => {
    if(!open || !isContextual || !currentStep?.target_selector){setSpotlight(null);return}
    const target=findTarget(currentStep.target_selector); if(!target){setSpotlight(null);return}
    target.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'}); const r=target.getBoundingClientRect()
    setSpotlight({top:Math.max(6,r.top-7),left:Math.max(6,r.left-7),width:r.width+14,height:r.height+14})
  },[currentStep?.target_selector,findTarget,isContextual,open])

  const load = useCallback(async()=>{
    setBusy(true); setError(null); setSpotlight(null)
    const {data:coreData,error:coreError}=await supabase.from('onboarding_tours').select('id, version, phase, tour_key, title_en, title_fr, description_en, description_fr').eq('tour_key','core_workflow').eq('is_active',true).order('version',{ascending:false}).limit(1).maybeSingle()
    if(coreError||!coreData){setError(lang==='fr'?'Le guide est temporairement indisponible.':'The guide is temporarily unavailable.');setBusy(false);return}
    const coreTour=coreData as Tour
    const {data:coreProgressData,error:coreProgressError}=await supabase.from('staff_onboarding_progress').select('id, enabled, completed, current_step').eq('staff_id',staffId).eq('tour_id',coreTour.id).eq('tour_version',coreTour.version).maybeSingle()
    if(coreProgressError){setError(lang==='fr'?'Impossible de charger la progression du guide.':'Unable to load guide progress.');setBusy(false);return}
    const coreProgress=coreProgressData as Progress|null; let selectedTour=coreTour; let selectedProgress=coreProgress

    if(coreProgress?.completed && requestedModuleTour){
      const {data:moduleTourData,error:moduleTourError}=await supabase.from('onboarding_tours').select('id, version, phase, tour_key, title_en, title_fr, description_en, description_fr').eq('tour_key',requestedModuleTour).eq('phase',2).eq('is_active',true).order('version',{ascending:false}).limit(1).maybeSingle()
      if(moduleTourError){setError(lang==='fr'?'Impossible de charger le guide du module.':'Unable to load the module guide.');setBusy(false);return}
      if(moduleTourData){
        selectedTour=moduleTourData as Tour
        const {data:moduleProgressData,error:moduleProgressError}=await supabase.from('staff_onboarding_progress').select('id, enabled, completed, current_step').eq('staff_id',staffId).eq('tour_id',selectedTour.id).eq('tour_version',selectedTour.version).maybeSingle()
        if(moduleProgressError){setError(lang==='fr'?'Impossible de charger la progression du module.':'Unable to load module progress.');setBusy(false);return}
        selectedProgress=moduleProgressData as Progress|null
      }
    }

    const {data:stepData,error:stepError}=await supabase.from('onboarding_steps').select('id, step_key, step_order, roles, title_en, title_fr, body_en, body_fr, action_en, action_fr, target_route, target_selector, metadata').eq('tour_id',selectedTour.id).order('step_order',{ascending:true})
    if(stepError){setError(lang==='fr'?'Impossible de charger les étapes du guide.':'Unable to load guide steps.');setBusy(false);return}
    const nextSteps=(stepData??[]) as Step[]; setTour(selectedTour); setSteps(nextSteps)
    if(!selectedProgress){
      const now=new Date().toISOString(); const {data:created,error:createError}=await supabase.from('staff_onboarding_progress').insert({staff_id:staffId,clinic_id:clinicId,tour_id:selectedTour.id,tour_version:selectedTour.version,enabled:true,completed:false,current_step:1,started_at:now,last_seen_at:now}).select('id, enabled, completed, current_step').single()
      if(createError||!created){setError(lang==='fr'?'Le guide est disponible, mais sa progression ne peut pas être enregistrée. Appliquez la migration 167 puis rechargez la page.':'The guide is available, but progress cannot be saved. Apply migration 167 and reload the page.');setBusy(false);return}
      selectedProgress=created as Progress
    }
    setProgress(selectedProgress); setBusy(false); if(selectedProgress.enabled&&!selectedProgress.completed&&nextSteps.length>0)setOpen(true)
  },[clinicId,lang,requestedModuleTour,staffId,supabase])

  useEffect(()=>{void load()},[load])
  useEffect(()=>{if(!open||!isContextual)return;const timer=window.setTimeout(refreshSpotlight,180);const onResize=()=>refreshSpotlight();window.addEventListener('resize',onResize);window.addEventListener('scroll',onResize,true);return()=>{window.clearTimeout(timer);window.removeEventListener('resize',onResize);window.removeEventListener('scroll',onResize,true)}},[currentIndex,isContextual,open,refreshSpotlight,pathname])

  async function saveProgress(patch:Partial<Progress>){if(!progress)return;const next={...progress,...patch};setProgress(next);const {error:updateError}=await supabase.from('staff_onboarding_progress').update({enabled:next.enabled,completed:next.completed,current_step:next.current_step,last_seen_at:new Date().toISOString(),completed_at:next.completed?new Date().toISOString():null}).eq('id',progress.id).eq('staff_id',staffId);if(updateError)setError(lang==='fr'?'La progression n’a pas pu être enregistrée.':'Progress could not be saved.')}
  function openGuide(){if(!progress)return;setError(null);if(progress.completed)void saveProgress({completed:false,current_step:1,enabled:true});else if(!progress.enabled)void saveProgress({enabled:true});setOpen(true)}
  function closeGuide(){setOpen(false);setSpotlight(null);if(progress)void saveProgress({})}
  async function next(){if(!progress||!visibleSteps.length)return;if(isLast){await saveProgress({completed:true,current_step:visibleSteps.length});setOpen(false);setSpotlight(null);return}await saveProgress({current_step:currentIndex+2})}
  async function previous(){if(!progress||currentIndex<=0)return;await saveProgress({current_step:currentIndex})}
  function goToModule(){if(!currentStep?.target_route)return;if(pathname===currentStep.target_route||pathname?.startsWith(`${currentStep.target_route}/`)){refreshSpotlight();return}setOpen(false);setSpotlight(null);router.push(currentStep.target_route)}

  if(busy||!tour||!progress||visibleSteps.length===0)return error?<div style={{position:'fixed',right:18,bottom:18,zIndex:120,maxWidth:340}}><div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:12,padding:12,boxShadow:'0 8px 30px rgba(0,0,0,.14)'}}><p style={{margin:0,fontSize:12,color:'var(--color-critical-text)'}}>{error}</p></div></div>:null
  const title=lang==='fr'?tour.title_fr:tour.title_en; const description=lang==='fr'?tour.description_fr:tour.description_en; const stepTitle=lang==='fr'?currentStep.title_fr:currentStep.title_en; const stepBody=lang==='fr'?currentStep.body_fr:currentStep.body_en; const stepAction=lang==='fr'?currentStep.action_fr:currentStep.action_en
  const tooltipLeft=spotlight?Math.min(Math.max(16,spotlight.left),920):0; const tooltipTop=spotlight?Math.min(Math.max(16,spotlight.top+spotlight.height+16),620):0

  return <>
    <button type="button" onClick={openGuide} aria-label={lang==='fr'?'Ouvrir le guide TotalCare':'Open TotalCare guide'} title={lang==='fr'?'Guide / Aide':'Guide / Help'} style={{position:'fixed',right:18,bottom:18,zIndex:310,width:46,height:46,borderRadius:'50%',border:'1px solid var(--color-border)',background:'var(--color-surface)',color:'var(--color-accent)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 5px 20px rgba(0,0,0,.12)'}}><CircleHelp size={22} aria-hidden/></button>
    {open&&<div role="dialog" aria-modal="true" aria-labelledby="tc-onboarding-title" onClick={e=>{if(e.target===e.currentTarget)closeGuide()}} style={{position:'fixed',inset:0,zIndex:300,background:spotlight&&isContextual?'transparent':'rgba(0,0,0,.48)',padding:20,pointerEvents:'none'}}>
      {spotlight&&isContextual&&<><div style={{position:'fixed',top:0,left:0,right:0,height:Math.max(0,spotlight.top),background:'rgba(0,0,0,.52)',pointerEvents:'auto'}}/><div style={{position:'fixed',top:spotlight.top+spotlight.height,left:0,right:0,bottom:0,background:'rgba(0,0,0,.52)',pointerEvents:'auto'}}/><div style={{position:'fixed',top:spotlight.top,left:0,width:Math.max(0,spotlight.left),height:spotlight.height,background:'rgba(0,0,0,.52)',pointerEvents:'auto'}}/><div style={{position:'fixed',top:spotlight.top,left:spotlight.left+spotlight.width,right:0,height:spotlight.height,background:'rgba(0,0,0,.52)',pointerEvents:'auto'}}/><div style={{position:'fixed',top:spotlight.top,left:spotlight.left,width:spotlight.width,height:spotlight.height,border:'2px solid var(--color-accent)',borderRadius:10,boxShadow:'0 0 0 3px rgba(255,255,255,.8)',pointerEvents:'none'}}/></>}
      <div style={{position:spotlight&&isContextual?'fixed':'relative',top:spotlight&&isContextual?tooltipTop:'50%',left:spotlight&&isContextual?tooltipLeft:'50%',transform:spotlight&&isContextual?'none':'translate(-50%, -50%)',width:'min(680px, calc(100vw - 40px))',maxHeight:'min(760px, calc(100vh - 40px))',overflowY:'auto',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:16,boxShadow:'0 20px 60px rgba(0,0,0,.24)',padding:26,pointerEvents:'auto'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:18}}><div><p style={{margin:'0 0 6px',fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--color-accent)'}}>{isContextual?(lang==='fr'?'Guide du module':'Module guide'):(lang==='fr'?'Guide TotalCare OS':'TotalCare OS guide')}</p><h2 id="tc-onboarding-title" style={{margin:0,fontSize:24,color:'var(--color-text-primary)'}}>{title}</h2>{description&&<p style={{margin:'8px 0 0',color:'var(--color-text-secondary)',fontSize:14,lineHeight:1.55}}>{description}</p>}</div><button type="button" onClick={closeGuide} aria-label={lang==='fr'?'Fermer':'Close'} style={{border:0,background:'transparent',cursor:'pointer',color:'var(--color-text-secondary)',padding:4}}><X size={20} aria-hidden/></button></div>
        <div style={{display:'flex',gap:5,margin:'22px 0 18px'}} aria-label={lang==='fr'?'Progression du guide':'Guide progress'}>{visibleSteps.map((step,index)=><div key={step.id} style={{height:5,flex:1,borderRadius:99,background:index<=currentIndex?'var(--color-accent)':'var(--color-border)'}}/>)}</div>
        <div style={{background:'var(--color-bg)',border:'1px solid var(--color-border)',borderRadius:12,padding:20}}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}><span style={{width:30,height:30,borderRadius:'50%',background:'var(--color-accent)',color:'var(--color-accent-text-on)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}>{currentIndex+1}</span><span style={{fontSize:12,color:'var(--color-text-secondary)'}}>{lang==='fr'?`Étape ${currentIndex+1} sur ${visibleSteps.length}`:`Step ${currentIndex+1} of ${visibleSteps.length}`}</span></div><h3 style={{margin:'0 0 10px',fontSize:20,color:'var(--color-text-primary)'}}>{stepTitle}</h3><p style={{margin:0,fontSize:15,lineHeight:1.65,color:'var(--color-text-primary)'}}>{stepBody}</p>{stepAction&&currentStep.target_route&&<button type="button" onClick={goToModule} style={{marginTop:18,border:'1px solid var(--color-border)',background:'var(--color-surface)',color:'var(--color-accent)',padding:'9px 13px',borderRadius:8,cursor:'pointer',fontWeight:600}}>{stepAction} →</button>}{isContextual&&currentStep.target_selector&&!spotlight&&<p style={{margin:'14px 0 0',fontSize:12,color:'var(--color-warning-text)'}}>{lang==='fr'?'L’élément à montrer n’est pas visible sur cet écran. Vous pouvez continuer ou ouvrir le module.':'The guided element is not visible on this screen. You can continue or open the module.'}</p>}</div>
        {error&&<p style={{margin:'12px 0 0',color:'var(--color-critical-text)',fontSize:12}}>{error}</p>}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:20}}><button type="button" onClick={previous} disabled={currentIndex===0} style={{border:'1px solid var(--color-border)',background:'var(--color-surface)',color:'var(--color-text-primary)',padding:'10px 14px',borderRadius:8,cursor:currentIndex===0?'not-allowed':'pointer',opacity:currentIndex===0?.45:1,display:'flex',alignItems:'center',gap:6}}><ChevronLeft size={17} aria-hidden/>{lang==='fr'?'Précédent':'Back'}</button><button type="button" onClick={next} style={{border:0,background:'var(--color-accent)',color:'var(--color-accent-text-on)',padding:'10px 16px',borderRadius:8,cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',gap:6}}>{isLast?<><CheckCircle2 size={17} aria-hidden/>{lang==='fr'?'Terminer':'Finish'}</>:<>{lang==='fr'?'Suivant':'Next'}<ChevronRight size={17} aria-hidden/></>}</button></div>
        <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><span style={{fontSize:11,color:'var(--color-text-secondary)'}}>{lang==='fr'?'Vous pouvez rouvrir ce guide à tout moment avec ?':'You can reopen this guide anytime with ?'}</span><button type="button" onClick={()=>void saveProgress({enabled:false})} style={{border:0,background:'transparent',color:'var(--color-text-secondary)',cursor:'pointer',fontSize:11,textDecoration:'underline'}}>{lang==='fr'?'Désactiver le démarrage automatique':'Turn off automatic opening'}</button></div>
      </div>
    </div>}
  </>
}
