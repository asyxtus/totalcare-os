'use client'

// components/InlineAdjustPanel.tsx

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { recordStockAdjustment } from '@/lib/actions/pharmacy'
import { useLang } from '@/lib/i18n/LangContext'

interface Batch { batch_id: string; batch_number: string; expiry_date: string; on_hand: number }

export default function InlineAdjustPanel({
  productId, onDone }: { productId: string; onDone: () => void }) {
  const lang = useLang()
  const [batches, setBatches] = useState<Batch[] | null>(null)
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [direction, setDirection] = useState<'increase' | 'decrease'>('decrease')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('get_product_batches', { p_product_id: productId }).then(({ data }) => {
      setBatches(data ?? [])
      if (data && data.length > 0) setSelectedBatchId(data[0].batch_id)
    })
  }, [productId])

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '12px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    formData.set('direction', direction)
    formData.set('batch_id', selectedBatchId)
    const result = await recordStockAdjustment(formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      onDone()
    }
  }

  if (batches === null) {
    return <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '10px 14px' }}>{lang==='fr'?'Chargement des lots…':'Loading batches…'}</p>
  }

  if (batches.length === 0) {
    return <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '10px 14px' }}>{lang === 'fr' ? 'Aucun lot actif pour ce produit — rien à ajuster.' : 'No active batch for this product — nothing to adjust.'}</p>
  }

  return (
    <form action={handleSubmit} style={{ padding: '10px 14px', background: 'var(--color-bg)', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} style={inputStyle}>
        {batches.map((b) => (
          <option key={b.batch_id} value={b.batch_id}>
            Lot {b.batch_number} — {b.on_hand} en stock (exp. {new Date(b.expiry_date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')})
          </option>
        ))}
      </select>

      <button type="button" onClick={() => setDirection('decrease')} style={{
        fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1px solid var(--color-border)',
        background: direction === 'decrease' ? 'var(--color-critical-text)' : 'var(--color-surface)',
        color: direction === 'decrease' ? 'white' : 'var(--color-text-primary)',
      }}>
        − Diminuer
      </button>
      <button type="button" onClick={() => setDirection('increase')} style={{
        fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1px solid var(--color-border)',
        background: direction === 'increase' ? 'var(--color-accent)' : 'var(--color-surface)',
        color: direction === 'increase' ? 'var(--color-accent-text-on)' : 'var(--color-text-primary)',
      }}>
        + Augmenter
      </button>

      <input name="quantity" type="number" placeholder={lang==="fr"?"Qté":"Qty"} required style={{ ...inputStyle, width: '70px' }} />
      <input name="reason" placeholder={lang==="fr"?"Motif (obligatoire)":"Reason (required)"} required style={{ ...inputStyle, flex: 1, minWidth: '160px' }} />

      <button type="submit" disabled={submitting} style={{
        fontSize: '11px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
      }}>
        {submitting ? '…' : (lang === 'fr' ? 'Confirmer' : 'Confirm')}
      </button>
      <button type="button" onClick={onDone} style={{
        fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
      }}>
        {lang === 'fr' ? 'Annuler' : 'Cancel'}
      </button>

      {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', width: '100%', margin: 0 }}>{error}</p>}
    </form>
  )
}
