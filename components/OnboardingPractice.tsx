'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleHelp, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { StaffRole } from '@/lib/types'

type Lang = 'fr' | 'en'
type Tour = { id:string; version:number; tour_key:string; title_en:string; title_fr:string; description_en:string|null; description_fr:string|null }
type Step = { id:string; step_key:string; step_order:number; roles:string[]|null; title_en:string; title_fr:string; body_en:string; body_fr:string; action_en:string|null; action_fr:string|null; metadata?:Record<string,unknown> }
type Progress = { id:string; enabled:boolean; completed:boolean; current_step:number }

function practiceTourKey(role: StaffRole): string | null {
  switch (role) {
    case 'doctor': return 'practice_doctor'
    case 'pharmacist': return 'practice_pharmacy'
    case 'lab_technician': return 'practice_laboratory'
    case 'billing_clerk': return 'practice_billing'
    case 'receptionist':
    case 'nurse':
    case 'admin': return 'practice_reception'
    default: return null
  }
}

const demoTests = ['NFS complète', 'Créatinine', 'Glycémie']

export default function OnboardingPractice({staffId, clinicId, staffRole, lang, onClose}:{staffId:string;clinicId:string;staffRole:StaffRole;lang:Lang;onClose:()=>void}) {
  const supabase = useMemo(() => createClient(), [])
  const [tour,setTour] = useState<Tour|null>(null)
  const [steps,setSteps] = useState<Step[]>([])
  const [progress,setProgress] = useState<Progress|null>(null)
  const [busy,setBusy] = useState(true)
  const [error,setError] = useState<string|null>(null)
  const [demoState,setDemoState] = useState<Record<string,unknown>>({})

  const visibleSteps = useMemo(() => steps.filter(s => !s.roles?.length || s.roles.includes(staffRole)), [steps,staffRole])
  const currentIndex = Math.min(Math.max((progress?.current_step ?? 1)-1,0),Math.max(visibleSteps.length-1,0))
  const currentStep = visibleSteps[currentIndex]
  const isLast = visibleSteps.length > 0 && currentIndex === visibleSteps.length-1
  const selectedTests = (demoState.selectedTests as string[]|undefined) ?? []
  const paymentMode = demoState.paymentMode as string|undefined
  const amount = Number(demoState.amount ?? 0)

  useEffect(() => {
    let cancelled=false
    async function load(){
      const key=practiceTourKey(staffRole)
      if(!key){setBusy(false);return}
      setBusy(true);setError(null)
      const {data:tourData,error:tourError}=await supabase.from('onboarding_tours').select('id,version,tour_key,title_en,title_fr,description_en,description_fr').eq('tour_key',key).eq('phase',3).eq('is_active',true).order('version',{ascending:false}).limit(1).maybeSingle()
      if(cancelled)return
      if(tourError||!tourData){setError(lang==='fr'?'L’exercice n’est pas disponible pour ce rôle.':'Practice is not available for this role.');setBusy(false);return}
      const selectedTour=tourData as Tour
      const {data:stepData,error:stepError}=await supabase.from('onboarding_steps').select('id,step_key,step_order,roles,title_en,title_fr,body_en,body_fr,action_en,action_fr,target_route,target_selector,metadata').eq('tour_id',selectedTour.id).order('step_order',{ascending:true})
      if(cancelled)return
      if(stepError){setError(lang==='fr'?'Impossible de charger l’exercice.':'Unable to load practice.');setBusy(false);return}
      const {data:progressData,error:progressError}=await supabase.from('staff_onboarding_progress').select('id,enabled,completed,current_step').eq('staff_id',staffId).eq('tour_id',selectedTour.id).eq('tour_version',selectedTour.version).maybeSingle()
      if(cancelled)return
      if(progressError){setError(lang==='fr'?'Impossible de charger la progression.':'Unable to load practice progress.');setBusy(false);return}
      let selectedProgress=progressData as Progress|null
      if(!selectedProgress){
        const now=new Date().toISOString()
        const {data:created,error:createError}=await supabase.from('staff_onboarding_progress').insert({staff_id:staffId,clinic_id:clinicId,tour_id:selectedTour.id,tour_version:selectedTour.version,enabled:true,completed:false,current_step:1,started_at:now,last_seen_at:now}).select('id,enabled,completed,current_step').single()
        if(cancelled)return
        if(createError||!created){setError(lang==='fr'?'Impossible d’enregistrer votre progression.':'Unable to save your progress.');setBusy(false);return}
        selectedProgress=created as Progress
      }
      setTour(selectedTour);setSteps((stepData??[]) as Step[]);setProgress(selectedProgress);setBusy(false)
    }
    void load()
    return()=>{cancelled=true}
  },[clinicId,lang,staffId,staffRole,supabase])

  async function saveProgress(patch:Partial<Progress>){
    if(!progress)return
    const next={...progress,...patch}
    setProgress(next)
    const {error:updateError}=await supabase.from('staff_onboarding_progress').update({enabled:next.enabled,completed:next.completed,current_step:next.current_step,last_seen_at:new Date().toISOString(),completed_at:next.completed?new Date().toISOString():null}).eq('id',progress.id).eq('staff_id',staffId)
    if(updateError)setError(lang==='fr'?'La progression n’a pas pu être enregistrée.':'Progress could not be saved.')
  }

  function choose(key:string,value:unknown){setDemoState(s=>({...s,[key]:value}))}

  function canAdvance():boolean {
    if(!currentStep)return false
    switch(currentStep.step_key){
      case 'find_patient': case 'open': case 'queue': case 'find': return Boolean(demoState.confirmed)
      case 'journey': case 'confirm': case 'finish': case 'complete': case 'dispense': return Boolean(demoState.confirmed)
      case 'lab_payment': return selectedTests.length > 0
      case 'order': return Boolean(demoState.ordered)
      case 'payment_mode': return Boolean(paymentMode)
      case 'sample': return Boolean(demoState.sampleCollected)
      case 'result': return Boolean(demoState.resultVerified)
      case 'review': return Boolean(demoState.reviewed)
      case 'payment': return Boolean(demoState.paymentChecked)
      case 'stock': return Boolean(demoState.stockChecked)
      case 'amount': return amount > 0
      default: return true
    }
  }

  async function next(){
    if(!progress||!currentStep||!canAdvance())return
    if(isLast){await saveProgress({completed:true,current_step:visibleSteps.length});onClose();return}
    await saveProgress({current_step:currentIndex+2})
  }
  async function previous(){if(!progress||currentIndex<=0)return;await saveProgress({current_step:currentIndex})}

  function actionPanel(){
    if(!currentStep)return null
    const button=(label:string,onClick:()=>void,active=false)=><button type="button" onClick={onClick} style={{border:'1px solid var(--color-border)',background:active?'var(--color-accent)':'var(--color-surface)',color:active?'var(--color-accent-text-on)':'var(--color-text-primary)',padding:'10px 13px',borderRadius:9,cursor:'pointer',fontWeight:650}}>{label}</button>
    switch(currentStep.step_key){
      case 'find_patient': return <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{button(lang==='fr'?'Sélectionner le patient exemple':'Select sample patient',()=>choose('confirmed',true),Boolean(demoState.confirmed))}</div>
      case 'journey': return <div style={{background:'var(--color-bg)',border:'1px solid var(--color-border)',borderRadius:10,padding:14}}><strong>{lang==='fr'?'Patient exemple':'Sample patient'}</strong><div style={{marginTop:8}}>🟠 {lang==='fr'?'Localisation : Réception':'Location: Reception'}</div><div>{lang==='fr'?'Action : Vérifier le parcours':'Action: Check journey'}</div><div style={{marginTop:10}}>{button(lang==='fr'?'J’ai vérifié':'I checked it',()=>choose('confirmed',true),Boolean(demoState.confirmed))}</div></div>
      case 'lab_payment': return <div><div style={{display:'grid',gap:8}}>{demoTests.map(test=><label key={test} style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={selectedTests.includes(test)} onChange={e=>choose('selectedTests',e.target.checked?[...selectedTests,test]:selectedTests.filter(x=>x!==test))}/><span>{test}</span></label>)}</div><p style={{fontSize:12,color:'var(--color-text-secondary)',margin:'10px 0 0'}}>{lang==='fr'?'Sélectionnez seulement ce que le patient peut payer.':'Select only what the patient can afford.'}</p></div>
      case 'confirm': return <div style={{background:'var(--color-bg)',border:'1px solid var(--color-border)',borderRadius:10,padding:14}}><div>✓ {selectedTests.length} {lang==='fr'?'examen(s) activé(s)':'test(s) activated'}</div><div style={{marginTop:6}}>↳ {demoTests.length-selectedTests.length} {lang==='fr'?'examen(s) restent différés':'test(s) remain deferred'}</div><div style={{marginTop:10}}>{button(lang==='fr'?'Confirmer':'Confirm',()=>choose('confirmed',true),Boolean(demoState.confirmed))}</div></div>
      case 'open': return <div>{button(lang==='fr'?'Ouvrir le parcours exemple':'Open sample encounter',()=>choose('confirmed',true),Boolean(demoState.confirmed))}</div>
      case 'order': return <div>{button(lang==='fr'?'Prescrire les 3 examens':'Order all 3 tests',()=>choose('ordered',true),Boolean(demoState.ordered))}</div>
      case 'payment_mode': return <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[['pay_now','🟢 Pay now / Payer maintenant'],['charge','🟠 Charge to encounter / Facturer au parcours'],['defer','⚪ Defer / Différer']].map(([key,label])=>button(label,()=>choose('paymentMode',key),paymentMode===key))}</div>
      case 'finish': return <div>{button(lang==='fr'?'Terminer la consultation':'Finish consultation',()=>choose('confirmed',true),Boolean(demoState.confirmed))}</div>
      case 'queue': return <div>{button(lang==='fr'?'Ouvrir l’examen autorisé':'Open authorized test',()=>choose('confirmed',true),Boolean(demoState.confirmed))}</div>
      case 'sample': return <div>{button(lang==='fr'?'Prélever l’échantillon':'Collect sample',()=>choose('sampleCollected',true),Boolean(demoState.sampleCollected))}</div>
      case 'result': return <div>{button(lang==='fr'?'Vérifier le résultat':'Verify result',()=>choose('resultVerified',true),Boolean(demoState.resultVerified))}</div>
      case 'complete': return <div>{button(lang==='fr'?'Terminer l’examen':'Complete test',()=>choose('confirmed',true),Boolean(demoState.confirmed))}</div>
      case 'review': return <div>{button(lang==='fr'?'Valider la prescription':'Review prescription',()=>choose('reviewed',true),Boolean(demoState.reviewed))}</div>
      case 'payment': return <div>{button(lang==='fr'?'Vérifier le paiement':'Check payment',()=>choose('paymentChecked',true),Boolean(demoState.paymentChecked))}</div>
      case 'stock': return <div>{button(lang==='fr'?'Vérifier le stock':'Check stock',()=>choose('stockChecked',true),Boolean(demoState.stockChecked))}</div>
      case 'dispense': return <div>{button(lang==='fr'?'Délivrer (simulation)':'Dispense (simulation)',()=>choose('confirmed',true),Boolean(demoState.confirmed))}</div>
      case 'find': return <div>{button(lang==='fr'?'Ouvrir le compte exemple':'Open sample ledger',()=>choose('confirmed',true),Boolean(demoState.confirmed))}</div>
      case 'amount': return <div><label style={{display:'block',fontSize:13,fontWeight:600}}>{lang==='fr'?'Montant encaissé':'Amount collected'}<input type="number" min="1" value={demoState.amount as number|undefined ?? ''} onChange={e=>choose('amount',Number(e.target.value))} style={{display:'block',marginTop:7,width:'100%',maxWidth:260,padding:10,border:'1px solid var(--color-border)',borderRadius:8,background:'var(--color-surface)',color:'var(--color-text-primary)'}}/></label></div>
      case 'confirm': return null
      default: return <div>{button(lang==='fr'?'J’ai compris':'I understand',()=>choose('confirmed',true),Boolean(demoState.confirmed))}</div>
    }
  }

  if(busy)return <div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><div style={{background:'var(--color-surface)',borderRadius:16,padding:28}}>Loading…</div></div>
  if(error)return <div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><div style={{background:'var(--color-surface)',borderRadius:16,padding:24,maxWidth:520}}><p style={{color:'var(--color-critical-text)'}}>{error}</p><button type="button" onClick={onClose}>Close</button></div></div>
  if(!tour||!progress||!currentStep)return null

  const title=lang==='fr'?tour.title_fr:tour.title_en
  const description=lang==='fr'?tour.description_fr:tour.description_en
  const stepTitle=lang==='fr'?currentStep.title_fr:currentStep.title_en
  const stepBody=lang==='fr'?currentStep.body_fr:currentStep.body_en
  const stepAction=lang==='fr'?currentStep.action_fr:currentStep.action_en
  const disabled=!canAdvance()

  return <div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
    <div style={{width:'min(720px,100%)',maxHeight:'90vh',overflowY:'auto',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:18,boxShadow:'0 24px 80px rgba(0,0,0,.28)',padding:26}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:16}}><div><div style={{fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--color-accent)'}}>{lang==='fr'?'Mode entraînement':'Practice mode'}</div><h2 style={{margin:'5px 0',fontSize:25,color:'var(--color-text-primary)'}}>{title}</h2>{description&&<p style={{margin:0,color:'var(--color-text-secondary)',lineHeight:1.5}}>{description}</p>}</div><button type="button" onClick={onClose} aria-label={lang==='fr'?'Fermer':'Close'} style={{border:0,background:'transparent',cursor:'pointer',color:'var(--color-text-secondary)'}}><X size={21}/></button></div>
      <div style={{display:'flex',gap:5,margin:'20px 0'}}>{visibleSteps.map((s,i)=><div key={s.id} style={{height:5,flex:1,borderRadius:99,background:i<=currentIndex?'var(--color-accent)':'var(--color-border)'}}/>)}</div>
      <div style={{border:'1px solid var(--color-border)',borderRadius:13,padding:20,background:'var(--color-bg)'}}><div style={{fontSize:12,color:'var(--color-text-secondary)',marginBottom:8}}>{lang==='fr'?`Étape ${currentIndex+1} sur ${visibleSteps.length}`:`Step ${currentIndex+1} of ${visibleSteps.length}`}</div><h3 style={{margin:'0 0 10px',fontSize:20,color:'var(--color-text-primary)'}}>{stepTitle}</h3><p style={{margin:0,lineHeight:1.6,color:'var(--color-text-primary)'}}>{stepBody}</p>{stepAction&&<div style={{marginTop:18}}><div style={{fontSize:12,color:'var(--color-text-secondary)',marginBottom:8}}>{stepAction}</div>{actionPanel()}</div>}</div>
      <div style={{marginTop:18,padding:12,borderRadius:10,background:'var(--color-bg)',fontSize:12,color:'var(--color-text-secondary)'}}><CircleHelp size={15} style={{verticalAlign:'middle',marginRight:6}}/>{lang==='fr'?'Ceci est une simulation. Aucun dossier, paiement, stock ou résultat réel n’est modifié.':'This is a simulation. No real patient, payment, stock or result is changed.'}</div>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,marginTop:20}}><button type="button" onClick={previous} disabled={currentIndex===0} style={{border:'1px solid var(--color-border)',background:'var(--color-surface)',padding:'10px 14px',borderRadius:8,opacity:currentIndex===0?.45:1}}>{lang==='fr'?'Précédent':'Back'}</button><button type="button" onClick={next} disabled={disabled} style={{border:0,background:'var(--color-accent)',color:'var(--color-accent-text-on)',padding:'10px 17px',borderRadius:8,fontWeight:750,opacity:disabled?.5:1,cursor:disabled?'not-allowed':'pointer'}}>{isLast?<><CheckCircle2 size={16} style={{verticalAlign:'middle',marginRight:6}}/>{lang==='fr'?'Terminer':'Finish'}</>:lang==='fr'?'Suivant':'Next'}</button></div>
    </div>
  </div>
}
