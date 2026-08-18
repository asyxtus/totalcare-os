'use client'

// components/admin/pricing/LabTestsSection.tsx
// The Laboratory tab is the operational home for the clinic's laboratory
// catalogue. It is intentionally not a separate "Pricing" workflow: price,
// specimen, code, turnaround and reference-range information belong together.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createLabTestAction, updateClinicLabTestAction, toggleClinicLabTestActiveAction } from '@/lib/actions/pricingAdmin'

interface ClinicTest {
  id: string
  price_xaf: number
  is_active: boolean
  lab_test_catalog: {
    id: string
    name_fr: string
    name_en: string
    category: string
    result_type: string
    lab_code?: string | null
    specimen_type?: string | null
    unit?: string | null
    reference_range_low?: number | null
    reference_range_high?: number | null
    critical_low?: number | null
    critical_high?: number | null
    qualitative_options?: string[] | null
    abnormal_qualitative_values?: string[] | null
    collection_container?: string | null
    turnaround_time?: string | null
  }
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
}
const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px'
}
function fmt(n: number, lang: 'fr' | 'en') {
  return n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') + ' FCFA'
}
function fmtRange(cat: ClinicTest['lab_test_catalog'], lang: 'fr' | 'en') {
  if (cat.result_type === 'numeric') {
    if (cat.reference_range_low == null && cat.reference_range_high == null) {
      return lang === 'fr' ? 'Plage à valider' : 'Range to validate'
    }
    const unit = cat.unit ? ` ${cat.unit}` : ''
    return `${cat.reference_range_low ?? '—'} – ${cat.reference_range_high ?? '—'}${unit}`
  }
  if (cat.abnormal_qualitative_values?.length) {
    return `${lang === 'fr' ? 'Anormal' : 'Abnormal'}: ${cat.abnormal_qualitative_values.join(', ')}`
  }
  return lang === 'fr' ? 'Qualitatif' : 'Qualitative'
}

