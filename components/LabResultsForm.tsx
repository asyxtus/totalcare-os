'use client'

// components/LabResultsForm.tsx

import { useState } from 'react'
import LabResultRow from '@/components/LabResultRow'
import { saveResultsAndComplete } from '@/lib/actions/lab'
import { useLang } from '@/lib/i18n/LangContext'

interface TestDef {
  id: string
  name_fr: string
  name_en?: string | null
  unit: string | null
  result_type: 'numeric' | 'qualitative'
  qualitative_options: string[] | null
}

interface ExistingResult {
  numeric_value: number | null
  qualitative_value: string | null
  is_abnormal: boolean
  is_critical: boolean
  verified_at: string | null
}

export default function LabResultsForm({
  itemId, clinicId, tests, existingResults,
}: {
  itemId: string
  clinicId: string
  tests: TestDef[]
  existingResults: Record<string, ExistingResult>
}) {
  const lang = useLang()
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const t of tests) {
      const existing = existingResults[t.id]
      initial[t.id] = existing ? String(existing.numeric_value ?? existing.qualitative_value ?? '') : ''
    }
    return initial
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await saveResultsAndComplete(itemId, clinicId, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
    // On success, redirects server-side.
  }

  return (
    <form action={handleSubmit}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
        {tests.map((test) => (
          <LabResultRow
            key={test.id}
            testId={test.id}
            testNameFr={test.name_fr}
            testNameEn={test.name_en}
            unit={test.unit}
            resultType={test.result_type}
            qualitativeOptions={test.qualitative_options}
            value={values[test.id] ?? ''}
            onChange={(v) => setValues((prev) => ({ ...prev, [test.id]: v }))}
            existingFlags={existingResults[test.id] ? {
              isAbnormal: existingResults[test.id].is_abnormal,
              isCritical: existingResults[test.id].is_critical,
              verifiedAt: existingResults[test.id].verified_at,
            } : null}
          />
        ))}
      </div>

      {error && (
        <p role="alert" style={{
          fontSize: '13px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)',
          padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem',
        }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} style={{
        fontSize: '13px', padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
        cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
      }}>
        {submitting ? (lang==='fr'?'Enregistrement…':'Saving…') : (lang==='fr'?"Enregistrer et terminer l'examen":'Save and complete test')}
      </button>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
        {lang==='fr'?'Toutes les valeurs saisies ci-dessus seront enregistrées automatiquement — pas besoin de':'All values entered above will be saved automatically — no need to'}
        {lang==='fr'?'sauvegarder chaque ligne séparément.':'save each row separately.'}
      </p>
    </form>
  )
}
