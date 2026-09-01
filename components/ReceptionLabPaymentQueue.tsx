'use client'

import { useMemo, useState } from 'react'
import { collectLabPayment, prepareSelectedLabPayment } from '@/lib/actions/labBilling'

type LabItem = {
  id: string
  status: string
  billing_status: string
  item_type: string
  price_xaf: number
  name: string
}
type LabVisit = {
  visitId: string
  patientName: string
  patientCode: string
  isEmergency: boolean
  items: LabItem[]
}

const money = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'

export default function ReceptionLabPaymentQueue({ rows, lang }: { rows: LabVisit[]; lang: 'fr' | 'en' }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectable = useMemo(() => rows.flatMap(r => r.items.filter(i => ['pending_payment', 'deferred'].includes(i.billing_status)).map(i => ({ ...i, visitId: r.visitId }))), [rows])
  const selectedItems = selectable.filter(i => selected[i.id])
  const total = selectedItems.reduce((sum, i) => sum + Number(i.price_xaf || 0), 0)

  async function prepare() {
    if (!selectedItems.length) return
    setBusy(true); setError(null)
    const result = await prepareSelectedLabPayment(selectedItems.map(i => i.id))
    if (result.error) setError(result.error)
    else { setInvoiceId(result.invoiceId); setPayAmount(String(total)) }
    setBusy(false)
  }

  async function pay() {
    const amount = Number(payAmount)
    if (!invoiceId || !Number.isFinite(amount) || amount <= 0) return setError(lang === 'fr' ? 'Montant invalide.' : 'Invalid amount.')
    setBusy(true); setError(null)
    const result = await collectLabPayment(invoiceId, amount, method, reference)
    if (result.error) setError(result.error)
    else { setInvoiceId(null); setSelected({}); setPayAmount(''); setReference(''); window.location.reload() }
    setBusy(false)
  }

  return (
    <section style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{lang === 'fr' ? 'Examens de laboratoire à encaisser' : 'Laboratory investigations to collect'}</h2>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '3px 0 0' }}>{lang === 'fr' ? 'Sélectionnez uniquement les examens que le patient peut payer maintenant.' : 'Select only the investigations the patient can pay for now.'}</p>
        </div>
        {selectedItems.length > 0 && <strong style={{ fontSize: 12 }}>{money(total)}</strong>}
      </div>

      {rows.length === 0 ? <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucun examen en attente de paiement.' : 'No laboratory investigations awaiting payment.'}</p> : rows.map(row => (
        <div key={row.visitId} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', marginBottom: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <strong style={{ fontSize: 13 }}>{row.patientName}</strong>
            {row.isEmergency && <span style={{ marginLeft: 7, fontSize: 10, color: 'var(--color-critical-text)' }}>{lang === 'fr' ? 'URGENCE' : 'EMERGENCY'}</span>}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>{row.patientCode}</div>
          </div>
          {row.items.map(item => {
            const canSelect = ['pending_payment', 'deferred'].includes(item.billing_status)
            return <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderBottom: '1px solid var(--color-border-subtle)', opacity: canSelect ? 1 : .55, cursor: canSelect ? 'pointer' : 'default' }}>
              <input type="checkbox" disabled={!canSelect} checked={!!selected[item.id]} onChange={e => setSelected(s => ({ ...s, [item.id]: e.target.checked }))} />
              <span style={{ flex: 1, fontSize: 12 }}>{item.name}</span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{money(Number(item.price_xaf))}</span>
              <span style={{ fontSize: 10, color: item.billing_status === 'deferred' ? 'var(--color-text-secondary)' : 'var(--color-warning-text)' }}>{item.billing_status === 'deferred' ? (lang === 'fr' ? 'Différé' : 'Deferred') : (lang === 'fr' ? 'À payer' : 'Awaiting payment')}</span>
            </label>
          })}
        </div>
      ))}

      {selectedItems.length > 0 && !invoiceId && <button type="button" disabled={busy} onClick={prepare} style={{ width: '100%', padding: '10px 14px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', fontWeight: 600, cursor: 'pointer' }}>{busy ? '…' : (lang === 'fr' ? `Pay selected — ${money(total)}` : `Pay selected — ${money(total)}`)}</button>}

      {invoiceId && <div style={{ border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', padding: 12, marginTop: 10, background: 'var(--color-surface)' }}>
        <strong style={{ fontSize: 13 }}>{lang === 'fr' ? 'Encaisser les examens sélectionnés' : 'Collect selected investigations'}</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 9 }}>
          <input value={payAmount} onChange={e => setPayAmount(e.target.value)} type="number" min="1" step="1" placeholder="Montant" style={{ padding: 8, border: '1px solid var(--color-border)', borderRadius: 5 }} />
          <select value={method} onChange={e => setMethod(e.target.value)} style={{ padding: 8, border: '1px solid var(--color-border)', borderRadius: 5 }}>
            <option value="cash">{lang === 'fr' ? 'Comptant' : 'Cash'}</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="card">{lang === 'fr' ? 'Carte' : 'Card'}</option>
          </select>
        </div>
        {method !== 'cash' && <input value={reference} onChange={e => setReference(e.target.value)} placeholder={lang === 'fr' ? 'Référence de transaction' : 'Transaction reference'} style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: 8, border: '1px solid var(--color-border)', borderRadius: 5 }} />}
        <button type="button" disabled={busy} onClick={pay} style={{ width: '100%', marginTop: 8, padding: 10, border: '1px solid var(--color-border)', borderRadius: 5, background: 'var(--color-surface)', fontWeight: 600, cursor: 'pointer' }}>{busy ? '…' : (lang === 'fr' ? 'Encaisser' : 'Collect payment')}</button>
      </div>}
      {error && <p style={{ color: 'var(--color-critical-text)', fontSize: 12, marginTop: 8 }}>{error}</p>}
    </section>
  )
}
