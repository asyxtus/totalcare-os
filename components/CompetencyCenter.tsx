'use client'

import { useEffect, useMemo, useState } from 'react'
import { Award, CheckCircle2, CircleHelp, GraduationCap, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { StaffRole } from '@/lib/types'

type Lang='fr'|'en'
type Scenario={id:string;scenario_key:string;title_en:string;title_fr:string;description_en:string;description_fr:string;roles:string[];module_key:string|null;difficulty:string;passing_score:number}
type Step={id:string;step_order:number;prompt_en:string;prompt_fr:string;options:{id:string;en:string;fr:string}[];correct_option:string;explanation_en:string;explanation_fr:string;points:number}
type Attempt={id:string;score:number;passed:boolean;completed_at:string|null}
type AttemptRow=Attempt & {scenario_id:string}

export default function CompetencyCenter({staffId,clinicId,staffRole,lang}:{staffId:string;clinicId:string;staffRole:StaffRole;lang:Lang}){
 const supabase=useMemo(()=>createClient(),[])
 const [open,setOpen]=useState(false); const [scenarios,setScenarios]=useState<Scenario[]>([]); const [attempts,setAttempts]=useState<Record<string,Attempt[]>>({}); const [scenario,setScenario]=useState<Scenario|null>(null); const [steps,setSteps]=useState<Step[]>([]); const [index,setIndex]=useState(0); const [answers,setAnswers]=useState<string[]>([]); const [selected,setSelected]=useState<string|null>(null); const [showExplanation,setShowExplanation]=useState(false); const [score,setScore]=useState(0); const [saving,setSaving]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState<string|null>(null)
 const available=scenarios.filter(s=>!s.roles.length||s.roles.includes(staffRole));
 useEffect(()=>{if(!open)return; void load()},[open,staffId])
 async function load(){
  setLoading(true);setError(null)
  const {data,error}=await supabase.from('training_scenarios').select('id,scenario_key,title_en,title_fr,description_en,description_fr,roles,module_key,difficulty,passing_score').eq('phase',4).eq('is_active',true).order('module_key')
  if(error){setError(error.message);setLoading(false);return}
  setScenarios((data??[]) as Scenario[])
  const {data:attemptRows,error:ae}=await supabase.from('training_attempts').select('id,scenario_id,score,passed,completed_at').eq('staff_id',staffId).order('completed_at',{ascending:false})
  if(!ae){
   const grouped:Record<string,Attempt[]>={}
   const rows:AttemptRow[]=(attemptRows??[]) as AttemptRow[]
   rows.forEach((row:AttemptRow)=>{
    const key:string=row.scenario_id
    const attempt:Attempt={id:row.id,score:row.score,passed:row.passed,completed_at:row.completed_at}
    ;(grouped[key]??=[]).push(attempt)
   })
   setAttempts(grouped)
  }
  setLoading(false)
 }
 async function start(s:Scenario){setScenario(s);setIndex(0);setAnswers([]);setSelected(null);setShowExplanation(false);setScore(0);setError(null);const {data,error}=await supabase.from('training_scenario_steps').select('id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points').eq('scenario_id',s.id).order('step_order');if(error){setError(error.message);return}setSteps((data??[]) as Step[])}
 function choose(id:string){if(showExplanation)return;setSelected(id);setShowExplanation(true)}
 async function next(){if(!scenario||!selected||!steps[index])return;const step=steps[index];const correct=selected===step.correct_option;const nextScore=score+(correct?step.points:0);setScore(nextScore);const nextAnswers=[...answers,selected];setAnswers(nextAnswers);if(index<steps.length-1){setIndex(index+1);setSelected(null);setShowExplanation(false);return}setSaving(true);const total=steps.reduce((n,s)=>n+s.points,0);const pct=Math.round((nextScore/Math.max(total,1))*100);const passed=pct>=scenario.passing_score;const {data,error}=await supabase.from('training_attempts').insert({staff_id:staffId,clinic_id:clinicId,scenario_id:scenario.id,score:pct,passed,answers:steps.map((s,i)=>({step_id:s.id,selected:nextAnswers[i]??null,correct:nextAnswers[i]===s.correct_option})),completed_at:new Date().toISOString()}).select('id,score,passed,completed_at').single();if(error){setError(lang==='fr'?'Impossible d’enregistrer votre résultat.':'Unable to save your result.')}else setAttempts(prev=>({...prev,[scenario.id]:[data as Attempt,...(prev[scenario.id]??[])]}));setSaving(false);setIndex(steps.length)}
 function close(){setOpen(false);setScenario(null);setSteps([]);setError(null)}
 const final=index>=steps.length&&scenario; const current=steps[index];
 return <>
  <button type="button" onClick={()=>setOpen(true)} title={lang==='fr'?'Formation et compétences':'Training & competency'} aria-label={lang==='fr'?'Ouvrir la formation':'Open training'} style={{position:'fixed',right:74,bottom:18,zIndex:310,width:46,height:46,borderRadius:'50%',border:'1px solid var(--color-border)',background:'var(--color-surface)',color:'var(--color-accent)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 5px 20px rgba(0,0,0,.12)'}}><GraduationCap size={22}/></button>
  {open&&<div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,zIndex:320,background:'rgba(0,0,0,.48)',padding:20,overflowY:'auto'}}><div style={{width:'min(820px,calc(100vw - 40px))',margin:'4vh auto',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:18,boxShadow:'0 20px 70px rgba(0,0,0,.28)',padding:26}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start'}}><div><p style={{margin:'0 0 5px',fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--color-accent)'}}>{lang==='fr'?'Compétences':'Competency'}</p><h2 style={{margin:0,fontSize:25,color:'var(--color-text-primary)'}}>{lang==='fr'?'Académie TotalCare':'TotalCare Academy'}</h2><p style={{margin:'7px 0 0',color:'var(--color-text-secondary)',fontSize:13}}>{lang==='fr'?'Apprendre → Pratiquer → Vérifier. Aucun scénario ne modifie les données réelles.':'Learn → Practice → Verify. Training scenarios never modify real data.'}</p></div><button onClick={close} type="button" aria-label="Close" style={{border:0,background:'transparent',cursor:'pointer',color:'var(--color-text-secondary)'}}><X size={20}/></button></div>
   {error&&<div style={{marginTop:16,padding:11,borderRadius:10,border:'1px solid var(--color-border)',color:'var(--color-critical-text)',fontSize:13}}>{error}</div>}
   {!scenario&&!loading&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12,marginTop:22}}>{available.map(s=>{const last=attempts[s.id]?.[0];return <button key={s.id} type="button" onClick={()=>void start(s)} style={{textAlign:'left',padding:16,border:'1px solid var(--color-border)',borderRadius:14,background:'var(--color-bg)',cursor:'pointer'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong style={{fontSize:15,color:'var(--color-text-primary)'}}>{lang==='fr'?s.title_fr:s.title_en}</strong>{last?.passed&&<CheckCircle2 size={18} aria-label="Passed"/>}</div><p style={{fontSize:12,lineHeight:1.5,color:'var(--color-text-secondary)',margin:'8px 0 12px'}}>{lang==='fr'?s.description_fr:s.description_en}</p><span style={{fontSize:11,color:'var(--color-text-secondary)'}}>{s.difficulty} · {last?`${last.score}%`:(lang==='fr'?'Pas encore évalué':'Not attempted')}</span></button>})}</div>}
   {loading&&<p style={{marginTop:24,color:'var(--color-text-secondary)'}}>{lang==='fr'?'Chargement…':'Loading…'}</p>}
   {scenario&&current&&!final&&<div style={{marginTop:22}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--color-text-secondary)'}}><span>{lang==='fr'?`Étape ${index+1} sur ${steps.length}`:`Step ${index+1} of ${steps.length}`}</span><span>{scenario.difficulty}</span></div><div style={{height:6,borderRadius:99,background:'var(--color-border)',margin:'8px 0 20px'}}><div style={{height:'100%',width:`${((index+1)/steps.length)*100}%`,borderRadius:99,background:'var(--color-accent)'}}/></div><h3 style={{fontSize:20,lineHeight:1.35,color:'var(--color-text-primary)'}}>{lang==='fr'?current.prompt_fr:current.prompt_en}</h3><div style={{display:'grid',gap:10,marginTop:18}}>{current.options.map(o=><button key={o.id} type="button" disabled={showExplanation} onClick={()=>choose(o.id)} style={{textAlign:'left',padding:14,border:'1px solid var(--color-border)',borderRadius:12,background:selected===o.id?'var(--color-accent-soft)':'var(--color-surface)',color:'var(--color-text-primary)',cursor:showExplanation?'default':'pointer'}}>{lang==='fr'?o.fr:o.en}</button>)}</div>{showExplanation&&<div style={{marginTop:16,padding:14,borderRadius:12,border:'1px solid var(--color-border)',background:'var(--color-bg)'}}><strong>{selected===current.correct_option?(lang==='fr'?'✓ Correct':'✓ Correct'):(lang==='fr'?'✕ À corriger':'✕ Review')}</strong><p style={{margin:'7px 0 0',fontSize:13,lineHeight:1.55,color:'var(--color-text-secondary)'}}>{lang==='fr'?current.explanation_fr:current.explanation_en}</p></div>}<div style={{display:'flex',justifyContent:'flex-end',marginTop:20}}><button type="button" disabled={!selected||saving} onClick={()=>void next()} style={{padding:'10px 16px',border:0,borderRadius:9,background:'var(--color-accent)',color:'var(--color-accent-text-on)',cursor:selected?'pointer':'not-allowed',fontWeight:700}}>{index===steps.length-1?(saving?(lang==='fr'?'Enregistrement…':'Saving…'):(lang==='fr'?'Terminer':'Finish')):(lang==='fr'?'Continuer':'Continue')}</button></div></div>}
   {scenario&&final&&<div style={{marginTop:24,textAlign:'center'}}><Award size={42} style={{color:'var(--color-accent)'}}/><h3 style={{fontSize:24,color:'var(--color-text-primary)'}}>{lang==='fr'?'Évaluation terminée':'Assessment complete'}</h3><p style={{fontSize:34,fontWeight:800,margin:'8px 0',color:'var(--color-text-primary)'}}>{Math.round((score/Math.max(steps.reduce((n,s)=>n+s.points,0),1))*100)}%</p><p style={{color:'var(--color-text-secondary)'}}>{Math.round((score/Math.max(steps.reduce((n,s)=>n+s.points,0),1))*100)>=scenario.passing_score?(lang==='fr'?'Compétence validée ✓':'Competency passed ✓'):(lang==='fr'?'À revoir — vous pouvez recommencer.':'Needs review — you can try again.')}</p><button type="button" onClick={()=>{setScenario(null);setSteps([])}} style={{marginTop:12,padding:'10px 16px',border:'1px solid var(--color-border)',borderRadius:9,background:'var(--color-surface)',cursor:'pointer'}}>{lang==='fr'?'Retour aux scénarios':'Back to scenarios'}</button></div>}
  </div></div>}
 </>
}
