'use client'

// components/InitiateRecallForm.tsx

import { useState } from 'react'
import { initiateRecall } from '@/lib/actions/recalls'
import { useLang } from '@/lib/i18n/LangContext'

interface BatchOption {
  id: string
  productName: string
  batchNumber: string
  expiryDate: string
}

export default function InitiateRecallForm({ batches }: { batches: BatchOption[] }) {
  const lang = useLang()
  const [query, setQuery] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const matches = query.trim()
    ? batches.filter((b) =>
        b.productName.toLowerCase().includes(query.toLowerCase()) ||
        b.batchNumber.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  const selectedBatch = batches.find((b) => b.id === selectedBatchId)

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '100%',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await initiateRecall(formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSuccess(true)
      setSelectedBatchId('')
      setQuery('')
      setReason('')
      setSubmitting(false)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <form action={handleSubmit} style={{
      background: 'var(--color-critical-bg)', border: '1px solid var(--color-critical-text)',
      borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 10px', color: 'var(--color-critical-text)' }}>
        Lancer un rappel de lot
      </p>

      {!selectedBatch ? (
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang==="fr"?"Rechercher un produit ou un numéro de lot…":"Search product or batch number…"}
            style={inputStyle}
          />
          {matches.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', marginTop: '4px', maxHeight: '200px', overflowY: 'auto',
            }}>
              {matches.map((b) => (
                <div key={b.id} onClick={() => { setSelectedBatchId(b.id); setQuery('') }} style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}>
                  {b.productName} — lot {b.batchNumber} (exp. {new Date(b.expiryDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')})
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '13px' }}>
          <span>{selectedBatch.productName} — lot {selectedBatch.batchNumber}</span>
          <button type="button" onClick={() => setSelectedBatchId('')} style={{ background: 'none', border: 'none', color: 'var(--color-critical-text)', cursor: 'pointer', fontSize: '12px' }}>
            Changer
          </button>
        </div>
      )}
      <input type="hidden" name="batch_id" value={selectedBatchId} />

      <textarea
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={lang==="fr"?"Motif du rappel (obligatoire) — ex. contamination signalée par le fabricant":"Recall reason (required) — e.g. contamination reported by manufacturer"}
        rows={2}
        style={{ ...inputStyle, resize: 'vertical', marginBottom: '10px' }}
      />

      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}
      {success && <p style={{ fontSize: '12px', color: 'var(--color-success-text)', marginBottom: '8px' }}>✓ Rappel lancé — le lot est immédiatement retiré de la dispensation.</p>}

      <button type="submit" disabled={!selectedBatchId || submitting} style={{
        fontSize: '13px', fontWeight: 500, padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
        background: 'var(--color-critical-text)', color: 'white',
        cursor: !selectedBatchId || submitting ? 'not-allowed' : 'pointer',
        opacity: !selectedBatchId || submitting ? 0.5 : 1,
      }}>
        {submitting ? '…' : (lang === 'fr' ? 'Confirmer le rappel' : 'Confirm recall')}
      </button>
    </form>
  )
}
