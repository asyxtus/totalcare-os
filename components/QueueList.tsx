// components/QueueList.tsx
// Server-renderable (no 'use client' needed -- just markup and Links).
// Used by Dashboard (all statuses) and the role-specific views
// (Reception/Nursing/Doctor, each pre-filtered to their own slice) so
// there's exactly one rendering implementation to keep in sync, not four
// copies that quietly drift apart over time.

import Link from 'next/link'

const STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  registered:             { fr: 'Enregistré',           en: 'Registered' },
  triage:                 { fr: 'Triage',                en: 'Triage' },
  waiting_consultation:   { fr: 'En attente médecin',   en: 'Awaiting doctor' },
  in_consultation:        { fr: 'En consultation',       en: 'In consultation' },
  waiting_lab:            { fr: 'Attend résultats labo', en: 'Awaiting lab' },
  waiting_pharmacy:       { fr: 'Attend pharmacie',      en: 'Awaiting pharmacy' },
  billing:                { fr: 'Caisse',                en: 'Billing' },
  admitted:               { fr: 'Hospitalisé(e)',        en: 'Admitted' },
  completed:              { fr: 'Terminé',               en: 'Completed' },
  cancelled:              { fr: 'Annulé',                en: 'Cancelled' },
}

const STATUS_COLOR: Record<string, 'warning' | 'success'> = {
  registered: 'warning',
  triage: 'warning',
  waiting_consultation: 'warning',
  in_consultation: 'success',
  waiting_lab: 'warning',
  waiting_pharmacy: 'warning',
  billing: 'warning',
  admitted: 'success',
}

function timeAgo(dateStr: string, lang: 'fr' | 'en'): string {
  const minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (minutes < 1) return lang === 'fr' ? 'à l\'instant' : 'just now'
  if (minutes < 60) return lang === 'fr' ? `il y a ${minutes} min` : `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return lang === 'fr' ? `il y a ${hours} h` : `${hours}h ago`
}

interface QueueVisit {
  id: string
  status: string
  visit_reason: string | null
  created_at: string
  is_emergency?: boolean
  patients: { id: string; full_name: string; patient_code: string } | null
}

interface QueueListProps {
  visits: QueueVisit[]
  lang: 'fr' | 'en'
  getHref: (visit: QueueVisit) => string
  emptyMessage: string
}

export default function QueueList({ visits, lang, getHref, emptyMessage }: QueueListProps) {
  if (visits.length === 0) {
    return <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{emptyMessage}</p>
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
      {visits.map((visit, i) => {
        const patient = visit.patients
        const colorKey = STATUS_COLOR[visit.status] ?? 'warning'
        return (
          <Link
            key={visit.id}
            href={getHref(visit)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', textDecoration: 'none', color: 'inherit',
              borderBottom: i < visits.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--color-success-bg)', color: 'var(--color-success-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 500,
              }}>
                {patient?.full_name?.split(' ').map((n) => n[0]).slice(0, 2).join('') ?? '?'}
              </div>
              <div>
                <div style={{ fontSize: '13px' }}>
                  {patient?.full_name ?? '--'}
                  {visit.is_emergency && (
                    <span style={{
                      fontSize: '10px', marginLeft: '6px', padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
                    }}>
                      URGENCE
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {patient?.patient_code}
                  {visit.visit_reason ? ` · ${visit.visit_reason}` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {timeAgo(visit.created_at, lang)}
              </span>
              <span style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                background: colorKey === 'success' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                color: colorKey === 'success' ? 'var(--color-success-text)' : 'var(--color-warning-text)',
              }}>
                {STATUS_LABELS[visit.status]?.[lang] ?? visit.status}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
