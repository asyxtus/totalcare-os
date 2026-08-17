'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { savePosDailyReconciliation } from '@/lib/actions/pos'
import { useLang } from '@/lib/i18n/LangContext'

export default function PosDailyReconciliationForm({
  date,
  expectedCash,
  expectedMomo,
  expectedOrange,
  saved,
}: {
  date: string
  expectedCash: number
  expectedMomo: number
  expectedOrange: number
  saved: {
    cash: number
    momo: number
    orange: number
    notes: string | null
    reconciledAt: string
    reconciledBy: string | null
  } | null
}) {
  const lang = useLang()
  const router = useRouter()
  const [cash, setCash] = useState(saved?.cash?.toString() ?? '')
  const [momo, setMomo] = useState(saved?.momo?.toString() ?? '')
  const [orange, setOrange] = useState(saved?.orange?.toString() ?? '')
  const [notes, setNotes] = useState(saved?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  const actualCash = Number(cash || 0)
  const actualMomo = Number(momo || 0)
  const actualOrange = Number(orange || 0)
  const expectedTotal = expectedCash + expectedMomo + expectedOrange
  const actualTotal = actualCash + actualMomo + actualOrange
  const variance = actualTotal - expectedTotal

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const result = await savePosDailyReconciliation(date, formData)

    if (result && 'error' in result && result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      router.refresh()
    }
    setSaving(false)
  }

  const money = (value: number) => value.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')
  const varianceLabel = variance === 0
    ? (lang === 'fr' ? 'Équilibré' : 'Balanced')
    : variance > 0
      ? (lang === 'fr' ? 'Excédent' : 'Over')
      : (lang === 'fr' ? 'Manquant' : 'Short')

  return (
    <form onSubmit={handleSubmit} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {[
          ['cash_counted_xaf', lang === 'fr' ? 'Comptant compté' : 'Cash counted', cash, setCash, expectedCash],
          ['momo_counted_xaf', 'MTN MoMo compté', momo, setMomo, expectedMomo],
          ['orange_money_counted_xaf', 'Orange Money compté', orange, setOrange, expectedOrange],
        ].map(([name, label, value, setter, expected]) => (
          <label key={name as string} style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            <span style={{ display: 'block', marginBottom: '5px' }}>{label as string}</span>
            <input
              name={name as string}
              type="number"
              min="0"
              step="1"
              value={value as string}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              required
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
            />
            <span style={{ display: 'block', marginTop: '4px', fontSize: '10px' }}>
              {lang === 'fr' ? 'Attendu' : 'Expected'}: {money(expected as number)} FCFA
            </span>
          </label>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '10px 0', borderTop: '1px solid var(--color-border-subtle)', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: '12px' }}>
        <div>
          <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Total attendu' : 'Expected total'}</span>
          <strong style={{ fontFamily: 'var(--font-mono)' }}>{money(expectedTotal)} FCFA</strong>
        </div>
        <div>
          <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Total compté' : 'Counted total'}</span>
          <strong style={{ fontFamily: 'var(--font-mono)' }}>{money(actualTotal)} FCFA</strong>
        </div>
        <div>
          <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-secondary)' }}>{varianceLabel}</span>
          <strong style={{ fontFamily: 'var(--font-mono)', color: variance === 0 ? 'var(--color-success-text)' : 'var(--color-critical-text)' }}>
            {variance > 0 ? '+' : ''}{money(variance)} FCFA
          </strong>
        </div>
      </div>

      <textarea
        name="notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={lang === 'fr' ? 'Notes de rapprochement (optionnel)' : 'Reconciliation notes (optional)'}
        rows={2}
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', marginBottom: '10px', resize: 'vertical' }}
      />

      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', margin: '0 0 10px' }}>{error}</p>}
      {success && <p style={{ fontSize: '12px', color: 'var(--color-success-text)', background: 'var(--color-success-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', margin: '0 0 10px' }}>{lang === 'fr' ? 'Rapprochement enregistré.' : 'Reconciliation saved.'}</p>}

      <button type="submit" disabled={saving} style={{ padding: '9px 14px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
        {saving ? '…' : lang === 'fr' ? 'Enregistrer le rapprochement' : 'Save reconciliation'}
      </button>
    </form>
  )
}
