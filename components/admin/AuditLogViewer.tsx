'use client'

// components/admin/AuditLogViewer.tsx

import { useEffect, useRef, useState } from 'react'
import { fetchAuditLogAction, type AuditLogEntry } from '@/lib/actions/auditLog'
import { auditActionLabel, AUDIT_CATEGORIES } from '@/lib/auditLabels'
import { useLang } from '@/lib/i18n/LangContext'

function fmtDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Douala',
  })
}

const STR = {
  fr: {
    hideDetails: 'Masquer les détails',
    showDetails: 'Voir les détails',
    allCategories: 'Toutes les catégories',
    searchPh: 'Rechercher une action, un utilisateur…',
    loading: 'Chargement…',
    loadMore: 'Charger plus',
    empty: 'Aucune entrée trouvée.',
    entries: 'entrées',
    system: 'Système',
    value: 'Valeur',
    locale: 'fr-FR',
  },
  en: {
    hideDetails: 'Hide details',
    showDetails: 'Show details',
    allCategories: 'All categories',
    searchPh: 'Search action, user…',
    loading: 'Loading…',
    loadMore: 'Load more',
    empty: 'No entries found.',
    entries: 'entries',
    system: 'System',
    value: 'Value',
    locale: 'en-US',
  },
} as const

function DetailsDisclosure({ details }: { details: Record<string, unknown> | null }) {
  const lang = useLang()
  const t = STR[lang]
  const [open, setOpen] = useState(false)
  const entries = details ? Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '') : []
  if (entries.length === 0) return null

  return (
    <div style={{ marginTop: '6px' }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}>
        {open ? t.hideDetails : t.showDetails}
      </button>
      {open && (
        <div style={{
          marginTop: '6px', padding: '8px 10px', background: 'var(--color-bg)',
          borderRadius: 'var(--radius-sm)', fontSize: '11px', fontFamily: 'var(--font-mono)',
        }}>
          {entries.map(([key, value]) => (
            <div key={key} style={{ display: 'flex', gap: '6px', padding: '1px 0' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{key}:</span>
              <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EntryRow({
  entry }: { entry: AuditLogEntry }) {
  const lang = useLang()
  const t = STR[lang]
  const category = entry.action.split('.')[0]
  const categoryMeta = AUDIT_CATEGORIES.find((c) => c.prefix === category)

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '6px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>
            {auditActionLabel(entry.action, lang)}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {entry.staff?.full_name ?? t.system}
            {categoryMeta ? ` · ${categoryMeta[lang]}` : ''}
            {entry.entity_type ? ` · ${entry.entity_type}` : ''}
          </p>
          <DetailsDisclosure details={entry.details} />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
          {fmtDateTime(entry.created_at, t.locale)}
        </span>
      </div>
    </div>
  )
}

export default function AuditLogViewer({
  initialEntries }: { initialEntries: AuditLogEntry[] }) {
  const lang = useLang()
  const t = STR[lang]
  const [entries, setEntries] = useState<AuditLogEntry[]>(initialEntries)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialEntries.length === 30)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function runFilterQuery(nextCategory: string, nextSearch: string) {
    setLoading(true); setError(null)
    const result = await fetchAuditLogAction({ category: nextCategory || undefined, search: nextSearch || undefined })
    if (result.error) setError(result.error)
    else {
      setEntries(result.entries)
      setHasMore(result.entries.length === 30)
    }
    setLoading(false)
  }

  function handleCategoryChange(v: string) {
    setCategory(v)
    runFilterQuery(v, search)
  }

  function handleSearchChange(v: string) {
    setSearch(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runFilterQuery(category, v), 350)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  async function loadMore() {
    if (entries.length === 0) return
    setLoadingMore(true)
    const result = await fetchAuditLogAction({
      category: category || undefined, search: search || undefined,
      before: entries[entries.length - 1].created_at,
    })
    if (result.error) setError(result.error)
    else {
      setEntries((prev) => [...prev, ...result.entries])
      setHasMore(result.entries.length === 30)
    }
    setLoadingMore(false)
  }

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)',
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={category} onChange={(e) => handleCategoryChange(e.target.value)} style={selectStyle}>
          <option value="">{t.allCategories}</option>
          {AUDIT_CATEGORIES.map((c) => <option key={c.prefix} value={c.prefix}>{c[lang]}</option>)}
        </select>
        <input
          value={search} onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t.searchPh} style={{ ...selectStyle, flex: 1, minWidth: '200px' }}
        />
      </div>

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '10px' }}>{error}</p>
      )}

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem' }}>{t.loading}</p>
      ) : entries.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--color-text-secondary)',
          fontSize: '13px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
        }}>
          {t.empty}
        </div>
      ) : (
        <>
          {entries.map((e) => <EntryRow key={e.id} entry={e} />)}
          {hasMore && (
            <button onClick={loadMore} disabled={loadingMore} style={{
              display: 'block', margin: '1rem auto 0', fontSize: '12px', padding: '8px 16px',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text-primary)', cursor: 'pointer',
            }}>
              {loadingMore ? t.loading : t.loadMore}
            </button>
          )}
        </>
      )}
    </div>
  )
}
