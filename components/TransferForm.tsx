'use client'

// components/TransferForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { transferPatientAction } from '@/lib/actions/admissions'
import { useLang } from '@/lib/i18n/LangContext'

interface Ward { id: string; name: string; beds: { id: string; bed_number: string }[] }

export default function TransferForm({
  admissionId, wards, onDone }: { admissionId: string; wards: Ward[]; onDone: () => void }) {
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
    const result = await transferPatientAction(admissionId, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      onDone()
      router.refresh()
    }
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 14px', background: 'var(--color-bg)', flexWrap: 'wrap' }}>
      <select name="to_ward_id" value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)} required style={inputStyle}>
        <option value="">{lang==="fr"?"Nouveau service":"New ward"}</option>
        {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <select name="to_bed_id" required style={inputStyle} disabled={!selectedWard}>
        <option value="">{lang==="fr"?"Nouveau lit":"New bed"}</option>
        {availableBeds.map((b) => <option key={b.id} value={b.id}>{b.bed_number}</option>)}
      </select>
      <input name="reason" placeholder={lang==="fr"?"Motif du transfert":"Transfer reason"} required style={{ ...inputStyle, flex: 1, minWidth: '160px' }} />
      <button type="submit" disabled={submitting} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
        {submitting ? '…' : (lang==='fr'?'Transférer':'Transfer')}
      </button>
      <button type="button" onClick={onDone} style={{ fontSize: '12px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
        {lang === 'fr' ? 'Annuler' : 'Cancel'}
      </button>
      {error && <span style={{ fontSize: '11px', color: 'var(--color-critical-text)', width: '100%' }}>{error}</span>}
    </form>
  )
}
