'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LangContext'
import { correctBatchExpiryDate } from '@/lib/actions/batchExpiry'

interface Batch { batch_id: string; batch_number: string; expiry_date: string; on_hand: number }

export default function BatchList({ productId }: { productId: string }) {
  const lang = useLang()
  const [batches, setBatches] = useState<Batch[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newDate, setNewDate] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadBatches() {
    const supabase = createClient()
    const { data } = await supabase.rpc('get_product_batches', { p_product_id: productId })
    setBatches(data ?? [])
  }

  useEffect(() => { loadBatches() }, [productId])

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const now = new Date()
  const soonThreshold = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  if (batches === null) {
    return <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '10px 14px' }}>{lang==='fr'?'Chargement des lots…':'Loading batches…'}</p>
  }

  if (batches.length === 0) {
    return <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '10px 14px' }}>{lang === 'fr' ? 'Aucun lot actif pour ce produit.' : 'No active batch for this product.'}</p>
  }

  const sorted = [...batches].sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())

  async function saveExpiry(batchId: string) {
    if (!newDate || !reason.trim()) {
      setError(lang === 'fr' ? 'La nouvelle date et le motif sont obligatoires.' : 'New date and reason are required.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await correctBatchExpiryDate(batchId, newDate, reason)
    if (result.error) {
      setError(result.error)
    } else {
      setEditingId(null)
      setNewDate('')
      setReason('')
      await loadBatches()
    }
    setSaving(false)
  }

  return (
    <div style={{ padding: '10px 14px', background: 'var(--color-bg)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}>
            <th style={{ padding: '4px 8px 4px 0', fontWeight: 500 }}>{lang === 'fr' ? 'Lot' : 'Batch'}</th>
            <th style={{ padding: '4px 8px', fontWeight: 500 }}>{lang === 'fr' ? 'Expiration' : 'Expiry'}</th>
            <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'right' }}>{lang === 'fr' ? 'En stock' : 'On hand'}</th>
            <th style={{ padding: '4px 0', fontWeight: 500, textAlign: 'right' }}>{lang === 'fr' ? 'Action' : 'Action'}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b, i) => {
            const expiryDate = new Date(b.expiry_date)
            const isExpiringSoon = expiryDate <= soonThreshold
            const isEditing = editingId === b.batch_id
            return (
              <tr key={b.batch_id} style={{ borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                <td style={{ padding: '6px 8px 6px 0', fontFamily: 'var(--font-mono)' }}>
                  {b.batch_number}
                  {i === 0 && <span style={{ marginLeft: '6px', fontSize: '9px', padding: '1px 6px', borderRadius: '999px', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', fontWeight: 700 }}>{lang === 'fr' ? 'PROCHAIN' : 'NEXT'}</span>}
                </td>
                <td style={{ padding: '6px 8px', color: isExpiringSoon ? 'var(--color-warning-text)' : 'var(--color-text-primary)', fontWeight: isExpiringSoon ? 600 : 400 }}>
                  {expiryDate.toLocaleDateString(locale)}
                  {isExpiringSoon && ' ⚠'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.on_hand}</td>
                <td style={{ padding: '6px 0', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => { setEditingId(isEditing ? null : b.batch_id); setNewDate(b.expiry_date.slice(0, 10)); setReason(''); setError(null) }}
                    style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: '4px 7px', cursor: 'pointer', fontSize: '11px' }}
                  >
                    {lang === 'fr' ? 'Corriger' : 'Correct'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {editingId && (
        <div style={{ marginTop: '10px', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{lang === 'fr' ? 'Correction de la date d’expiration' : 'Correct expiry date'}</div>
          <div style={{ display: 'grid', gap: '8px' }}>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ padding: '7px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }} />
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder={lang === 'fr' ? 'Motif obligatoire — ex. erreur de saisie à la réception' : 'Required reason — e.g. receiving entry error'} style={{ padding: '7px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }} />
            {error && <div style={{ color: 'var(--color-critical-text)', fontSize: '11px' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button type="button" onClick={() => setEditingId(null)} disabled={saving} style={{ padding: '6px 10px', border: '1px solid var(--color-border)', background: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button type="button" onClick={() => saveExpiry(editingId)} disabled={saving} style={{ padding: '6px 10px', border: 0, background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>{saving ? '…' : (lang === 'fr' ? 'Enregistrer la correction' : 'Save correction')}</button>
            </div>
          </div>
        </div>
      )}

      <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>
        {lang === 'fr' ? '« PROCHAIN » indique le lot utilisé en premier selon le FEFO. Les corrections de péremption sont réservées aux administrateurs et sont journalisées.' : '"NEXT" marks the batch used first by FEFO. Expiry corrections are admin-only and audited.'}
      </p>
    </div>
  )
}
