'use client'

// components/DepositForm.tsx

import { useState } from 'react'
import { recordDepositAction } from '@/lib/actions/deposits'
import { useLang } from '@/lib/i18n/LangContext'

export default function DepositForm({
  patientId, onSuccess }: { patientId: string; onSuccess: () => void }) {
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await recordDepositAction(patientId, formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      setOpen(false)
      onSuccess()
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
        background: 'var(--color-surface)', color: 'var(--color-text-primary)', cursor: 'pointer',
      }}>
        {lang === 'fr' ? '+ Déposer' : '+ Deposit'}
      </button>
    )
  }

  return (
    <form action={handleSubmit} style={{
      display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
      background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '10px',
    }}>
      <input name="amount_xaf" type="number" step="any" placeholder={lang==="fr"?"Montant (FCFA)":"Amount (FCFA)"} required style={{ ...inputStyle, width: '130px' }} />
      <select name="method" style={inputStyle}>
        <option value="cash">{lang==="fr"?"Comptant":"Cash"}</option>
        <option value="momo">MTN MoMo</option>
        <option value="orange_money">Orange Money</option>
      </select>
      <input name="notes" placeholder={lang==="fr"?"Notes (optionnel)":"Notes (optional)"} style={{ ...inputStyle, flex: 1, minWidth: '140px' }} />
      <button type="submit" disabled={submitting} style={{
        fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : (lang === 'fr' ? 'Confirmer' : 'Confirm')}
      </button>
      <button type="button" onClick={() => setOpen(false)} style={{
        fontSize: '12px', padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
      }}>
        {lang === 'fr' ? 'Annuler' : 'Cancel'}
      </button>
      {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', width: '100%', margin: 0 }}>{error}</p>}
    </form>
  )
}
