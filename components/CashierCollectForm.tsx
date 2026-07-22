'use client'

// components/CashierCollectForm.tsx
//
// Collects payment for a patient who may have MULTIPLE invoices and/or
// uninvoiced charges pending at once. The entered amount is distributed
// across them in order (oldest charge first), capped at each invoice's
// own remaining balance — never submitting more to one invoice than it
// can accept. Fires one collectPayment call per invoice touched, plus one
// collectChargesDirectly call for any uninvoiced remainder.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { collectPayment, collectChargesDirectly } from '@/lib/actions/billing'
import { useLang } from '@/lib/i18n/LangContext'

interface ChargeRow {
  id: string
  invoice_id: string | null
  balance: number
}

export default function CashierCollectForm({
  invoiceIds, chargeIds = [], charges = [], balanceXaf, patientId,
}: {
  invoiceIds: string[]
  chargeIds?: string[]
  charges?: ChargeRow[]
  balanceXaf: number
  patientId: string
}) {
  const lang = useLang()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState(String(balanceXaf))
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)', fontSize: '13px',
    background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let remaining = parseFloat(amount)
    if (!remaining || remaining <= 0) {
      setError(lang === 'fr' ? 'Montant invalide.' : 'Invalid amount.')
      return
    }
    setError(null)
    setSubmitting(true)

    // Group charges by invoice_id (null = uninvoiced), oldest-first order
    // preserved from the server (charges array is already sorted by
    // created_at asc). Distribute the entered amount across groups in
    // order, capping each group at its own total balance.
    const byInvoice = new Map<string | null, ChargeRow[]>()
    for (const c of charges) {
      const key = c.invoice_id
      const list = byInvoice.get(key) ?? []
      list.push(c)
      byInvoice.set(key, list)
    }

    let firstPaymentId: string | null = null
    let lastError: string | null = null

    for (const [invoiceId, group] of byInvoice) {
      if (remaining <= 0) break
      const groupBalance = group.reduce((s, c) => s + c.balance, 0)
      if (groupBalance <= 0) continue
      const chunk = Math.min(remaining, groupBalance)
      remaining -= chunk

      const formData = new FormData()
      formData.set('amount_xaf', String(chunk))
      formData.set('payment_method', method)
      if (reference) formData.set('reference', reference)

      let result: any
      if (invoiceId) {
        result = await collectPayment(invoiceId, formData)
      } else {
        result = await collectChargesDirectly(group.map(c => c.id), formData, patientId)
      }

      if (result?.error) {
        lastError = result.error
        break
      }
      if (!firstPaymentId && result?.paymentId) firstPaymentId = result.paymentId
    }

    if (lastError) {
      setError(lastError)
      setSubmitting(false)
      return
    }

    if (firstPaymentId) {
      window.open(`/print/payments/${firstPaymentId}`, '_blank')
    }

    setOpen(false)
    setSubmitting(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        fontSize: '12px', color: 'var(--color-accent-text-on)',
        background: 'var(--color-accent)', padding: '6px 14px',
        borderRadius: 'var(--radius-sm)', border: 'none',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        {lang === 'fr' ? 'Encaisser' : 'Collect'}
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: '16px',
    }} onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div role="dialog" aria-modal="true" style={{
        background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
        padding: '24px', width: '360px', maxWidth: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
            {lang === 'fr' ? 'Encaisser le paiement' : 'Collect payment'}
          </p>
          <button onClick={() => setOpen(false)} style={{
            background: 'none', border: 'none', fontSize: '20px',
            cursor: 'pointer', color: 'var(--color-text-secondary)', lineHeight: 1, padding: '0 4px',
          }}>×</button>
        </div>

        <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)', margin: '0 0 4px', color: 'var(--color-accent)' }}>
          {balanceXaf.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
        </p>
        {new Set(charges.map(c => c.invoice_id ?? 'none')).size > 1 && (
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
            {lang === 'fr'
              ? 'Réparti automatiquement sur plusieurs factures.'
              : 'Automatically split across multiple invoices.'}
          </p>
        )}
        {new Set(charges.map(c => c.invoice_id ?? 'none')).size <= 1 && <div style={{ marginBottom: '16px' }} />}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
              {lang === 'fr' ? 'Montant encaissé (FCFA)' : 'Amount collected (FCFA)'}
            </label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              required min="1" max={balanceXaf} autoFocus style={{ ...inputStyle, width: '100%' }} />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
              {lang === 'fr' ? 'Mode de paiement' : 'Payment method'}
            </label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
              <option value="cash">{lang === 'fr' ? 'Espèces' : 'Cash'}</option>
              <option value="momo">MTN MoMo</option>
              <option value="orange_money">Orange Money</option>
              <option value="card">{lang === 'fr' ? 'Carte bancaire' : 'Bank card'}</option>
              <option value="transfer">{lang === 'fr' ? 'Virement' : 'Transfer'}</option>
            </select>
          </div>

          {method !== 'cash' && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                {lang === 'fr' ? 'Référence transaction' : 'Transaction reference'}
              </label>
              <input type="text" value={reference} onChange={e => setReference(e.target.value)}
                placeholder={lang === 'fr' ? 'ex. ID MoMo' : 'e.g. MoMo ID'}
                style={{ ...inputStyle, width: '100%' }} />
            </div>
          )}

          {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button type="submit" disabled={submitting} style={{
              flex: 1, padding: '11px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
              fontSize: '14px', fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
            }}>
              {submitting ? '…' : (lang === 'fr' ? '✓ Encaisser' : '✓ Collect')}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={{
              padding: '11px 16px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'none',
              color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}>
              {lang === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
