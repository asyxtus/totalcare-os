'use client'

// components/PatientAccountTab.tsx

import { useState } from 'react'
import { useLang } from '@/lib/i18n/LangContext'
import { searchPatientsForAccount, getPatientAccountData } from '@/lib/actions/patientAccount'
import CollectPaymentForm from '@/components/CollectPaymentForm'
import ReversePaymentButton from '@/components/ReversePaymentButton'
import RequestDiscountButton from '@/components/RequestDiscountButton'
import DepositForm from '@/components/DepositForm'
import ApplyDepositButton from '@/components/ApplyDepositButton'
import AddChargeForm from '@/components/AddChargeForm'
import PatientInsuranceSection from '@/components/PatientInsuranceSection'

interface SearchResult { id: string; full_name: string; patient_code: string }

export default function PatientAccountTab() {
  const lang = useLang()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [account, setAccount] = useState<any>(null)
  const [loadingAccount, setLoadingAccount] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '14px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', width: '100%', boxSizing: 'border-box',
  }

  async function handleSearch(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const found = await searchPatientsForAccount(value)
    setResults(found)
    setSearching(false)
  }

  async function selectPatient(patientId: string) {
    setResults([])
    setQuery('')
    setError(null)
    setLoadingAccount(true)
    const data = await getPatientAccountData(patientId)
    if ('error' in data) {
      setError(data.error as string)
      setAccount(null)
    } else {
      setAccount(data)
    }
    setLoadingAccount(false)
  }

  async function refreshAccount() {
    if (!account?.patient?.id) return
    const data = await getPatientAccountData(account.patient.id)
    if (!('error' in data)) setAccount(data)
  }

  const ledgerEntries = account ? [
    ...account.invoices.flatMap((inv: any) =>
      (inv.invoice_items ?? []).map((item: any) => ({
        date: inv.created_at,
        type: 'charge' as const,
        description: item.service_charges?.description ?? '—',
        amount: Number(item.amount_xaf),
      }))
    ),
    ...account.payments
      .filter((p: any) => p.status === 'completed')
      .map((p: any) => ({
        date: p.created_at,
        type: 'payment' as const,
        description: (p.payment_splits ?? []).map((s: any) => s.method).join(', ') || 'Paiement',
        amount: Number(p.total_amount_xaf),
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : []

  return (
    <div>
      <div style={{ position: 'relative', maxWidth: '400px', marginBottom: '1.25rem' }}>
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={lang==="fr"?"Rechercher un patient par nom ou code…":"Search patient by name or code…"}
          style={inputStyle}
        />
        {results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 10,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
            maxHeight: '220px', overflowY: 'auto',
          }}>
            {results.map((p) => (
              <button key={p.id} onClick={() => selectPatient(p.id)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
                background: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-primary)',
              }}>
                {p.full_name} <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>({p.patient_code})</span>
              </button>
            ))}
          </div>
        )}
        {searching && <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>{lang==='fr'?'Recherche…':'Searching…'}</p>}
      </div>

      {loadingAccount && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Chargement du compte…':'Loading account…'}</p>}
      {error && <p style={{ fontSize: '13px', color: 'var(--color-critical-text)' }}>{error}</p>}

      {account && !loadingAccount && (
        <div>
          <p style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 4px' }}>{account.patient.full_name}</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 1rem' }}>
            {account.patient.patient_code}{account.patient.phone ? ` · ${account.patient.phone}` : ''}
          </p>

          <PatientInsuranceSection
            patientId={account.patient.id}
            activeInsurance={account.activeInsurance}
            allInsurers={account.allInsurers}
            onSuccess={refreshAccount}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
            <AddChargeForm patientId={account.patient.id} onSuccess={refreshAccount} />
            <DepositForm patientId={account.patient.id} onSuccess={refreshAccount} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '1.25rem' }}>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.9rem' }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>{lang==='fr'?'Facturé':'Billed'}</p>
              <p style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{account.totals.charged.toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA</p>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.9rem' }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>{lang==='fr'?'Payé':'Paid'}</p>
              <p style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--color-success-text)' }}>{account.totals.paid.toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA</p>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.9rem' }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>{lang==='fr'?'Solde de dépôt':'Deposit balance'}</p>
              <p style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: account.depositBalance > 0 ? 'var(--color-success-text)' : 'var(--color-text-primary)' }}>
                {account.depositBalance.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
              </p>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.9rem' }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>{lang==='fr'?'Solde':'Balance'}</p>
              <p style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: account.totals.balance > 0 ? 'var(--color-critical-text)' : 'var(--color-success-text)' }}>
                {account.totals.balance.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
              </p>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{lang==='fr'?'Grand livre':'Ledger'}</p>
          {ledgerEntries.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>{lang==='fr'?'Aucune transaction.':'No transactions.'}</p>
          ) : (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '10px', padding: '8px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', minWidth: '420px' }}>
                <span>Date</span><span>Description</span><span style={{ textAlign: 'right' }}>{lang==='fr'?'Débit':'Debit'}</span><span style={{ textAlign: 'right' }}>Crédit</span>
              </div>
              {ledgerEntries.map((entry, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '10px', padding: '8px 14px', fontSize: '13px',
                  borderBottom: i < ledgerEntries.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{new Date(entry.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</span>
                  <span>
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: entry.type === 'charge' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)', color: entry.type === 'charge' ? 'var(--color-warning-text)' : 'var(--color-success-text)', marginRight: '6px' }}>
                      {entry.type === 'charge' ? 'charge' : 'paiement'}
                    </span>
                    {entry.description}
                  </span>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-critical-text)' }}>
                    {entry.type === 'charge' ? entry.amount.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') : ''}
                  </span>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-success-text)' }}>
                    {entry.type === 'payment' ? entry.amount.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>Factures</p>
          {account.invoices.map((inv: any) => {
            const invoicePayments = account.payments.filter((p: any) => p.invoice_id === inv.id)
            const invoicePaid = invoicePayments.filter((p: any) => p.status === 'completed').reduce((s: number, p: any) => s + Number(p.total_amount_xaf), 0)
            // Patient-owed total for this invoice — per item, using
            // patient_portion_xaf when insurance applies. This directly
            // feeds CollectPaymentForm's amount below, so getting this
            // wrong would mean asking the patient for the insurer's
            // share too.
            const invoicePatientOwed = (inv.invoice_items ?? []).reduce((sum: number, item: any) => {
              const portion = item.service_charges?.patient_portion_xaf
              return sum + Number(portion != null ? portion : item.amount_xaf)
            }, 0)
            const invoiceBalance = invoicePatientOwed - invoicePaid
            return (
              <div key={inv.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{inv.invoice_number ?? inv.id.slice(0, 8)} · {new Date(inv.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</p>
                    {(inv.invoice_items ?? []).map((item: any) => (
                      <div key={item.id} style={{ marginTop: '2px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {item.service_charges?.description} — {Number(item.amount_xaf).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
                          {item.service_charges?.patient_portion_xaf != null && (
                            <span style={{ color: 'var(--color-success-text)' }}>
                              {' '}(Assurance : {Number(item.service_charges.insurer_portion_xaf).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} · Patient : {Number(item.service_charges.patient_portion_xaf).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')})
                            </span>
                          )}
                        </span>
                        {invoiceBalance > 0 && item.service_charge_id && (
                          <span style={{ marginLeft: '8px' }}><RequestDiscountButton serviceChargeId={item.service_charge_id} onSuccess={refreshAccount} /></span>
                        )}
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: '12px', color: invoiceBalance > 0 ? 'var(--color-critical-text)' : 'var(--color-success-text)' }}>
                    {invoiceBalance > 0 ? `${lang==='fr'?'Solde':'Balance'} ${invoiceBalance.toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA` : lang==='fr'?'Payée':'Paid'}
                  </span>
                </div>
                {invoiceBalance > 0 && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <CollectPaymentForm invoiceId={inv.id} balance={invoiceBalance} onSuccess={refreshAccount} />
                    {account.depositBalance > 0 && (
                      <ApplyDepositButton
                        patientId={account.patient.id}
                        invoiceId={inv.id}
                        maxAmount={Math.min(invoiceBalance, account.depositBalance)}
                        onSuccess={refreshAccount}
                      />
                    )}
                  </div>
                )}
                {invoicePayments.length > 0 && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)' }}>
                    {invoicePayments.map((p: any) => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' }}>
                        <span style={{ textDecoration: p.status === 'reversed' ? 'line-through' : 'none', color: p.status === 'reversed' ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>
                          {new Date(p.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')} · {Number(p.total_amount_xaf).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
                        </span>
                        {p.status === 'completed' && <ReversePaymentButton paymentId={p.id} onSuccess={refreshAccount} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
