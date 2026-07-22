'use client'

// components/docs/DocsViewer.tsx

import { useState, useMemo } from 'react'
import { Search, ChevronRight, BookOpen, AlertCircle } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangContext'
import type { DocArticle } from '@/lib/docs/content'

// Render the article content (simple markdown-like: **bold**, line breaks,
// **headings** on their own line). Not a full markdown parser — just enough
// for clinical prose with bold labels and paragraph breaks.
function ArticleContent({ text }: { text: string }) {
  const lines = text.trim().split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { elements.push(<div key={key++} style={{ height: '8px' }} />); continue }

    // Bold-only line = section heading inside article
    const headingMatch = line.match(/^\*\*(.+)\*\*$/)
    if (headingMatch) {
      elements.push(
        <p key={key++} style={{ fontSize: '13px', fontWeight: 600, margin: '14px 0 4px', color: 'var(--color-text-primary)' }}>
          {headingMatch[1]}
        </p>
      )
      continue
    }

    // List item
    if (line.startsWith('- ')) {
      const content = line.slice(2)
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          <span style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: '1px' }}>·</span>
          <span style={{ fontSize: '13px', lineHeight: 1.6 }}>{renderInline(content)}</span>
        </div>
      )
      continue
    }

    elements.push(
      <p key={key++} style={{ fontSize: '13px', lineHeight: 1.65, margin: '0 0 6px', color: 'var(--color-text-primary)' }}>
        {renderInline(line)}
      </p>
    )
  }
  return <>{elements}</>
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/)
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 600 }}>{part}</strong>
      : part
  )
}

interface Props {
  articles: DocArticle[]
  sections: Array<{ title: string; articles: DocArticle[] }>
}

export default function DocsViewer({ articles, sections }: Props) {
  const lang = useLang()
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return articles
    return articles.filter(a =>
      (lang === 'fr' ? a.title : a.titleEn).toLowerCase().includes(q) ||
      a.tags.some(tag => tag.includes(q)) ||
      (lang === 'fr' ? a.content : a.contentEn).toLowerCase().includes(q)
    )
  }, [search, articles, lang])

  const activeArticle = activeId ? articles.find(a => a.id === activeId) ?? null : null

  const displaySections = useMemo(() => {
    if (!search.trim()) return sections
    const ids = new Set(filtered.map(a => a.id))
    return sections
      .map(s => ({ ...s, articles: s.articles.filter(a => ids.has(a.id)) }))
      .filter(s => s.articles.length > 0)
  }, [filtered, sections, search])

  function articleTitle(a: DocArticle) {
    return lang === 'fr' ? a.title : a.titleEn
  }
  function articleContent(a: DocArticle) {
    return lang === 'fr' ? a.content : a.contentEn
  }
  function articleSection(a: DocArticle) {
    return lang === 'fr' ? a.section : a.sectionEn
  }

  return (
    <div style={{ display: 'flex', gap: '0', minHeight: 'calc(100vh - 6rem)' }}>

      {/* ── Left sidebar: search + nav ── */}
      <div style={{
        width: '280px', flexShrink: 0, borderRight: '1px solid var(--color-border)',
        paddingRight: '1.5rem', paddingTop: '4px',
      }}>
        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
          <Search size={14} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--color-text-secondary)', pointerEvents: 'none',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'fr' ? 'Rechercher…' : 'Search…'}
            style={{
              width: '100%', padding: '8px 10px 8px 32px',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {displaySections.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {lang === 'fr' ? 'Aucun résultat.' : 'No results.'}
          </p>
        )}

        {displaySections.map(section => (
          <div key={section.title} style={{ marginBottom: '1.25rem' }}>
            <p style={{
              fontSize: '10px', fontWeight: 600, color: 'var(--color-text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px',
            }}>
              {section.title}
            </p>
            {section.articles.map(a => (
              <button
                key={a.id}
                onClick={() => { setActiveId(a.id); setSearch('') }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', textAlign: 'left', padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                  fontSize: '13px', lineHeight: 1.4,
                  background: activeId === a.id ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                  color: activeId === a.id ? 'var(--color-accent)' : 'var(--color-text-primary)',
                  fontWeight: activeId === a.id ? 500 : 400,
                  marginBottom: '2px',
                }}
              >
                <span>{articleTitle(a)}</span>
                {activeId === a.id && <ChevronRight size={12} aria-hidden />}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* ── Right panel: article content ── */}
      <div style={{ flex: 1, paddingLeft: '2rem', paddingTop: '4px', minWidth: 0 }}>
        {!activeArticle ? (
          <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
            <BookOpen size={36} style={{ color: 'var(--color-text-secondary)', opacity: 0.4, marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
              {lang === 'fr'
                ? (lang==='fr'?'Sélectionnez un article dans le menu pour commencer.':'Select an article from the menu to get started.')
                : 'Select an article from the menu to get started.'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '6px 0 0', opacity: 0.7 }}>
              {lang === 'fr'
                ? (lang==='fr'?`${articles.length} articles disponibles pour votre rôle.`:`${articles.length} articles available for your role.`)
                : `${articles.length} articles available for your role.`}
            </p>
          </div>
        ) : (
          <div style={{ maxWidth: '680px' }}>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
              {articleSection(activeArticle)}
            </p>
            <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 1.5rem', lineHeight: 1.3 }}>
              {articleTitle(activeArticle)}
            </h1>

            <div style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem',
            }}>
              <ArticleContent text={articleContent(activeArticle)} />
            </div>

            {/* Related articles */}
            {(() => {
              const related = articles.filter(a =>
                a.id !== activeArticle.id &&
                a.tags.some(t => activeArticle.tags.includes(t))
              ).slice(0, 3)
              if (related.length === 0) return null
              return (
                <div style={{ marginTop: '1.5rem' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                    {lang === 'fr' ? 'Articles liés' : 'Related articles'}
                  </p>
                  {related.map(a => (
                    <button key={a.id} onClick={() => setActiveId(a.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
                      padding: '8px 12px', marginBottom: '4px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                      cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-primary)',
                    }}>
                      <ChevronRight size={13} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                      {articleTitle(a)}
                    </button>
                  ))}
                </div>
              )
            })()}

            {/* Feedback prompt */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2rem',
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg)', border: '1px solid var(--color-border-subtle)',
            }}>
              <AlertCircle size={13} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                {lang === 'fr'
                  ? (lang==='fr'?"Une information manque ou est incorrecte ? Signalez-le à votre administrateur.":'Something missing or incorrect? Let your administrator know.')
                  : 'Something missing or incorrect? Let your administrator know.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
