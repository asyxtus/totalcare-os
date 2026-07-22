// components/StockAdjustmentForm.tsx
'use client'

import { useState } from 'react'
import { recordStockAdjustment } from '@/lib/actions/pharmacy'

interface BatchOption { id: string; productName: string; batchNumber: string; onHand: number }

export default function StockAdjustmentForm({ batches }: { batches: BatchOption[] }) {
  const [query, setQuery] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [direction, setDirection] = useState<'increase' | 'decrease'>('decrease')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const matches = query.trim()
    ? batches.filter((b) => b.productName.toLowerCase().includes(query.toLowerCase()) || b.batchNumber.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []
  const selectedBatch = batches.find((b) => b.id === selectedBatchId)

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '100%',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    formData.set('direction', direction)
    const result = await recordStockAdjustment(formData)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setSelectedBatchId('')
      setTimeout(() => setSuccess(false), 2500)
    }
    setSubmitting(false)
  }

  return (
    <form action={handleSubmit} style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 10px' }}>Nouvel ajustement de stock</p>

      {!selectedBatch ? (
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un lot à ajuster…" style={inputStyle} />
          {matches.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', marginTop: '4px' }}>
              {matches.map((b) => (
                <div key={b.id} onClick={() => { setSelectedBatchId(b.id); setQuery('') }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  {b.productName} — lot {b.batchNumber} ({b.onHand} en stock)
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
          <span>{selectedBatch.productName} — lot {selectedBatch.batchNumber} ({selectedBatch.onHand} en stock actuellement)</span>
          <button type="button" onClick={() => setSelectedBatchId('')} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '12px' }}>Changer</button>
        </div>
      )}
      <input type="hidden" name="batch_id" value={selectedBatchId} />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button type="button" onClick={() => setDirection('decrease')} style={{
          fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          border: '1px solid var(--color-border)',
          background: direction === 'decrease' ? 'var(--color-critical-text)' : 'var(--color-surface)',
          color: direction === 'decrease' ? 'white' : 'var(--color-text-primary)',
        }}>
          − Diminuer (perte, casse, périmé)
        </button>
        <button type="button" onClick={() => setDirection('increase')} style={{
          fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          border: '1px solid var(--color-border)',
          background: direction === 'increase' ? 'var(--color-accent)' : 'var(--color-surface)',
          color: direction === 'increase' ? 'var(--color-accent-text-on)' : 'var(--color-text-primary)',
        }}>
          + Augmenter (erreur de comptage)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
        <input name="quantity" type="number" placeholder="Quantité *" required style={inputStyle} />
        <input name="reason" placeholder="Motif (obligatoire) — ex. comptage physique du 07/07" required style={inputStyle} />
      </div>

      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}
      {success && <p style={{ fontSize: '12px', color: 'var(--color-success-text)', marginBottom: '8px' }}>✓ Ajustement enregistré.</p>}

      <button type="submit" disabled={!selectedBatchId || submitting} style={{
        fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
        cursor: !selectedBatchId || submitting ? 'not-allowed' : 'pointer', opacity: !selectedBatchId || submitting ? 0.5 : 1,
      }}>
        {submitting ? '…' : 'Enregistrer l\'ajustement'}
      </button>
    </form>
  )
}
