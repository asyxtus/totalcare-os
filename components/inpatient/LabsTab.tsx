'use client'

// components/inpatient/LabsTab.tsx

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { orderInpatientLabAction } from '@/lib/actions/inpatientCare'
import { useLang } from '@/lib/i18n/LangContext'

const STR = {
  fr: {
    orderTitle: '🧪 Demander un examen',
    individual: 'Test individuel', panel: 'Bilan (panel)', external: 'Test externe (hors laboratoire)',
    externalPh: 'Nom du test externe',
    selectFromCatalog: 'Sélectionner un test depuis le catalogue…',
    order: 'Demander',
    resultsTitle: 'Résultats validés (récents)',
    noResults: 'Aucun résultat validé pour le moment',
    critical: ' ⚠ CRITIQUE', abnormal: ' (anormal)',
    pendingTitle: 'Examens en cours',
    noPending: 'Aucun examen en attente.',
    statusPending: 'En attente de prélèvement',
    statusCollected: 'Prélevé — en cours',
    statusCompleted: 'Résultat saisi — en attente de validation',
    attachmentTitle: 'Terminés via pièce jointe',
    viewAttachment: 'Voir →',
    ordered: 'Prescrit',
    validated: 'Validé',
    locale: 'fr-FR',
  },
  en: {
    orderTitle: '🧪 Order Lab Test',
    individual: 'Individual test', panel: 'Panel', external: 'External test (outside laboratory)',
    externalPh: 'External test name',
    selectFromCatalog: 'Select a test from the catalog…',
    order: 'Order Lab',
    resultsTitle: 'Validated Lab Results (recent)',
    noResults: 'No validated results yet',
    critical: ' ⚠ CRITICAL', abnormal: ' (abnormal)',
    pendingTitle: 'Tests in Progress',
    noPending: 'No tests pending.',
    statusPending: 'Awaiting sample',
    statusCollected: 'Sample collected — in progress',
    statusCompleted: 'Result entered — awaiting verification',
    attachmentTitle: 'Completed via Attachment',
    viewAttachment: 'View →',
    ordered: 'Ordered',
    validated: 'Validated',
    locale: 'en-US',
  },
} as const

interface CatalogItem { id: string; name: string; category: string | null }
interface Result {
  id: string; test_name: string; result_value: string | null; is_abnormal: boolean; is_critical: boolean
  verified_at: string | null; ordered_at?: string | null
}
interface PendingResult { id: string; test_name: string; status: string }
interface AttachmentResult { id: string; test_name: string }

export default function LabsTab({
  admissionId, visitId, panels, tests, recentResults, pendingResults = [], attachmentResults = [],
}: {
  admissionId: string; visitId: string; panels: CatalogItem[]; tests: CatalogItem[]; recentResults: Result[]
  pendingResults?: PendingResult[]
  attachmentResults?: AttachmentResult[]
}) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()
  const [itemType, setItemType] = useState<'panel' | 'individual_test' | 'external'>('individual_test')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', width: '100%', boxSizing: 'border-box',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    formData.set('item_type', itemType)
    const result = await orderInpatientLabAction(admissionId, visitId, formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      router.refresh()
    }
  }

  return (
    <div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>{t.orderTitle}</p>
        <form action={handleSubmit}>
          <select value={itemType} onChange={(e) => setItemType(e.target.value as any)} style={{ ...inputStyle, marginBottom: '8px' }}>
            <option value="individual_test">{t.individual}</option>
            <option value="panel">{t.panel}</option>
            <option value="external">{t.external}</option>
          </select>

          {itemType === 'external' ? (
            <input name="external_name" placeholder={t.externalPh} style={{ ...inputStyle, marginBottom: '8px' }} />
          ) : (
            <select name="catalog_id" style={{ ...inputStyle, marginBottom: '8px' }}>
              <option value="">{t.selectFromCatalog}</option>
              {(itemType === 'panel' ? panels : tests).map((c) => (
                <option key={c.id} value={c.id}>{c.category ? `${c.category} — ${c.name}` : c.name}</option>
              ))}
            </select>
          )}

          {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}

          <button type="submit" disabled={submitting} style={{
            width: '100%', fontSize: '14px', fontWeight: 500, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
          }}>
            {submitting ? '…' : t.order}
          </button>
        </form>
      </div>

      {pendingResults.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>{t.pendingTitle}</p>
          {pendingResults.map((r) => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: '13px',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}>
              <span>{r.test_name}</span>
              <span style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                background: r.status === 'completed' ? 'var(--color-accent)' : 'var(--color-warning-bg)',
                color: r.status === 'completed' ? 'var(--color-accent-text-on)' : 'var(--color-warning-text)',
              }}>
                {r.status === 'completed' ? t.statusCompleted : r.status === 'sample_collected' ? t.statusCollected : t.statusPending}
              </span>
            </div>
          ))}
        </div>
      )}

      {attachmentResults.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>{t.attachmentTitle}</p>
          {attachmentResults.map((r) => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: '13px',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}>
              <span>✓ {r.test_name}</span>
              <Link href={`/laboratory/${r.id}`} style={{ fontSize: '12px', color: 'var(--color-accent)', textDecoration: 'none' }}>
                {t.viewAttachment}
              </Link>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>{t.resultsTitle}</p>
        {recentResults.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t.noResults}</p>
        ) : (
          // Group same-name tests together, oldest first, so a doctor
          // comparing control/repeat labs (e.g. three fasting glucose
          // readings over a stay) sees them in chronological sequence
          // rather than scattered by whichever order they were validated.
          [...recentResults]
            .sort((a, b) => {
              if (a.test_name !== b.test_name) return a.test_name.localeCompare(b.test_name)
              return new Date(a.ordered_at ?? a.verified_at ?? 0).getTime() - new Date(b.ordered_at ?? b.verified_at ?? 0).getTime()
            })
            .map((r) => (
              <div key={r.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', fontSize: '13px',
                borderBottom: '1px solid var(--color-border-subtle)',
                color: r.is_critical ? 'var(--color-critical-text)' : r.is_abnormal ? 'var(--color-warning-text)' : 'var(--color-text-primary)',
              }}>
                <div>
                  <div>{r.test_name}{r.is_critical ? t.critical : r.is_abnormal ? t.abnormal : ''}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {r.ordered_at && `${t.ordered} ${new Date(r.ordered_at).toLocaleString(t.locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                    {r.ordered_at && r.verified_at && ' · '}
                    {r.verified_at && `${t.validated} ${new Date(r.verified_at).toLocaleString(t.locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{r.result_value ?? '—'}</span>
              </div>
            ))
        )}
      </div>
    </div>
  )
}