function TestRow({ test, lang }: { test: ClinicTest; lang: 'fr' | 'en' }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cat = test.lab_test_catalog

  async function handleSave(formData: FormData) {
    setError(null); setPending(true)
    const result = await updateClinicLabTestAction(test.id, formData)
    if (result && 'error' in result && result.error) setError(result.error)
    else { router.refresh(); setEditing(false) }
    setPending(false)
  }

  async function handleToggle() {
    setError(null); setPending(true)
    const result = await toggleClinicLabTestActiveAction(test.id, !test.is_active)
    if (result && 'error' in result && result.error) setError(result.error)
    else router.refresh()
    setPending(false)
  }

  return (
    <div style={{
      padding: '11px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', marginBottom: '6px', opacity: test.is_active ? 1 : 0.55,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>
              {lang === 'fr' ? cat?.name_fr : cat?.name_en}
            </p>
            {cat?.lab_code && (
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 5px', borderRadius: '4px', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                {cat.lab_code}
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span>{cat?.result_type === 'numeric' ? (lang === 'fr' ? 'Numérique' : 'Numeric') : (lang === 'fr' ? 'Qualitatif' : 'Qualitative')}</span>
            {cat?.specimen_type && <span>• {cat.specimen_type}</span>}
            {cat?.collection_container && <span>• {cat.collection_container}</span>}
            {cat?.turnaround_time && <span>• {cat.turnaround_time}</span>}
          </div>
          <div style={{ fontSize: '11px', marginTop: '5px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span>
              <strong>{lang === 'fr' ? 'Référence:' : 'Reference:'}</strong> {fmtRange(cat, lang)}
            </span>
            {cat?.result_type === 'numeric' && (cat.critical_low != null || cat.critical_high != null) && (
              <span style={{ color: 'var(--color-critical-text)' }}>
                <strong>{lang === 'fr' ? 'Critique:' : 'Critical:'}</strong> {cat.critical_low ?? '—'} – {cat.critical_high ?? '—'}{cat.unit ? ` ${cat.unit}` : ''}
              </span>
            )}
          </div>
          {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '4px 0 0' }}>{error}</p>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
          {editing ? (
            <form action={handleSave} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input name="price_xaf" type="number" min="0" step="1" defaultValue={test.price_xaf} required
                     style={{ ...inputStyle, width: '110px' }} autoFocus />
              <button type="submit" disabled={pending} style={{ fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
                {lang === 'fr' ? 'Enreg.' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(false)} style={{ fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
            </form>
          ) : (
            <button onClick={() => setEditing(true)} style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {fmt(test.price_xaf, lang)}
            </button>
          )}
          <button onClick={handleToggle} disabled={pending} style={{ fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap', color: test.is_active ? 'var(--color-critical-text)' : 'var(--color-success-text)' }}>
            {test.is_active ? (lang === 'fr' ? 'Désactiver' : 'Deactivate') : (lang === 'fr' ? 'Réactiver' : 'Reactivate')}
          </button>
        </div>
      </div>
    </div>
  )
}

function NewTestForm({ categories, lang, onDone }: { categories: string[]; lang: 'fr' | 'en'; onDone: () => void }) {
  const router = useRouter()
  const [resultType, setResultType] = useState<'numeric' | 'qualitative'>('numeric')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null); setPending(true)
    const result = await createLabTestAction(formData)
    if (result && 'error' in result && result.error) setError(result.error)
    else { router.refresh(); onDone() }
    setPending(false)
  }

  return (
    <form action={handleSubmit} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
      <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }}>{lang === 'fr' ? 'Nouveau test' : 'New test'}</p>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
        {lang === 'fr' ? 'Ce test appartient exclusivement à cette clinique.' : 'This test belongs exclusively to this clinic.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div><label style={labelStyle}>{lang === 'fr' ? 'Nom (FR) *' : 'Name (FR) *'}</label><input name="name_fr" required style={inputStyle} /></div>
        <div><label style={labelStyle}>{lang === 'fr' ? 'Nom (EN)' : 'Name (EN)'}</label><input name="name_en" style={inputStyle} /></div>
        <div><label style={labelStyle}>{lang === 'fr' ? 'Catégorie *' : 'Category *'}</label><input name="category" required list="test-categories" style={inputStyle} /><datalist id="test-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
        <div><label style={labelStyle}>{lang === 'fr' ? 'Type de spécimen' : 'Specimen type'}</label><input name="specimen_type" style={inputStyle} placeholder={lang === 'fr' ? 'Sang, Urine…' : 'Blood, Urine…'} /></div>
        <div><label style={labelStyle}>{lang === 'fr' ? 'Type de résultat *' : 'Result type *'}</label><select name="result_type" value={resultType} onChange={(e) => setResultType(e.target.value as 'numeric' | 'qualitative')} style={inputStyle}><option value="numeric">{lang === 'fr' ? 'Numérique' : 'Numeric'}</option><option value="qualitative">{lang === 'fr' ? 'Qualitatif' : 'Qualitative'}</option></select></div>
        <div><label style={labelStyle}>{lang === 'fr' ? 'Prix (FCFA) *' : 'Price (FCFA) *'}</label><input name="price_xaf" type="number" min="0" step="1" required style={inputStyle} /></div>

        {resultType === 'numeric' ? <>
          <div><label style={labelStyle}>{lang === 'fr' ? 'Unité' : 'Unit'}</label><input name="unit" style={inputStyle} placeholder="g/dL, mg/L…" /></div><div />
          <div><label style={labelStyle}>{lang === 'fr' ? 'Plage normale — min' : 'Normal range — low'}</label><input name="reference_range_low" type="number" step="any" style={inputStyle} /></div>
          <div><label style={labelStyle}>{lang === 'fr' ? 'Plage normale — max' : 'Normal range — high'}</label><input name="reference_range_high" type="number" step="any" style={inputStyle} /></div>
          <div><label style={labelStyle}>{lang === 'fr' ? 'Seuil critique — min' : 'Critical — low'}</label><input name="critical_low" type="number" step="any" style={inputStyle} /></div>
          <div><label style={labelStyle}>{lang === 'fr' ? 'Seuil critique — max' : 'Critical — high'}</label><input name="critical_high" type="number" step="any" style={inputStyle} /></div>
        </> : <>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>{lang === 'fr' ? 'Valeurs possibles (séparées par une virgule) *' : 'Possible values (comma-separated) *'}</label><input name="qualitative_options" required style={inputStyle} placeholder="Positif, Négatif" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>{lang === 'fr' ? 'Valeurs anormales (séparées par une virgule)' : 'Abnormal values (comma-separated)'}</label><input name="abnormal_qualitative_values" style={inputStyle} placeholder="Positif" /></div>
        </>}
      </div>

      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '0 0 10px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={pending} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>{pending ? '…' : (lang === 'fr' ? 'Créer' : 'Create')}</button>
        <button type="button" onClick={onDone} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
      </div>
    </form>
  )
}

export default function LabTestsSection({ clinicTests, lang }: { clinicTests: ClinicTest[]; lang: 'fr' | 'en' }) {
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')

  const categories = useMemo(() => [...new Set(clinicTests.map((t) => t.lab_test_catalog?.category).filter(Boolean))].sort() as string[], [clinicTests])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clinicTests
    return clinicTests.filter((t) => {
      const c = t.lab_test_catalog
      return [c?.name_fr, c?.name_en, c?.lab_code, c?.category, c?.specimen_type].some((v) => v?.toLowerCase().includes(q))
    })
  }, [clinicTests, search])

  const grouped = useMemo(() => {
    const map = new Map<string, ClinicTest[]>()
    for (const t of filtered) {
      const cat = t.lab_test_catalog?.category ?? '—'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(t)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const activeCount = clinicTests.filter((t) => t.is_active).length
  const numericCount = clinicTests.filter((t) => t.lab_test_catalog?.result_type === 'numeric').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{lang === 'fr' ? 'Tests individuels' : 'Individual tests'}</p>
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '3px 0 0' }}>
            {clinicTests.length} {lang === 'fr' ? 'tests configurés' : 'configured tests'} · {activeCount} {lang === 'fr' ? 'actifs' : 'active'} · {numericCount} {lang === 'fr' ? 'numériques' : 'numeric'}
          </p>
        </div>
        {!adding && <button onClick={() => setAdding(true)} style={{ fontSize: '12px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>+ {lang === 'fr' ? 'Nouveau test' : 'New test'}</button>}
      </div>

      {adding && <NewTestForm categories={categories} lang={lang} onDone={() => setAdding(false)} />}

      {clinicTests.length > 8 && (
        <div style={{ marginBottom: '14px' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={lang === 'fr' ? 'Rechercher par nom, code, catégorie ou prélèvement…' : 'Search by name, code, category or specimen…'} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>
      )}

      {grouped.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-secondary)', fontSize: '13px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {clinicTests.length === 0
            ? (lang === 'fr' ? 'Aucun test activé pour cette clinique. Exécutez la migration GRIX puis actualisez.' : 'No tests configured for this clinic. Run the GRIX migration and refresh.')
            : (lang === 'fr' ? 'Aucun test ne correspond à votre recherche.' : 'No tests match your search.')}
        </div>
      ) : grouped.map(([category, items]) => (
        <div key={category} style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 8px' }}>
            {category} <span style={{ fontWeight: 400 }}>({items.length})</span>
          </p>
          {items.map((t) => <TestRow key={t.id} test={t} lang={lang} />)}
        </div>
      ))}
    </div>
  )
}
