'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createImagingCatalogAction, updateImagingPriceAction, toggleImagingActiveAction } from '@/lib/actions/imagingPricing'

export interface ImagingCatalogItem {
  id: string; code: string; name_en: string; name_fr: string; modality: string; price_xaf: number
  turnaround_minutes: number | null; preparation_instructions: string | null; clinical_notes: string | null; is_active: boolean
}

const input: React.CSSProperties = { padding: '7px 9px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: '12px', width: '100%' }

export default function ImagingSection({ items, lang }: { items: ImagingCatalogItem[]; lang: 'fr' | 'en' }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return !q ? items : items.filter(i => [i.code, i.name_en, i.name_fr, i.modality].some(v => v?.toLowerCase().includes(q)))
  }, [items, search])

  async function savePrice(id: string, value: string) {
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0) return
    const result = await updateImagingPriceAction(id, n)
    if ('error' in result && result.error) alert(result.error)
    else router.refresh()
  }

  async function toggle(item: ImagingCatalogItem) {
    const result = await toggleImagingActiveAction(item.id, !item.is_active)
    if ('error' in result && result.error) alert(result.error)
    else router.refresh()
  }

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div><h2 style={{ margin: 0, fontSize: 15 }}>{lang === 'fr' ? 'Imagerie' : 'Imaging'}</h2><p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Catalogue, modalités et tarifs des examens.' : 'Imaging catalogue, modalities and prices.'}</p></div>
      <button onClick={() => setAdding(v => !v)} style={{ border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', borderRadius: 'var(--radius-sm)', padding: '7px 11px', fontSize: 11, cursor: 'pointer' }}>{adding ? '×' : '+'} {lang === 'fr' ? 'Nouvel examen' : 'New examination'}</button>
    </div>

    {adding && <form action={async fd => { const r = await createImagingCatalogAction(fd); if ('error' in r && r.error) alert(r.error); else { setAdding(false); router.refresh() } }} style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', marginBottom: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
        <input name="code" placeholder="Code (XRAY_CHEST)" required style={input} /><input name="modality" placeholder="Modality (X-Ray, Ultrasound…)" required style={input} />
        <input name="name_en" placeholder="English name" required style={input} /><input name="name_fr" placeholder="Nom français" required style={input} />
        <input name="price_xaf" type="number" min="0" step="1" placeholder="Price XAF" required style={input} /><input name="turnaround_minutes" type="number" min="1" placeholder="Turnaround minutes" style={input} />
        <textarea name="preparation_instructions" placeholder="Preparation instructions" style={{ ...input, minHeight: 55, gridColumn: '1 / -1' }} /><textarea name="clinical_notes" placeholder="Clinical notes" style={{ ...input, minHeight: 55, gridColumn: '1 / -1' }} />
      </div>
      <button type="submit" style={{ marginTop: 8, border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', borderRadius: 'var(--radius-sm)', padding: '7px 12px', fontSize: 11, cursor: 'pointer' }}>{lang === 'fr' ? 'Créer' : 'Create'}</button>
    </form>}

    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'fr' ? 'Rechercher…' : 'Search…'} style={{ ...input, marginBottom: 8 }} />
    {filtered.map(item => <ImagingRow key={item.id} item={item} lang={lang} onSave={savePrice} onToggle={toggle} />)}
    {filtered.length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucun examen.' : 'No imaging services configured.'}</p>}
  </div>
}

function ImagingRow({ item, lang, onSave, onToggle }: { item: ImagingCatalogItem; lang: 'fr'|'en'; onSave: (id:string,v:string)=>void; onToggle:(i:ImagingCatalogItem)=>void }) {
  const [price, setPrice] = useState(String(item.price_xaf))
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', padding: '10px 12px', marginBottom: 6, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', opacity: item.is_active ? 1 : .55 }}>
    <div><div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}><strong style={{ fontSize:12 }}>{lang === 'fr' ? item.name_fr : item.name_en}</strong><code style={{ fontSize:10 }}>{item.code}</code><span style={{ fontSize:10, color:'var(--color-text-secondary)' }}>{item.modality}</span></div><div style={{ fontSize:10, color:'var(--color-text-secondary)', marginTop:3 }}>{item.turnaround_minutes ? `${item.turnaround_minutes} min` : ''}{item.preparation_instructions ? ` · ${item.preparation_instructions}` : ''}</div></div>
    <div style={{ display:'flex', gap:5, alignItems:'center' }}><input value={price} onChange={e=>setPrice(e.target.value)} onBlur={()=>onSave(item.id,price)} type="number" min="0" style={{ ...input, width: 105, fontFamily:'var(--font-mono)' }} /><span style={{ fontSize:10 }}>FCFA</span></div>
    <button onClick={()=>onToggle(item)} style={{ border:'1px solid var(--color-border)', background:'transparent', borderRadius:'var(--radius-sm)', padding:'6px 9px', fontSize:10, cursor:'pointer', color:item.is_active?'var(--color-critical-text)':'var(--color-success-text)' }}>{item.is_active ? (lang==='fr'?'Désactiver':'Deactivate') : (lang==='fr'?'Réactiver':'Reactivate')}</button>
  </div>
}
