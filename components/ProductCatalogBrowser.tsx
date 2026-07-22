'use client'

// components/ProductCatalogBrowser.tsx
//
// Lets any clinic browse the shared product_templates table and import
// medications into their own catalog with one click + price entry.
// The template provides name, dosage form, drug class, controlled flag.
// The clinic provides their own sale price — nothing else is shared.

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n/LangContext'
import { importFromTemplate, searchProductTemplates } from '@/lib/actions/pharmacy'

interface DrugClass { id: string; name_fr: string; name_en?: string }
interface Template {
  id: string
  name: string
  name_fr: string | null
  dosage_form: string | null
  unit: string | null
  requires_review: boolean
  drug_classes: { name_fr: string; name_en: string | null; is_antibiotic: boolean | null } | null
}

const STR = {
  fr: {
    title: 'Importer depuis le catalogue',
    subtitle: 'Recherchez un médicament et importez-le dans votre inventaire avec votre propre prix.',
    search: 'Rechercher (nom, dosage…)',
    allClasses: 'Toutes les classes',
    controlled: '🔒 Contrôlé',
    antibiotic: 'Antibiotique',
    pricePh: 'Prix de vente (FCFA) *',
    costPh: 'Prix d\'achat (optionnel)',
    import: 'Importer',
    importing: '…',
    alreadyIn: 'Déjà dans votre inventaire',
    empty: 'Aucun médicament trouvé. Essayez un autre terme.',
    searchFirst: 'Tapez un nom de médicament pour rechercher dans le catalogue.',
    done: '✓ Importé',
  },
  en: {
    title: 'Import from catalog',
    subtitle: 'Search for a medication and import it into your inventory with your own price.',
    search: 'Search (name, dosage…)',
    allClasses: 'All classes',
    controlled: '🔒 Controlled',
    antibiotic: 'Antibiotic',
    pricePh: 'Sale price (FCFA) *',
    costPh: 'Purchase price (optional)',
    import: 'Import',
    importing: '…',
    alreadyIn: 'Already in your inventory',
    empty: 'No medications found. Try a different search term.',
    searchFirst: 'Type a medication name to search the catalog.',
    done: '✓ Imported',
  },
} as const

export default function ProductCatalogBrowser({
  drugClasses,
  existingProductNames,
}: {
  drugClasses: DrugClass[]
  existingProductNames: Set<string>
}) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [results, setResults] = useState<Template[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)

  // Per-template import state
  const [prices, setPrices] = useState<Record<string, { sale: string; cost: string }>>({})
  const [importing, setImporting] = useState<Record<string, boolean>>({})
  const [imported, setImported] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const doSearch = useCallback(async (q: string, cls: string) => {
    if (!q.trim() && !cls) { setResults([]); setSearched(false); return }
    setSearching(true)
    const res = await searchProductTemplates(q, cls || undefined)
    setResults((res.data as Template[]) ?? [])
    setSearched(true)
    setSearching(false)
  }, [])

  function handleQueryChange(v: string) {
    setQuery(v)
    doSearch(v, classFilter)
  }
  function handleClassChange(v: string) {
    setClassFilter(v)
    doSearch(query, v)
  }

  async function handleImport(tpl: Template) {
    const p = prices[tpl.id]
    const sale = parseFloat(p?.sale ?? '')
    if (!sale || sale <= 0) {
      setErrors(e => ({ ...e, [tpl.id]: lang === 'fr' ? 'Prix de vente requis.' : 'Sale price required.' }))
      return
    }
    const cost = p?.cost ? parseFloat(p.cost) : null

    setImporting(m => ({ ...m, [tpl.id]: true }))
    setErrors(e => { const n = { ...e }; delete n[tpl.id]; return n })

    const result = await importFromTemplate(tpl.id, sale, cost)
    if (result?.error) {
      setErrors(e => ({ ...e, [tpl.id]: result.error! }))
    } else {
      setImported(s => new Set([...s, tpl.id]))
      router.refresh()
    }
    setImporting(m => ({ ...m, [tpl.id]: false }))
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)', fontSize: '13px',
    background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
      <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>{t.title}</p>
      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 1rem' }}>{t.subtitle}</p>

      {/* Search + class filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <input
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder={t.search}
          style={{ ...inputStyle, flex: 2 }}
        />
        <select
          value={classFilter}
          onChange={e => handleClassChange(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        >
          <option value="">{t.allClasses}</option>
          {drugClasses.map(dc => (
            <option key={dc.id} value={dc.id}>
              {lang === 'fr' ? dc.name_fr : (dc.name_en ?? dc.name_fr)}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {!searched && !searching && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t.searchFirst}</p>
      )}
      {searching && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>…</p>
      )}
      {searched && results.length === 0 && !searching && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t.empty}</p>
      )}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {results.map(tpl => {
            const isImported = imported.has(tpl.id)
            const isAlreadyIn = !isImported && existingProductNames.has(`${tpl.name}|${tpl.dosage_form ?? ''}`)
            const dc = tpl.drug_classes

            return (
              <div key={tpl.id} style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                opacity: isAlreadyIn ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      {lang === 'fr' && tpl.name_fr ? tpl.name_fr : tpl.name}
                      {tpl.dosage_form && (
                        <span style={{ fontSize: '11px', color: 'var(--color-accent)', fontWeight: 600 }}>
                          {tpl.dosage_form}
                        </span>
                      )}
                      {tpl.requires_review && (
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>
                          {t.controlled}
                        </span>
                      )}
                      {dc?.is_antibiotic && (
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: 'color-mix(in srgb, var(--color-warning-text) 12%, transparent)', color: 'var(--color-warning-text)', fontWeight: 700 }}>
                          {t.antibiotic.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {dc ? (lang === 'fr' ? dc.name_fr : (dc.name_en ?? dc.name_fr)) : '—'}
                      {tpl.unit ? ` · ${tpl.unit}` : ''}
                    </div>
                  </div>

                  {isAlreadyIn ? (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                      {t.alreadyIn}
                    </span>
                  ) : isImported ? (
                    <span style={{ fontSize: '12px', color: 'var(--color-success-text)', flexShrink: 0, fontWeight: 600 }}>
                      {t.done}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        placeholder={t.pricePh}
                        value={prices[tpl.id]?.sale ?? ''}
                        onChange={e => setPrices(p => ({ ...p, [tpl.id]: { ...p[tpl.id], sale: e.target.value } }))}
                        style={{ ...inputStyle, width: '140px' }}
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder={t.costPh}
                        value={prices[tpl.id]?.cost ?? ''}
                        onChange={e => setPrices(p => ({ ...p, [tpl.id]: { ...p[tpl.id], cost: e.target.value } }))}
                        style={{ ...inputStyle, width: '140px' }}
                      />
                      <button
                        onClick={() => handleImport(tpl)}
                        disabled={importing[tpl.id]}
                        style={{
                          padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
                          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
                          fontSize: '12px', cursor: 'pointer', flexShrink: 0,
                          opacity: importing[tpl.id] ? 0.7 : 1,
                        }}
                      >
                        {importing[tpl.id] ? t.importing : t.import}
                      </button>
                    </div>
                  )}
                </div>
                {errors[tpl.id] && (
                  <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '4px 0 0' }}>
                    {errors[tpl.id]}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
