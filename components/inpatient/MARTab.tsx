'use client'

// components/inpatient/MARTab.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordMedicationAdministrationAction } from '@/lib/actions/inpatientCare'
import { useLang } from '@/lib/i18n/LangContext'

interface Administration { id: string; status: string; administered_at?: string | null; notes?: string | null; staff_name?: string | null }
interface PrescriptionItem {
  id: string
  drug_display_name: string
  dose: string | null
  route: string | null
  frequency: string | null
  dispensed_total: number
  administrations: Administration[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  administered: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
  refused: { bg: 'var(--color-critical-bg)', text: 'var(--color-critical-text)' },
  missed: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
}

const STR = {
  fr: {
    administered: 'Administré',
    notYetDispensed: '⏳ Pas encore délivré par la pharmacie — « Administré » est désactivé en attendant.',
    notDispensedSuffix: ' (pas encore délivré)',
    empty: 'Aucun médicament prescrit pendant ce séjour.',
    dispensedLine: (d: number, a: number) => `Délivré ${d} · Administré ${a}`,
    awaitingLine: (d: number, a: number) => `⏳ En attente de la pharmacie — ${d} délivré(s), ${a} déjà administré(s)`,
    log: 'Enregistrer',
    logAdministration: 'Enregistrer une administration',
    notesPh: 'Notes (optionnel)',
    refused: 'Refusé',
    missed: 'Manqué',
    statusLabel: { administered: 'administré', refused: 'refusé', missed: 'manqué' } as Record<string, string>,
    locale: 'fr-FR',
  },
  en: {
    administered: 'Administered',
    notYetDispensed: '⏳ Not yet dispensed by pharmacy — «Administered» is disabled until then.',
    notDispensedSuffix: ' (not yet dispensed)',
    empty: 'No medications prescribed during this stay.',
    dispensedLine: (d: number, a: number) => `Dispensed ${d} · Administered ${a}`,
    awaitingLine: (d: number, a: number) => `⏳ Awaiting pharmacy — ${d} dispensed, ${a} already administered`,
    log: 'Record',
    logAdministration: 'Record administration',
    notesPh: 'Notes (optional)',
    refused: 'Refused',
    missed: 'Missed',
    statusLabel: { administered: 'administered', refused: 'refused', missed: 'missed' } as Record<string, string>,
    locale: 'en-US',
  },
} as const

function LogAdministrationForm({
  admissionId, itemId, onDone, canLogAdministered,
}: { admissionId: string; itemId: string; onDone: () => void; canLogAdministered: boolean }) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await recordMedicationAdministrationAction(admissionId, itemId, formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      onDone()
      router.refresh()
    }
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '8px 0', flexWrap: 'wrap' }}>
      <select name="status" defaultValue={canLogAdministered ? 'administered' : 'missed'} style={{ fontSize: '12px', padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}>
        <option value="administered" disabled={!canLogAdministered}>
          {t.administered}{canLogAdministered ? '' : t.notDispensedSuffix}
        </option>
        <option value="refused">{t.refused}</option>
        <option value="missed">{t.missed}</option>
      </select>
      <input name="notes" placeholder={t.notesPh} style={{ fontSize: '12px', padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', flex: 1, minWidth: '120px' }} />
      <button type="submit" disabled={submitting} style={{ fontSize: '11px', padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
        {submitting ? '…' : t.log}
      </button>
      {!canLogAdministered && (
        <span style={{ fontSize: '10px', color: 'var(--color-warning-text)', width: '100%' }}>
          {t.notYetDispensed}
        </span>
      )}
      {error && <span style={{ fontSize: '10px', color: 'var(--color-critical-text)', width: '100%' }}>{error}</span>}
    </form>
  )
}

export default function MARTab({ admissionId, items }: { admissionId: string; items: PrescriptionItem[] }) {
  const lang = useLang()
  const t = STR[lang]
  const [loggingFor, setLoggingFor] = useState<string | null>(null)

  if (items.length === 0) {
    return <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t.empty}</p>
  }

  return (
    <div>
      {items.map((item) => {
        const administeredCount = item.administrations.filter((a) => a.status === 'administered').length
        const canLogAdministered = administeredCount < item.dispensed_total
        return (
        <div key={item.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{item.drug_display_name}</p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                {[item.dose, item.route, item.frequency].filter(Boolean).join(' · ') || '—'}
              </p>
              <p style={{ fontSize: '11px', margin: '4px 0 0', color: canLogAdministered ? 'var(--color-text-secondary)' : 'var(--color-warning-text)' }}>
                {canLogAdministered
                  ? t.dispensedLine(item.dispensed_total, administeredCount)
                  : t.awaitingLine(item.dispensed_total, administeredCount)}
              </p>
            </div>
            <button onClick={() => setLoggingFor((l) => l === item.id ? null : item.id)} style={{
              fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
            }}>
              {t.logAdministration}
            </button>
          </div>

          {loggingFor === item.id && (
            <LogAdministrationForm admissionId={admissionId} itemId={item.id} onDone={() => setLoggingFor(null)} canLogAdministered={canLogAdministered} />
          )}

          {item.administrations.length > 0 && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)' }}>
              {item.administrations.map((a) => {
                const colors = STATUS_COLORS[a.status] ?? STATUS_COLORS.administered
                return (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0' }}>
                    <span>
                      <span style={{ padding: '1px 8px', borderRadius: '999px', background: colors.bg, color: colors.text, marginRight: '6px', fontSize: '11px' }}>{t.statusLabel[a.status] ?? a.status}</span>
                      {a.staff_name}{a.notes ? ` — ${a.notes}` : ''}
                    </span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{a.administered_at ? new Date(a.administered_at).toLocaleString(t.locale) : '—'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )
      })}
    </div>
  )
}
