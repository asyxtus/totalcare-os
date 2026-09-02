'use client'
import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Search, ArrowRight, AlertCircle } from 'lucide-react'
import { searchPatientJourney, type PatientJourneyResult } from '@/lib/actions/encounterJourney'

const STAGES = ['registered','triage','waiting_consultation','in_consultation','waiting_lab','waiting_pharmacy','billing','discharged']
const LABELS: Record<string,{fr:string;en:string}> = {
 registered:{fr:'Réception',en:'Reception'}, triage:{fr:'Triage',en:'Triage'}, waiting_consultation:{fr:'Consultation',en:'Consultation'}, in_consultation:{fr:'Consultation',en:'Consultation'}, waiting_lab:{fr:'Laboratoire',en:'Laboratory'}, waiting_pharmacy:{fr:'Pharmacie',en:'Pharmacy'}, billing:{fr:'Facturation',en:'Billing'}, discharged:{fr:'Terminé',en:'Completed'}
}

const money = (value: number, lang: 'fr'|'en') => `${new Intl.NumberFormat(lang==='fr'?'fr-FR':'en-US').format(value)} FCFA`

function FinancialAlert({r,lang}:{r:PatientJourneyResult;lang:'fr'|'en'}) {
 const amount = r.financial.outstanding_xaf
 if (amount <= 0) return null
 return <div style={{marginTop:10,padding:11,border:'1px solid var(--color-warning-border)',background:'var(--color-warning-bg)',borderRadius:'var(--radius-sm)'}}>
  <div style={{display:'flex',alignItems:'center',gap:7,fontWeight:700,fontSize:12,color:'var(--color-warning-text)'}}><AlertCircle size={14}/>{lang==='fr'?'Solde impayé d’une visite précédente':'Outstanding balance from a previous visit'}</div>
  <div style={{marginTop:4,fontSize:15,fontWeight:700}}>{money(amount,lang)}</div>
  <div style={{fontSize:10,color:'var(--color-text-secondary)',marginTop:3}}>{r.financial.charge_count} {lang==='fr'?'facture(s) impayée(s)':'outstanding charge(s)'}</div>
  <Link href={`/billing/patients/${r.patient.id}`} style={{display:'inline-flex',alignItems:'center',gap:5,marginTop:8,padding:'6px 9px',border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',background:'var(--color-surface)',color:'var(--color-text)',textDecoration:'none',fontSize:11,fontWeight:600}}>{lang==='fr'?'Voir le compte / encaisser':'View account / collect'} <ArrowRight size={12}/></Link>
 </div>
}

function Card({r,lang}:{r:PatientJourneyResult;lang:'fr'|'en'}) {
 const j=r.journey
 const i=j ? STAGES.indexOf(j.stage) : -1
 const href=j ? (j.stage==='waiting_pharmacy'?'/pharmacy':j.stage==='waiting_lab'?'/laboratory':`/visits/${j.visit_id}/consultation`) : `/patients/${r.patient.id}`
 return <div style={{border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:14,marginTop:10,background:'var(--color-surface)'}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><b>{r.patient.full_name}</b><div style={{fontSize:11,color:'var(--color-text-secondary)'}}>{r.patient.patient_code}</div></div>{j&&<span style={{fontSize:11,fontWeight:600,padding:'4px 8px',borderRadius:999,background:'var(--color-warning-bg)',color:'var(--color-warning-text)',display:'inline-flex',alignItems:'center',gap:4}}><MapPin size={12}/> {lang==='fr'?j.stage_label_fr:j.stage_label_en}</span>}</div>
  {!j&&<div style={{marginTop:10,padding:10,background:'var(--color-bg)',borderRadius:'var(--radius-sm)'}}><div style={{fontSize:10,color:'var(--color-text-secondary)',textTransform:'uppercase'}}>{lang==='fr'?'Parcours actuel':'Current journey'}</div><div style={{fontSize:13,fontWeight:600}}>{lang==='fr'?'Aucun parcours actif':'No active encounter'}</div><div style={{fontSize:11,color:'var(--color-text-secondary)',marginTop:4}}>{lang==='fr'?'Le patient peut commencer une nouvelle consultation.':'The patient can start a new consultation.'}</div></div>}
  {j&&<div style={{marginTop:10,padding:10,background:'var(--color-bg)',borderRadius:'var(--radius-sm)'}}><div style={{fontSize:10,color:'var(--color-text-secondary)',textTransform:'uppercase'}}>{lang==='fr'?'Action actuelle':'Current action'}</div><div style={{fontSize:13,fontWeight:600}}>{lang==='fr'?j.current_action_fr:j.current_action_en}</div>
  {j.stage==='waiting_pharmacy'&&<div style={{fontSize:11,color:'var(--color-text-secondary)',marginTop:4}}>{j.pharmacy.prescription_item_count} {lang==='fr'?'ligne(s) prescrite(s)':'prescribed item(s)'} · {j.pharmacy.remaining_item_quantity} {lang==='fr'?'unité(s) restante(s)':'unit(s) remaining'}</div>}
  {j.stage==='waiting_lab'&&<div style={{fontSize:11,color:'var(--color-text-secondary)',marginTop:4}}>{j.laboratory.item_count} {lang==='fr'?'examen(s)':'investigation(s)'} · {j.laboratory.pending_count} {lang==='fr'?'en attente':'pending'}</div>}
  <div style={{fontSize:11,color:'var(--color-text-secondary)',marginTop:4}}>{lang==='fr'?'Solde de cet encounter':'Current encounter balance'}: {money(Number(j.billing.outstanding_xaf),lang)}</div></div>}
  <FinancialAlert r={r} lang={lang}/>
  <div style={{display:'flex',gap:8,marginTop:10}}><Link href={href} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'7px 10px',borderRadius:'var(--radius-sm)',background:'var(--color-accent)',color:'var(--color-accent-text-on)',textDecoration:'none',fontSize:11,fontWeight:600}}>{lang==='fr'?'Ouvrir':'Open'} <ArrowRight size={12}/></Link><Link href={`/patients/${r.patient.id}`} style={{padding:'7px 10px',border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',color:'var(--color-text)',textDecoration:'none',fontSize:11}}>Patient</Link></div>
  {j&&<div style={{display:'flex',alignItems:'center',marginTop:12}}>{STAGES.map((s,n)=><div key={s} style={{display:'flex',alignItems:'center'}}><span title={LABELS[s]?.[lang]??s} style={{width:n===i?24:18,height:n===i?24:18,borderRadius:'50%',display:'grid',placeItems:'center',fontSize:9,border:'1px solid var(--color-border)',background:n<i?'var(--color-success-bg)':n===i?'var(--color-accent)':'var(--color-bg)',color:n===i?'var(--color-accent-text-on)':'var(--color-text-secondary)'}}>{n<i?'✓':n+1}</span>{n<STAGES.length-1&&<span style={{width:12,height:1,background:n<i?'var(--color-success-text)':'var(--color-border)'}}/>}</div>)}</div>}
 </div>
}

export default function EncounterJourneyLookup({lang}:{lang:'fr'|'en'}) {
 const [q,setQ]=useState(''); const [rows,setRows]=useState<PatientJourneyResult[]>([]); const [busy,setBusy]=useState(false); const [searched,setSearched]=useState(false); const [error,setError]=useState<string|null>(null)
 async function run(){setBusy(true);setSearched(true);setError(null);const r=await searchPatientJourney(q);setRows(r.data??[]);setError(r.error??null);setBusy(false)}
 return <section style={{marginBottom:18}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><MapPin size={16}/><b style={{fontSize:14}}>{lang==='fr'?'Parcours patient':'Patient journey'}</b><span style={{fontSize:10,color:'var(--color-text-secondary)'}}>{lang==='fr'?'Localiser le patient dans son parcours':'Find the patient in their journey'}</span></div><div style={{display:'flex',gap:8}}><div style={{position:'relative',flex:1}}><Search size={14} style={{position:'absolute',left:9,top:10,color:'var(--color-text-secondary)'}}/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&run()} placeholder={lang==='fr'?'Nom ou code patient…':'Patient name or code…'} style={{width:'100%',boxSizing:'border-box',padding:'8px 9px 8px 30px',border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',background:'var(--color-surface)',color:'var(--color-text)',fontSize:12}}/></div><button type='button' disabled={busy||q.trim().length<2} onClick={run} style={{border:0,borderRadius:'var(--radius-sm)',padding:'0 13px',background:'var(--color-accent)',color:'var(--color-accent-text-on)',fontSize:11,fontWeight:600}}>{busy?'…':lang==='fr'?'Rechercher':'Search'}</button></div>{error&&<p style={{fontSize:12,color:'var(--color-critical-text)'}}>{error}</p>}{searched&&!busy&&!error&&!rows.length&&<p style={{fontSize:12,color:'var(--color-text-secondary)'}}>{lang==='fr'?'Aucun parcours actif ou solde impayé trouvé.':'No active encounter or outstanding balance found.'}</p>}{rows.map(r=><Card key={`${r.patient.id}-${r.journey?.visit_id??'balance'}`} r={r} lang={lang}/>)}</section>
}
