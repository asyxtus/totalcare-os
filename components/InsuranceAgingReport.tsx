'use client'

// components/InsuranceAgingReport.tsx
//
// Shows who owes the clinic money on insurance, how much, and how old it is.
// Two categories per insurer:
//   • Claimed   — submitted to the insurer, awaiting their payment
//   • Unclaimed — insured charges never submitted (the invisible leak)
// Age buckets: 0-30 / 31-60 / 61-90 / 90+ days.

import { useState, Fragment } from 'react'
import { useLang } from '@/lib/i18n/LangContext'

interface AgingRow {
  insurer_id: string
  insurer_name: string
  claimed_xaf: number
  unclaimed_xaf: number
  total_owed_xaf: number
  bucket_0_30: number
  bucket_31_60: number
  bucket_61_90: number
  bucket_90_plus: number
  oldest_days: number
}

interface DetailRow {
  service_charge_id: string
  patient_name: string
  patient_code: string
  description: string
  category: string
  insurer_owes_xaf: number
  kind: string
  claim_number: string | null
  claim_status: string | null
  age_days: number
  charge_date: string
}

export default function InsuranceAgingReport({
  rows,
  detailByInsurer,
}: {
  rows: AgingRow[]
  detailByInsurer: Record<string, DetailRow[]>
}) {
  const lang = useLang()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const [expanded, setExpanded] = useState<string | null>(null)

  const fmt = (n: number) => Number(n).toLocaleString(locale)

  const grandTotal = rows.reduce((s, r) => s + Number(r.total_owed_xaf), 0)
  const grandClaimed = rows.reduce((s, r) => s + Number(r.claimed_xaf), 0)
  const grandUnclaimed = rows.reduce((s, r) => s + Number(r.unclaimed_xaf), 0)

  if (rows.length === 0) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--color-success-text)' }}>
        {lang === 'fr' ? '✓ Aucune créance assureur en cours.' : '✓ No outstanding insurer receivables.'}
      </p>
    )
  }

  const th: React.CSSProperties = { textAlign: 'right', padding: '8px 10px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }
  const thLeft: React.CSSProperties = { ...th, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '10px', fontSize: '13px', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }
  const tdLeft: React.CSSProperties = { ...td, textAlign: 'left', fontFamily: 'inherit' }

  return (
    <div>
      {/* Summary banner */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', background: 'var(--color-surface)' }}>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            {lang === 'fr' ? 'Total dû par assureurs' : 'Total owed by insurers'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmt(grandTotal)} FCFA</p>
        </div>
        <div style={{ flex: 1, minWidth: '160px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', background: 'var(--color-surface)' }}>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            {lang === 'fr' ? 'Réclamé (soumis)' : 'Claimed (submitted)'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>{fmt(grandClaimed)} FCFA</p>
        </div>
        <div style={{ flex: 1, minWidth: '160px', border: '1px solid var(--color-warning-text)', borderRadius: 'var(--radius-md)', padding: '12px 16px', background: 'var(--color-warning-bg)' }}>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-warning-text)', textTransform: 'uppercase' }}>
            ⚠ {lang === 'fr' ? 'Non réclamé' : 'Unclaimed'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-warning-text)' }}>{fmt(grandUnclaimed)} FCFA</p>
        </div>
      </div>

      {grandUnclaimed > 0 && (
        <p style={{ fontSize: '12px', color: 'var(--color-warning-text)', margin: '0 0 16px', padding: '8px 12px', background: 'var(--color-warning-bg)', borderRadius: 'var(--radius-sm)' }}>
          ⚠ {lang === 'fr'
            ? `${fmt(grandUnclaimed)} FCFA de frais assurés n'ont jamais été soumis à un assureur. Créez une réclamation pour récupérer cet argent.`
            : `${fmt(grandUnclaimed)} FCFA of insured charges were never submitted to any insurer. Create a claim to recover this money.`}
        </p>
      )}

      {/* Per-insurer table */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
              <th style={thLeft}>{lang === 'fr' ? 'Assureur' : 'Insurer'}</th>
              <th style={th}>0–30j</th>
              <th style={th}>31–60j</th>
              <th style={th}>61–90j</th>
              <th style={{ ...th, color: 'var(--color-critical-text)' }}>90+j</th>
              <th style={th}>{lang === 'fr' ? 'Total' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = expanded === r.insurer_id
              const details = detailByInsurer[r.insurer_id] ?? []
              return (
                <Fragment key={r.insurer_id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : r.insurer_id)}
                    style={{ borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer', background: isOpen ? 'var(--color-surface)' : 'transparent' }}
                  >
                    <td style={tdLeft}>
                      <span style={{ marginRight: '6px', color: 'var(--color-text-secondary)' }}>{isOpen ? '▾' : '▸'}</span>
                      <span style={{ fontWeight: 500 }}>🛡 {r.insurer_name}</span>
                      {Number(r.unclaimed_xaf) > 0 && (
                        <span style={{ marginLeft: '8px', fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>
                          {fmt(Number(r.unclaimed_xaf))} {lang === 'fr' ? 'non réclamé' : 'unclaimed'}
                        </span>
                      )}
                    </td>
                    <td style={td}>{Number(r.bucket_0_30) > 0 ? `${fmt(Number(r.bucket_0_30))}` : '—'}</td>
                    <td style={td}>{Number(r.bucket_31_60) > 0 ? `${fmt(Number(r.bucket_31_60))}` : '—'}</td>
                    <td style={{ ...td, color: Number(r.bucket_61_90) > 0 ? 'var(--color-warning-text)' : 'inherit' }}>{Number(r.bucket_61_90) > 0 ? `${fmt(Number(r.bucket_61_90))}` : '—'}</td>
                    <td style={{ ...td, color: Number(r.bucket_90_plus) > 0 ? 'var(--color-critical-text)' : 'inherit', fontWeight: Number(r.bucket_90_plus) > 0 ? 700 : 400 }}>{Number(r.bucket_90_plus) > 0 ? `${fmt(Number(r.bucket_90_plus))}` : '—'}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{fmt(Number(r.total_owed_xaf))} FCFA</td>
                  </tr>
                  {isOpen && (
                    <tr key={`${r.insurer_id}-detail`}>
                      <td colSpan={6} style={{ padding: '0 10px 10px', background: 'var(--color-surface)' }}>
                        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                <th style={{ textAlign: 'left', padding: '6px 10px' }}>{lang === 'fr' ? 'Patient' : 'Patient'}</th>
                                <th style={{ textAlign: 'left', padding: '6px 10px' }}>{lang === 'fr' ? 'Prestation' : 'Service'}</th>
                                <th style={{ textAlign: 'left', padding: '6px 10px' }}>{lang === 'fr' ? 'Statut' : 'Status'}</th>
                                <th style={{ textAlign: 'right', padding: '6px 10px' }}>{lang === 'fr' ? 'Âge' : 'Age'}</th>
                                <th style={{ textAlign: 'right', padding: '6px 10px' }}>{lang === 'fr' ? 'Montant' : 'Amount'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {details.map((d) => (
                                <tr key={d.service_charge_id} style={{ fontSize: '12px', borderTop: '1px solid var(--color-border-subtle)' }}>
                                  <td style={{ padding: '6px 10px' }}>
                                    {d.patient_name}
                                    <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '10px', marginLeft: '4px' }}>{d.patient_code}</span>
                                  </td>
                                  <td style={{ padding: '6px 10px' }}>{d.description}</td>
                                  <td style={{ padding: '6px 10px' }}>
                                    {d.kind === 'unclaimed' ? (
                                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>
                                        ⚠ {lang === 'fr' ? 'Non réclamé' : 'Unclaimed'}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                                        {d.claim_number ?? (lang === 'fr' ? 'Réclamé' : 'Claimed')}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: d.age_days > 90 ? 'var(--color-critical-text)' : d.age_days > 60 ? 'var(--color-warning-text)' : 'inherit' }}>
                                    {d.age_days}j
                                  </td>
                                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{fmt(Number(d.insurer_owes_xaf))} FCFA</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
