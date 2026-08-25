'use client'

import { useMemo, useState } from 'react'
import { completeImagingItem, startImagingItem } from '@/lib/actions/imaging'

export type ImagingQueueRow = {
  item_id:string; imaging_order_id:string; patient_id:string; patient_name:string; code:string; name_en:string; name_fr:string; modality:string; price_xaf:number
  order_status:string; item_status:string; ordered_at:string; performed_at:string|null; reported_at:string|null; report_text:string|null
  service_charge_id:string|null; charge_amount_xaf:number|null; charge_balance_xaf:number; charge_status:string|null
}

function money(n:number){return `${Number(n||0).toLocaleString()} FCFA`}
function statusLabel(s:string,fr:boolean){const m:any={ordered:fr?'Commandé':'Ordered',paid:fr?'Payé':'Paid',waiting:fr?'En attente':'Waiting',in_progress:fr?'En cours':'In progress',completed:fr?'Terminé':'Completed',cancelled:fr?'Annulé':'Cancelled'};return m[s]??s}

export default function ImagingWorkQueue({ rows, lang }: { rows:ImagingQueueRow[]; lang:'fr'|'en' }) {
  const [filter,setFilter]=useState('active'); const [selected,setSelected]=useState<ImagingQueueRow|null>(null); const [report,setReport]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null)
  const fr=lang==='fr'
  const visible=useMemo(()=>rows.filter(r=>filter==='all'||filter==='active'?!['completed','cancelled'].includes(r.item_status):r.item_status==='completed'),[rows,filter])
  const start=async(id:string)=>{setBusy(true);setError(null);const r=await startImagingItem(id);if('error' in r){setError(r.error)}else{location.reload()}setBusy(false)}
  const finish=async()=>{if(!selected)return;if(!report.trim())return setError(fr?'Le compte rendu est obligatoire.':'Report is required.');setBusy(true);setError(null);const r=await completeImagingItem(selected.item_id,report);if('error'in r&&r.error)setError(r.error);else{setSelected(null);setReport('');location.reload()}setBusy(false)}
  return <div>
    <div style={{display:'flex',gap:6,marginBottom:10}}>{[['active',fr?'Actifs':'Active'],['completed',fr?'Terminés':'Completed'],['all',fr?'Tous':'All']].map(([id,label])=><button key={id} onClick={()=>setFilter(id)} style={{padding:'6px 10px',border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',background:filter===id?'var(--color-accent)':'transparent',color:filter===id?'var(--color-accent-text-on)':'var(--color-text-primary)',fontSize:11,cursor:'pointer'}}>{label}</button>)}</div>
    {error&&<div style={{padding:9,marginBottom:9,borderRadius:'var(--radius-sm)',background:'var(--color-critical-bg)',color:'var(--color-critical-text)',fontSize:12}}>{error}</div>}
    <div style={{display:'grid',gap:7}}>{visible.map(r=><div key={r.item_id} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:12,alignItems:'center',padding:'11px 13px',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',background:'var(--color-surface)'}}>
      <div><div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}><strong style={{fontSize:13}}>{r.patient_name}</strong><code style={{fontSize:10}}>{r.code}</code><span style={{fontSize:10,color:'var(--color-text-secondary)'}}>{r.modality}</span></div><div style={{fontSize:12,marginTop:3}}>{fr?r.name_fr:r.name_en}</div><div style={{fontSize:10,color:'var(--color-text-secondary)',marginTop:3}}>Status: {statusLabel(r.item_status,fr)} · {r.charge_status??'—'}{r.charge_balance_xaf>0?` · ${money(r.charge_balance_xaf)} due`:''}</div></div>
      <div style={{textAlign:'right',fontSize:11,fontFamily:'var(--font-mono)'}}>{money(r.charge_amount_xaf??r.price_xaf)}</div>
      <div style={{display:'flex',gap:5}}>{['paid','waiting'].includes(r.item_status)&&<button disabled={busy} onClick={()=>start(r.item_id)} style={{padding:'6px 9px',border:'none',background:'var(--color-accent)',color:'var(--color-accent-text-on)',borderRadius:'var(--radius-sm)',fontSize:10,cursor:'pointer'}}>{fr?'Démarrer':'Start'}</button>}{r.item_status==='in_progress'&&<button disabled={busy} onClick={()=>{setSelected(r);setReport(r.report_text??'')}} style={{padding:'6px 9px',border:'none',background:'var(--color-accent)',color:'var(--color-accent-text-on)',borderRadius:'var(--radius-sm)',fontSize:10,cursor:'pointer'}}>{fr?'Compte rendu':'Report'}</button>}{r.item_status==='completed'&&<button onClick={()=>{setSelected(r);setReport(r.report_text??'')}} style={{padding:'6px 9px',border:'1px solid var(--color-border)',background:'transparent',borderRadius:'var(--radius-sm)',fontSize:10,cursor:'pointer'}}>{fr?'Voir':'View'}</button>}</div>
    </div>)}</div>
    {visible.length===0&&<p style={{fontSize:12,color:'var(--color-text-secondary)'}}>{fr?'Aucun examen dans cette file.':'No examinations in this queue.'}</p>}
    {selected&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.35)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:16}}><div style={{width:'min(720px,100%)',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:16}}><div style={{display:'flex',justifyContent:'space-between'}}><div><strong>{fr?selected.name_fr:selected.name_en}</strong><div style={{fontSize:11,color:'var(--color-text-secondary)'}}>{selected.patient_name} · {selected.modality}</div></div><button onClick={()=>setSelected(null)} style={{border:'1px solid var(--color-border)',background:'transparent',borderRadius:'var(--radius-sm)',cursor:'pointer'}}>×</button></div><textarea value={report} onChange={e=>setReport(e.target.value)} disabled={selected.item_status==='completed'} placeholder={fr?'Compte rendu radiologique…':'Imaging report…'} style={{width:'100%',minHeight:220,marginTop:12,padding:10,border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',background:'var(--color-bg)',color:'var(--color-text-primary)',fontSize:13,resize:'vertical'}} />{selected.item_status!=='completed'&&<div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}><button disabled={busy} onClick={finish} style={{padding:'8px 14px',border:'none',background:'var(--color-accent)',color:'var(--color-accent-text-on)',borderRadius:'var(--radius-sm)',fontSize:12,cursor:'pointer'}}>{busy?'…':(fr?'Enregistrer le compte rendu':'Save report')}</button></div>}</div></div>}
  </div>
}
