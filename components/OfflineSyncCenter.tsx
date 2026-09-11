'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OutboxEntry, OutboxStatus } from '@/lib/offline/db'
import { retryOfflineOperation, subscribeToOutboxChanges } from '@/lib/offline/outbox'

const SYNC_REQUEST_EVENT = 'totalcare:offline-sync-requested'

function operationLabel(operation: string, lang: 'fr' | 'en') {
  const labels: Record<string, [string, string]> = {
    'patient-registration': ['Enregistrement patient', 'Patient registration'],
    'appointment-booking': ['Prise de rendez-vous', 'Appointment booking'],
    'triage-capture': ['Triage', 'Triage'],
  }
  return labels[operation]?.[lang === 'fr' ? 0 : 1] ?? operation
}

function statusLabel(status: OutboxStatus, lang: 'fr' | 'en') {
  const labels: Record<OutboxStatus, [string, string]> = {
    pending: ['En attente', 'Pending'],
    processing: ['En cours', 'Processing'],
    failed: ['Échec', 'Failed'],
    blocked: ['À vérifier', 'Needs review'],
  }
  return labels[status][lang === 'fr' ? 0 : 1]
}

function statusTone(status: OutboxStatus) {
  if (status === 'blocked') return 'var(--color-critical-text)'
  if (status === 'failed') return 'var(--color-warning-text)'
  if (status === 'processing') return 'var(--color-accent)'
  return 'var(--color-text-secondary)'
}

function formatDate(value: string, lang: 'fr' | 'en') {
  try {
    return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

export default function OfflineSyncCenter({ lang }: { lang: 'fr' | 'en' }) {
  const [entries, setEntries] = useState<OutboxEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { getAllRecords } = await import('@/lib/offline/db')
      const all = await getAllRecords<OutboxEntry>('outbox')
      setEntries(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return subscribeToOutboxChanges(() => { void load() })
  }, [load])

  const counts = useMemo(() => ({
    pending: entries.filter(e => e.status === 'pending').length,
    processing: entries.filter(e => e.status === 'processing').length,
    failed: entries.filter(e => e.status === 'failed').length,
    blocked: entries.filter(e => e.status === 'blocked').length,
  }), [entries])

  const retry = async (id: string) => {
    setRetrying(id)
    try {
      await retryOfflineOperation(id)
      window.dispatchEvent(new Event(SYNC_REQUEST_EVENT))
    } finally {
      setRetrying(null)
    }
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Chargement…' : 'Loading…'}</p>

  return <section aria-label={lang === 'fr' ? 'Centre de synchronisation hors ligne' : 'Offline Sync Center'} style={{ maxWidth: 1100 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>{lang === 'fr' ? 'Synchronisation hors ligne' : 'Offline Sync Center'}</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '5px 0 0' }}>
          {lang === 'fr' ? 'Suivez les opérations locales qui attendent une synchronisation ou une vérification.' : 'Review local operations waiting for synchronization or staff review.'}
        </p>
      </div>
      <button type="button" onClick={() => void load()} style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', padding: '7px 11px', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer' }}>
        {lang === 'fr' ? 'Actualiser' : 'Refresh'}
      </button>
    </div>

    {error && <div role="alert" style={{ background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 14, fontSize: 12 }}>{error}</div>}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 18 }}>
      {(['pending', 'processing', 'failed', 'blocked'] as OutboxStatus[]).map(status => <div key={status} style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{statusLabel(status, lang)}</div>
        <div style={{ fontSize: 20, fontWeight: 500, color: statusTone(status), marginTop: 2 }}>{counts[status]}</div>
      </div>)}
    </div>

    {entries.length === 0 ? <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 28, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
      {lang === 'fr' ? 'Aucune opération en attente. La file locale est propre.' : 'No queued operations. The local outbox is clear.'}
    </div> : <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto', background: 'var(--color-surface)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
          <th style={{ padding: '10px 12px', fontWeight: 500 }}>{lang === 'fr' ? 'Opération' : 'Operation'}</th>
          <th style={{ padding: '10px 12px', fontWeight: 500 }}>{lang === 'fr' ? 'État' : 'Status'}</th>
          <th style={{ padding: '10px 12px', fontWeight: 500 }}>{lang === 'fr' ? 'Créée' : 'Created'}</th>
          <th style={{ padding: '10px 12px', fontWeight: 500 }}>{lang === 'fr' ? 'Tentatives' : 'Attempts'}</th>
          <th style={{ padding: '10px 12px', fontWeight: 500 }}>{lang === 'fr' ? 'Dernière erreur' : 'Last error'}</th>
          <th style={{ padding: '10px 12px' }} />
        </tr></thead>
        <tbody>{entries.map(entry => <tr key={entry.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
          <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>{operationLabel(entry.operation, lang)}</td>
          <td style={{ padding: '11px 12px', color: statusTone(entry.status), whiteSpace: 'nowrap' }}>{statusLabel(entry.status, lang)}</td>
          <td style={{ padding: '11px 12px', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>{formatDate(entry.createdAt, lang)}</td>
          <td style={{ padding: '11px 12px', textAlign: 'center' }}>{entry.attempts}</td>
          <td style={{ padding: '11px 12px', minWidth: 260, maxWidth: 460 }}>{entry.lastError ? <span style={{ color: entry.status === 'blocked' ? 'var(--color-critical-text)' : 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entry.lastError}</span> : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}</td>
          <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
            {(entry.status === 'failed' || entry.status === 'blocked') && <button type="button" disabled={retrying === entry.id} onClick={() => void retry(entry.id)} style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', padding: '6px 9px', borderRadius: 'var(--radius-sm)', fontSize: 11, cursor: retrying === entry.id ? 'wait' : 'pointer' }}>
              {retrying === entry.id ? (lang === 'fr' ? 'Relance…' : 'Retrying…') : (lang === 'fr' ? 'Réessayer' : 'Retry')}
            </button>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>
}
