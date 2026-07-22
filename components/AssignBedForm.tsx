'use client'

// components/AssignBedForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignBedAction } from '@/lib/actions/admissions'
import { useLang } from '@/lib/i18n/LangContext'

interface Ward { id: string; name: string; beds: { id: string; bed_number: string }[] }

export default function AssignBedForm({ admissionId, wards, onDone }: { admissionId: string; wards: Ward[]; onDone: () => void }) {
  const lang = useLang()
  const router = useRouter()
  const [selectedWard, setSelectedWard] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '12px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  const availableBeds = wards.find((w) => w.id === selectedWard)?.beds ?? []

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await assignBedAction(admissionId, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      onDone()
      router.refresh()
    }
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 14px', background: 'var(--color-bg)' }}>
      <select name="ward_id" value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)} required style={inputStyle}>
        <option value="">{lang === 'fr' ? 'Service' : 'Ward'}</option>
        {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <select name="bed_id" required style={inputStyle} disabled={!selectedWard}>
        <option value="">{lang === 'fr' ? 'Lit' : 'Bed'}</option>
        {availableBeds.map((b) => <option key={b.id} value={b.id}>{b.bed_number}</option>)}
      </select>
      <button type="submit" disabled={submitting} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
        {submitting ? '…' : (lang === 'fr' ? 'Confirmer' : 'Confirm')}
      </button>
      <button type="button" onClick={onDone} style={{ fontSize: '12px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
        {lang === 'fr' ? 'Annuler' : 'Cancel'}
      </button>
      {error && <span style={{ fontSize: '11px', color: 'var(--color-critical-text)' }}>{error}</span>}
    </form>
  )
}
