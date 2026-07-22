'use client'

// components/VerifyResultsList.tsx

import { useState } from 'react'
import { verifyResult } from '@/lib/actions/lab'
import { useLang } from '@/lib/i18n/LangContext'

interface ResultRow {
  id: string
  testName: string
  unit: string | null
  value: string
  isAbnormal: boolean
  isCritical: boolean
  verifiedAt: string | null
}

export default function VerifyResultsList({ itemId, results }: { itemId: string; results: ResultRow[] }) {
  const lang = useLang()
  const [verified, setVerified] = useState<Record<string, boolean>>({})

  async function handleVerify(resultId: string) {
    const result = await verifyResult(resultId, itemId)
    if (result && 'success' in result && result.success) {
      setVerified((prev) => ({ ...prev, [resultId]: true }))
    }
  }

  if (results.length === 0) {
    return (
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {lang==='fr'
            ? 'Terminé via une pièce jointe — aucune valeur individuelle à valider.'
            : 'Completed via an attached file — no individual values to verify.'}
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
      {results.map((r) => {
        const isVerified = r.verifiedAt || verified[r.id]
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '13px' }}>
              {r.testName}: <strong>{r.value}</strong>{r.unit ? ` ${r.unit}` : ''}
            </span>
            <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {r.isCritical && (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)' }}>
                  CRITIQUE
                </span>
              )}
              {r.isAbnormal && !r.isCritical && (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>
                  Anormal
                </span>
              )}
              {isVerified ? (
                <span style={{ fontSize: '11px', color: 'var(--color-success-text)' }}>{lang==='fr'?'✓ Validé':'✓ Verified'}</span>
              ) : (
                <button onClick={() => handleVerify(r.id)} style={{
                  fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
                }}>
                  Valider
                </button>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
