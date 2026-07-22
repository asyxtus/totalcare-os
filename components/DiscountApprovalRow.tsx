'use client'

// components/DiscountApprovalRow.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveDiscountAction, rejectDiscountAction } from '@/lib/actions/billing'
import { useLang } from '@/lib/i18n/LangContext'

interface Discount {
  id: string
  discount_amount_xaf: number
  reason: string
  created_at: string
  requester_name: string
  charge_description: string
}

export default function DiscountApprovalRow({ discount }: { discount: Discount }) {
  const lang = useLang()
  const router = useRouter()
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleApprove() {
    setSubmitting(true)
    setError(null)
    const result = await approveDiscountAction(discount.id)
    if (result?.error) { setError(result.error); setSubmitting(false) }
    else router.refresh()
  }

  async function handleReject() {
    setSubmitting(true)
    setError(null)
    const result = await rejectDiscountAction(discount.id, rejectReason)
    if (result?.error) { setError(result.error); setSubmitting(false) }
    else router.refresh()
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <p style={{ fontSize: '13px', margin: 0 }}>{discount.charge_description}</p>
        <p style={{ fontSize: '15px', fontWeight: 600, margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--color-warning-text)' }}>
          −{Number(discount.discount_amount_xaf).toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA
        </p>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
        {lang==='fr'?'Demandé par':'Requested by'} {discount.requester_name} {lang==='fr'?'le':''} {new Date(discount.created_at).toLocaleDateString(lang==='fr'?'fr-FR':'en-US')} — « {discount.reason} »
      </p>

      {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{error}</p>}

      {!showReject ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleApprove} disabled={submitting} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
            Approuver
          </button>
          <button onClick={() => setShowReject(true)} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-critical-text)', cursor: 'pointer' }}>
            Rejeter
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={lang==="fr"?"Motif du rejet (obligatoire)":"Rejection reason (required)"}
            style={{ fontSize: '12px', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', flex: 1 }}
          />
          <button onClick={handleReject} disabled={submitting || !rejectReason.trim()} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-critical-text)', color: 'white', cursor: 'pointer' }}>
            {lang === 'fr' ? 'Confirmer' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  )
}
