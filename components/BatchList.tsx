'use client'

// components/BatchList.tsx
//
// Read-only view of a product's batches — batch number, expiry, quantity
// remaining. The data already existed (get_product_batches, same RPC
// InlineAdjustPanel uses), but the only way to see it was to open the
// stock-adjustment tool and scroll through a <select> one option at a
// time. This surfaces the same information directly, side by side, for
// anyone who just wants to check what's in stock without intending to
// change anything.

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/LangContext'

interface Batch { batch_id: string; batch_number: string; expiry_date: string; on_hand: number }

export default function BatchList({ productId }: { productId: string }) {
  const lang = useLang()
  const [batches, setBatches] = useState<Batch[] | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('get_product_batches', { p_product_id: productId }).then(({ data }) => {
      setBatches(data ?? [])
    })
  }, [productId])

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const now = new Date()
  const soonThreshold = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) // 60 days — a visual nudge, not a hard rule

  if (batches === null) {
    return <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '10px 14px' }}>{lang==='fr'?'Chargement des lots…':'Loading batches…'}</p>
  }

  if (batches.length === 0) {
    return <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '10px 14px' }}>{lang === 'fr' ? 'Aucun lot actif pour ce produit.' : 'No active batch for this product.'}</p>
  }

  // Same FEFO order dispensing actually uses — earliest expiry first —
  // so this view matches what "the system will use next" really means.
  const sorted = [...batches].sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())

  return (
    <div style={{ padding: '10px 14px', background: 'var(--color-bg)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}>
            <th style={{ padding: '4px 8px 4px 0', fontWeight: 500 }}>{lang === 'fr' ? 'Lot' : 'Batch'}</th>
            <th style={{ padding: '4px 8px', fontWeight: 500 }}>{lang === 'fr' ? 'Expiration' : 'Expiry'}</th>
            <th style={{ padding: '4px 0', fontWeight: 500, textAlign: 'right' }}>{lang === 'fr' ? 'En stock' : 'On hand'}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b, i) => {
            const expiryDate = new Date(b.expiry_date)
            const isExpiringSoon = expiryDate <= soonThreshold
            return (
              <tr key={b.batch_id} style={{ borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                <td style={{ padding: '6px 8px 6px 0', fontFamily: 'var(--font-mono)' }}>
                  {b.batch_number}
                  {i === 0 && (
                    <span style={{
                      marginLeft: '6px', fontSize: '9px', padding: '1px 6px', borderRadius: '999px',
                      background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', fontWeight: 700,
                    }}>
                      {lang === 'fr' ? 'PROCHAIN' : 'NEXT'}
                    </span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', color: isExpiringSoon ? 'var(--color-warning-text)' : 'var(--color-text-primary)', fontWeight: isExpiringSoon ? 600 : 400 }}>
                  {expiryDate.toLocaleDateString(locale)}
                  {isExpiringSoon && ' ⚠'}
                </td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                  {b.on_hand}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>
        {lang === 'fr'
          ? '« PROCHAIN » indique le lot que la dispensation utilisera en premier (le plus proche de la péremption).'
          : '"NEXT" marks the batch dispensing will use first (closest to expiry).'}
      </p>
    </div>
  )
}