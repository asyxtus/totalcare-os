'use client'

// components/CloseShiftForm.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { closeShift } from '@/lib/actions/billing'
import { useLang } from '@/lib/i18n/LangContext'

export default function CloseShiftForm({ shiftId, openingCash }: { shiftId: string; openingCash: number }) {
  const lang = useLang()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await closeShift(shiftId, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setOpen(false)
      setSubmitting(false)
      router.refresh()
    }
  }

  if (!open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-success-text)' }}>
          ✓ Caisse ouverte — fonds initial {Number(openingCash).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
        </span>
        <button onClick={() => setOpen(true)} style={{
          fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)', background: 'var(--color-surface)',
          color: 'var(--color-text-primary)', cursor: 'pointer',
        }}>
          {lang === 'fr' ? 'Clôturer la caisse' : 'Close shift'}
        </button>
      </div>
    )
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <div>
        <input
          name="closing_cash_xaf" type="number" step="any" placeholder={lang==="fr"?"Montant compté en caisse (FCFA)":"Counted cash amount (FCFA)"} required
          style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', marginBottom: '4px' }}
        />
        <input
          name="notes" placeholder={lang==="fr"?"Notes (optionnel)":"Notes (optional)"}
          style={{ display: 'block', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
        />
        {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '4px 0 0' }}>{error}</p>}
      </div>
      <button type="submit" disabled={submitting} style={{
        fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : 'Confirmer'}
      </button>
    </form>
  )
}
