'use client'

// components/admin/pricing/LabPanelsSection.tsx

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createLabPanelAction, updateClinicLabPanelAction, toggleClinicLabPanelActiveAction } from '@/lib/actions/pricingAdmin'

interface CatalogTest { id: string; name_fr: string; name_en: string; category: string }
interface ClinicPanel {
  id: string; price_xaf: number; is_active: boolean
  lab_panels: {
    id: string; name_fr: string; name_en: string; category: string
    lab_panel_items: { lab_test_catalog_id: string; lab_test_catalog: { name_fr: string } }[]
  }
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
}
const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }
function fmt(n: number, lang: 'fr' | 'en') { return n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') + ' FCFA' }

function PanelRow({ panel, lang }: { panel: ClinicPanel; lang: 'fr' | 'en' }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const p = panel.lab_panels
  const testNames = (p?.lab_panel_items ?? []).map((i) => i.lab_test_catalog?.name_fr).filter(Boolean).join(' · ')

  async function handleSave(formData: FormData) {
    setError(null); setPending(true)
    const result = await updateClinicLabPanelAction(panel.id, formData)
    if (result && 'error' in result && result.error) setError(result.error)
    else { router.refresh(); setEditing(false) }
    setPending(false)
  }

  async function handleToggle() {
    setError(null); setPending(true)
    const result = await toggleClinicLabPanelActiveAction(panel.id, !panel.is_active)
    if (result && 'error' in result && result.error) setError(result.error)
    else router.refresh()
    setPending(false)
  }

  return (
    <div style={{
      padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', marginBottom: '6px', opacity: panel.is_active ? 1 : 0.55,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{lang === 'fr' ? p?.name_fr : p?.name_en}</p>
          {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '2px 0 0' }}>{error}</p>}
        </div>

        {editing ? (
          <form action={handleSave} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input name="price_xaf" type="number" min="0" step="1" defaultValue={panel.price_xaf} required
                   style={{ ...inputStyle, width: '110px' }} autoFocus />
            <button type="submit" disabled={pending} style={{
              fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
            }}>{lang === 'fr' ? 'Enreg.' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(false)} style={{
              fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
          </form>
        ) : (
          <button onClick={() => setEditing(true)} style={{
            fontSize: '13px', fontFamily: 'var(--font-mono)', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer',
          }}>{fmt(panel.price_xaf, lang)}</button>
        )}

        <button onClick={handleToggle} disabled={pending} style={{
          fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
          background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
          color: panel.is_active ? 'var(--color-critical-text)' : 'var(--color-success-text)',
        }}>
          {panel.is_active ? (lang === 'fr' ? 'Désactiver' : 'Deactivate') : (lang === 'fr' ? 'Réactiver' : 'Reactivate')}
        </button>
      </div>
      {testNames && (
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '6px 0 0' }}>{testNames}</p>
      )}
    </div>
  )
}

function NewPanelForm({ fullCatalog, lang, onDone }: { fullCatalog: CatalogTest[]; lang: 'fr' | 'en'; onDone: () => void }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const categories = useMemo(() => [...new Set(fullCatalog.map((t) => t.category))].sort(), [fullCatalog])
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? fullCatalog.filter((t) => t.name_fr.toLowerCase().includes(q) || t.name_en.toLowerCase().includes(q)) : fullCatalog
  }, [fullCatalog, search])

  function toggleTest(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleSubmit(formData: FormData) {
    if (selected.size === 0) { setError(lang === 'fr' ? 'Sélectionnez au moins un test.' : 'Select at least one test.'); return }
    setError(null); setPending(true)
    for (const id of selected) formData.append('test_ids', id)
    const result = await createLabPanelAction(formData)
    if (result && 'error' in result && result.error) setError(result.error)
    else { router.refresh(); onDone() }
    setPending(false)
  }

  return (
    <form action={handleSubmit} style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 4px' }}>{lang === 'fr' ? 'Nouveau bilan' : 'New panel'}</p>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
        {lang === 'fr'
          ? 'Ce bilan appartient exclusivement à cette clinique, tout comme les tests que vous y ajoutez.'
          : 'This panel belongs exclusively to this clinic, same as the tests you add to it.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Nom (FR) *' : 'Name (FR) *'}</label>
          <input name="name_fr" required style={inputStyle} placeholder={lang === 'fr' ? 'Ex. NFS complète' : 'e.g. Full blood count'} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Nom (EN)' : 'Name (EN)'}</label>
          <input name="name_en" style={inputStyle} placeholder={lang === 'fr' ? '(identique si vide)' : '(same as FR if empty)'} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Catégorie *' : 'Category *'}</label>
          <input name="category" required list="panel-categories" style={inputStyle} />
          <datalist id="panel-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Prix (FCFA) *' : 'Price (FCFA) *'}</label>
          <input name="price_xaf" type="number" min="0" step="1" required style={inputStyle} />
        </div>
      </div>

      <label style={labelStyle}>
        {lang === 'fr' ? `Tests inclus * (${selected.size} sélectionné${selected.size !== 1 ? 's' : ''})` : `Tests included * (${selected.size} selected)`}
      </label>
      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder={lang === 'fr' ? 'Rechercher un test…' : 'Search a test…'}
        style={{ ...inputStyle, width: '100%', marginBottom: '8px' }}
      />
      <div style={{
        maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)', padding: '6px', marginBottom: '10px', background: 'var(--color-bg)',
      }}>
        {visible.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '1rem' }}>
            {lang === 'fr' ? 'Aucun résultat.' : 'No results.'}
          </p>
        ) : visible.map((t) => (
          <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleTest(t.id)} />
            <span>{lang === 'fr' ? t.name_fr : t.name_en}</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>{t.category}</span>
          </label>
        ))}
      </div>

      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={pending} style={{
          fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
        }}>{pending ? '…' : (lang === 'fr' ? 'Créer' : 'Create')}</button>
        <button type="button" onClick={onDone} style={{
          fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
          background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer',
        }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
      </div>
    </form>
  )
}

export default function LabPanelsSection({
  clinicPanels, fullCatalog, lang,
}: { clinicPanels: ClinicPanel[]; fullCatalog: CatalogTest[]; lang: 'fr' | 'en' }) {
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{lang === 'fr' ? 'Bilans (groupes de tests)' : 'Panels (test groups)'}</p>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{
            fontSize: '12px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
          }}>+ {lang === 'fr' ? 'Nouveau bilan' : 'New panel'}</button>
        )}
      </div>

      {adding && <NewPanelForm fullCatalog={fullCatalog} lang={lang} onDone={() => setAdding(false)} />}

      {clinicPanels.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-secondary)',
          fontSize: '13px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
        }}>
          {lang === 'fr' ? 'Aucun bilan activé pour cette clinique.' : 'No panels activated for this clinic yet.'}
        </div>
      ) : (
        clinicPanels.map((p) => <PanelRow key={p.id} panel={p} lang={lang} />)
      )}
    </div>
  )
}
