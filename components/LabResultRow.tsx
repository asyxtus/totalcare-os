'use client'

// components/LabResultRow.tsx
import { useLang } from '@/lib/i18n/LangContext'

// Now a plain controlled input, no independent save action of its own —
// its value lives in the parent form and gets submitted together with
// every other row when "Enregistrer et terminer" is clicked. This is
// the actual fix: no more silently-lost values from a forgotten
// per-row save click.

interface LabResultRowProps {
  testId: string
  testNameFr: string
  testNameEn?: string | null
  unit: string | null
  resultType: 'numeric' | 'qualitative'
  qualitativeOptions: string[] | null
  value: string
  onChange: (value: string) => void
  existingFlags: { isAbnormal: boolean; isCritical: boolean; verifiedAt: string | null } | null
}

export default function LabResultRow({
  testId, testNameFr, testNameEn, unit, resultType, qualitativeOptions, value, onChange, existingFlags,
}: LabResultRowProps) {
  const lang = useLang()
  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '140px',
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)', gap: '10px',
    }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '13px' }}>{(lang === 'en' && testNameEn) ? testNameEn : testNameFr}</span>
        {unit && <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}> ({unit})</span>}
      </div>

      {resultType === 'numeric' ? (
        <input
          type="number"
          step="any"
          name="result_numeric_value"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      ) : (
        <select name="result_qualitative_value" value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {qualitativeOptions?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}
      {/* Always submit both field names so getAll() arrays across all
          rows stay aligned by index regardless of result type. */}
      {resultType === 'numeric' && <input type="hidden" name="result_qualitative_value" value="" />}
      {resultType === 'qualitative' && <input type="hidden" name="result_numeric_value" value="" />}
      <input type="hidden" name="result_test_id" value={testId} />

      {existingFlags?.isCritical && (
        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)' }}>
          CRITIQUE
        </span>
      )}
      {existingFlags?.isAbnormal && !existingFlags?.isCritical && (
        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>
          Anormal
        </span>
      )}
      {existingFlags && !existingFlags.verifiedAt && (
        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'(non validé)':'(not validated)'}</span>
      )}
    </div>
  )
}
