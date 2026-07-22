'use client'

// components/admin/pricing/LabTestsSection.tsx

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createLabTestAction, updateClinicLabTestAction, toggleClinicLabTestActiveAction } from '@/lib/actions/pricingAdmin'

interface ClinicTest {
  id: string; price_xaf: number; is_active: boolean
  lab_test_catalog: { id: string; name_fr: string; name_en: string; category: string; result_type: string }
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
}
const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }
function fmt(n: number, lang: 'fr' | 'en') { return n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') + ' FCFA' }

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
      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', marginBottom: '6px', opacity: test.is_active ? 1 : 0.55,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>
          {lang === 'fr' ? cat?.name_fr : cat?.name_en}
        </p>
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
          {cat?.result_type === 'numeric' ? (lang === 'fr' ? 'Numérique' : 'Numeric') : (lang === 'fr' ? 'Qualitatif' : 'Qualitative')}
        </p>
        {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '2px 0 0' }}>{error}</p>}
      </div>

      {editing ? (
        <form action={handleSave} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input name="price_xaf" type="number" min="0" step="1" defaultValue={test.price_xaf} required
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
        }}>{fmt(test.price_xaf, lang)}</button>
      )}

      <button onClick={handleToggle} disabled={pending} style={{
        fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
        background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
        color: test.is_active ? 'var(--color-critical-text)' : 'var(--color-success-text)',
      }}>
        {test.is_active ? (lang === 'fr' ? 'Désactiver' : 'Deactivate') : (lang === 'fr' ? 'Réactiver' : 'Reactivate')}
      </button>
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
    <form action={handleSubmit} style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 4px' }}>
        {lang === 'fr' ? 'Nouveau test' : 'New test'}
      </p>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
        {lang === 'fr'
          ? 'Ce test appartient exclusivement à cette clinique — aucune autre clinique cliente ne le verra.'
          : "This test belongs exclusively to this clinic — no other clinic tenant will see it."}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Nom (FR) *' : 'Name (FR) *'}</label>
          <input name="name_fr" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Nom (EN)' : 'Name (EN)'}</label>
          <input name="name_en" style={inputStyle} placeholder={lang === 'fr' ? '(identique si vide)' : '(same as FR if empty)'} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Catégorie *' : 'Category *'}</label>
          <input name="category" required list="test-categories" style={inputStyle} />
          <datalist id="test-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Type de spécimen' : 'Specimen type'}</label>
          <input name="specimen_type" style={inputStyle} placeholder={lang === 'fr' ? 'Sang, Urine…' : 'Blood, Urine…'} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Type de résultat *' : 'Result type *'}</label>
          <select name="result_type" value={resultType} onChange={(e) => setResultType(e.target.value as any)} style={inputStyle}>
            <option value="numeric">{lang === 'fr' ? 'Numérique' : 'Numeric'}</option>
            <option value="qualitative">{lang === 'fr' ? 'Qualitatif' : 'Qualitative'}</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? 'Prix (FCFA) *' : 'Price (FCFA) *'}</label>
          <input name="price_xaf" type="number" min="0" step="1" required style={inputStyle} />
        </div>

        {resultType === 'numeric' ? (
          <>
            <div>
              <label style={labelStyle}>{lang === 'fr' ? 'Unité' : 'Unit'}</label>
              <input name="unit" style={inputStyle} placeholder="g/dL, mg/L…" />
            </div>
            <div />
            <div>
              <label style={labelStyle}>{lang === 'fr' ? 'Plage normale — min' : 'Normal range — low'}</label>
              <input name="reference_range_low" type="number" step="any" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{lang === 'fr' ? 'Plage normale — max' : 'Normal range — high'}</label>
              <input name="reference_range_high" type="number" step="any" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{lang === 'fr' ? 'Seuil critique — min' : 'Critical — low'}</label>
              <input name="critical_low" type="number" step="any" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{lang === 'fr' ? 'Seuil critique — max' : 'Critical — high'}</label>
              <input name="critical_high" type="number" step="any" style={inputStyle} />
            </div>
          </>
        ) : (
          <>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>{lang === 'fr' ? 'Valeurs possibles (séparées par une virgule) *' : 'Possible values (comma-separated) *'}</label>
              <input name="qualitative_options" required style={inputStyle} placeholder={lang === 'fr' ? 'Positif, Négatif' : 'Positive, Negative'} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>{lang === 'fr' ? 'Valeurs anormales (séparées par une virgule)' : 'Abnormal values (comma-separated)'}</label>
              <input name="abnormal_qualitative_values" style={inputStyle} placeholder="Positif" />
            </div>
          </>
        )}
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

export default function LabTestsSection({ clinicTests, lang }: { clinicTests: ClinicTest[]; lang: 'fr' | 'en' }) {
  const [adding, setAdding] = useState(false)
  const categories = useMemo(() => [...new Set(clinicTests.map((t) => t.lab_test_catalog?.category).filter(Boolean))].sort() as string[], [clinicTests])

  const grouped = useMemo(() => {
    const map = new Map<string, ClinicTest[]>()
    for (const t of clinicTests) {
      const cat = t.lab_test_catalog?.category ?? '—'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(t)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [clinicTests])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{lang === 'fr' ? 'Tests individuels' : 'Individual tests'}</p>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{
            fontSize: '12px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
          }}>+ {lang === 'fr' ? 'Nouveau test' : 'New test'}</button>
        )}
      </div>

      {adding && <NewTestForm categories={categories} lang={lang} onDone={() => setAdding(false)} />}

      {grouped.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-secondary)',
          fontSize: '13px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
        }}>
          {lang === 'fr' ? 'Aucun test activé pour cette clinique.' : 'No tests activated for this clinic yet.'}
        </div>
      ) : (
        grouped.map(([category, items]) => (
          <div key={category} style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 8px' }}>
              {category}
            </p>
            {items.map((t) => <TestRow key={t.id} test={t} lang={lang} />)}
          </div>
        ))
      )}
    </div>
  )
}
