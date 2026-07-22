'use client'

// components/InsuranceTab.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createInsurerAction, createClaimAction, submitClaimAction, updateClaimStatusAction, recordClaimPaymentAction } from '@/lib/actions/insurance'
import { useLang } from '@/lib/i18n/LangContext'

interface Insurer { id: string; name: string; payer_type: string; coverage_percentage: number }
interface Claim {
  id: string
  claim_number: string
  status: string
  total_claimed_xaf: number
  total_approved_xaf: number | null
  submitted_at: string | null
  created_at: string
  insurer_name: string
}

const STATUS_LABELS: Record<string, { fr: string; en: string; bg: string; text: string }> = {
  draft:              { fr: 'Brouillon',               en: 'Draft',               bg: 'var(--color-bg)',          text: 'var(--color-text-secondary)' },
  submitted:          { fr: 'Soumise',                 en: 'Submitted',           bg: 'var(--color-warning-bg)',  text: 'var(--color-warning-text)' },
  under_review:       { fr: 'En révision',             en: 'Under review',        bg: 'var(--color-warning-bg)',  text: 'var(--color-warning-text)' },
  approved:           { fr: 'Approuvée',               en: 'Approved',            bg: 'var(--color-success-bg)',  text: 'var(--color-success-text)' },
  partially_approved: { fr: 'Partiellement approuvée', en: 'Partially approved',  bg: 'var(--color-warning-bg)',  text: 'var(--color-warning-text)' },
  denied:             { fr: 'Refusée',                 en: 'Denied',              bg: 'var(--color-critical-bg)', text: 'var(--color-critical-text)' },
  paid:               { fr: 'Payée',                   en: 'Paid',                bg: 'var(--color-success-bg)',  text: 'var(--color-success-text)' },
}

function InsurerForm({ onDone }: { onDone: () => void }) {
  const lang = useLang()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    const result = await createInsurerAction(formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      onDone()
      router.refresh()
    }
  }

  return (
    <form action={handleSubmit} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <input name="name" placeholder={lang==='fr'?'Nom de l\'assureur *':'Insurer name *'} required style={inputStyle} />
        <select name="payer_type" required style={inputStyle} defaultValue="">
          <option value="" disabled>{lang==='fr'?'Type *':'Type *'}</option>
          <option value="private_insurance">{lang==='fr'?'Assurance privée':'Private insurance'}</option>
          <option value="employer_scheme">{lang==='fr'?'Régime employeur':'Employer scheme'}</option>
          <option value="cnps">CNPS</option>
        </select>
        <input name="coverage_percentage" type="number" min="0" max="100" placeholder={lang==='fr'?'Couverture % *':'Coverage % *'} required style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <input name="contact_name" placeholder={lang==='fr'?'Contact':'Contact'} style={inputStyle} />
        <input name="phone" placeholder={lang==='fr'?'Téléphone':'Phone'} style={inputStyle} />
        <input name="email" type="email" placeholder="Email" style={inputStyle} />
        <input name="address" placeholder={lang==='fr'?'Adresse':'Address'} style={inputStyle} />
      </div>
      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '0 0 8px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={submitting} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
          {submitting ? '…' : (lang==='fr'?'Créer l\'assureur':'Create insurer')}
        </button>
        <button type="button" onClick={onDone} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
          {lang==='fr'?'Annuler':'Cancel'}
        </button>
      </div>
    </form>
  )
}

function ClaimRow({ claim }: { claim: Claim }) {
  const lang = useLang()
  const router = useRouter()
  const [mode, setMode] = useState<'none' | 'status' | 'payment'>('none')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const status = STATUS_LABELS[claim.status] ?? STATUS_LABELS.draft

  async function handleSubmit(action: string, formData: FormData) {
    setError(null)
    setSubmitting(true)
    let result
    if (action === 'submit') result = await submitClaimAction(claim.id)
    else if (action === 'status') result = await updateClaimStatusAction(claim.id, formData)
    else result = await recordClaimPaymentAction(claim.id, formData)

    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      setMode('none')
      router.refresh()
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '12px', background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  }

  return (
    <div style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1fr 1.5fr', gap: '10px', padding: '10px 14px', alignItems: 'center', fontSize: '13px', minWidth: '620px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{claim.claim_number}</span>
        <span>{claim.insurer_name}</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{Number(claim.total_claimed_xaf).toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{claim.total_approved_xaf != null ? `${Number(claim.total_approved_xaf).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA` : '—'}</span>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: status.bg, color: status.text, textAlign: 'center' }}>{status[lang] ?? status.fr}</span>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          {claim.status === 'draft' && (
            <button onClick={() => handleSubmit('submit', new FormData())} disabled={submitting} style={{ fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
              {lang === 'fr' ? 'Soumettre' : 'Submit'}
            </button>
          )}
          <a href={`/print/claim/${claim.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
            🖨
          </a>
          {['submitted', 'under_review'].includes(claim.status) && (
            <button onClick={() => setMode(mode === 'status' ? 'none' : 'status')} style={{ fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              Statut
            </button>
          )}
          {['approved', 'partially_approved'].includes(claim.status) && (
            <button onClick={() => setMode(mode === 'payment' ? 'none' : 'payment')} style={{ fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
              Encaisser
            </button>
          )}
        </div>
      </div>

      {mode === 'status' && (
        <form action={(fd) => handleSubmit('status', fd)} style={{ display: 'flex', gap: '8px', padding: '0 14px 10px', flexWrap: 'wrap' }}>
          <select name="status" style={inputStyle}>
            <option value="under_review">{lang === 'fr' ? 'En révision' : 'Under review'}</option>
            <option value="approved">{lang === 'fr' ? 'Approuvée' : 'Approved'}</option>
            <option value="partially_approved">{lang === 'fr' ? 'Partiellement approuvée' : 'Partially approved'}</option>
            <option value="denied">{lang === 'fr' ? 'Refusée' : 'Denied'}</option>
          </select>
          <input name="total_approved_xaf" type="number" step="any" placeholder={lang === 'fr' ? 'Montant approuvé (FCFA)' : 'Approved amount (FCFA)'} style={{ ...inputStyle, width: '160px' }} />
          <input name="notes" placeholder={lang === 'fr' ? 'Notes' : 'Notes'} style={{ ...inputStyle, flex: 1, minWidth: '140px' }} />
          <button type="submit" disabled={submitting} style={{ fontSize: '11px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
            {submitting ? '…' : (lang==='fr'?'Mettre à jour':'Update')}
          </button>
        </form>
      )}
      {mode === 'payment' && (
        <form action={(fd) => handleSubmit('payment', fd)} style={{ display: 'flex', gap: '8px', padding: '0 14px 10px' }}>
          <input name="amount_received_xaf" type="number" step="any" defaultValue={claim.total_approved_xaf ?? claim.total_claimed_xaf} placeholder={lang==='fr'?'Montant reçu (FCFA)':'Amount received (FCFA)'} required style={{ ...inputStyle, width: '160px' }} />
          <button type="submit" disabled={submitting} style={{ fontSize: '11px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer' }}>
            {submitting ? '…' : (lang==='fr'?'Confirmer la réception':'Confirm receipt')}
          </button>
        </form>
      )}
      {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', padding: '0 14px 10px', margin: 0 }}>{error}</p>}
    </div>
  )
}

export default function InsuranceTab({ insurers, claims, outstandingInsurers }: {
  insurers: Insurer[];
  claims: Claim[];
  outstandingInsurers?: { insurer_id: string; name: string; total: number }[]
}) {
  const lang = useLang()
  const router = useRouter()
  const [showInsurerForm, setShowInsurerForm] = useState(false)
  const [creatingClaimFor, setCreatingClaimFor] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)

  async function handleCreateClaim(insurerId: string) {
    setCreatingClaimFor(insurerId)
    setClaimError(null)
    const result = await createClaimAction(insurerId)
    if (result && 'error' in result && result.error) {
      setClaimError(result.error)
    } else {
      router.refresh()
    }
    setCreatingClaimFor(null)
  }

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const totalOutstanding = (outstandingInsurers ?? []).reduce((s, r) => s + r.total, 0)

  return (
    <div>
      {/* Outstanding amounts banner — the most important thing on this screen */}
      {totalOutstanding > 0 && (
        <div style={{
          background: 'color-mix(in srgb, var(--color-warning-bg) 60%, transparent)',
          border: '1px solid var(--color-warning-text)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '1.25rem',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-warning-text)', margin: '0 0 8px' }}>
            {lang === 'fr'
              ? `${totalOutstanding.toLocaleString(locale)} FCFA en attente de réclamation`
              : `${totalOutstanding.toLocaleString(locale)} FCFA pending claims`}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(outstandingInsurers ?? []).filter(o => o.total > 0).map(o => {
              const hasDraft = claims.some(c => c.insurer_name === o.name && c.status === 'draft')
              return (
                <div key={o.insurer_id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: '12px',
                }}>
                  <span>
                    <strong>{o.name}</strong>
                    {' · '}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{o.total.toLocaleString(locale)} FCFA</span>
                  </span>
                  {!hasDraft && (
                    <button
                      onClick={() => handleCreateClaim(o.insurer_id)}
                      disabled={creatingClaimFor === o.insurer_id}
                      style={{
                        fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                        border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
                        cursor: 'pointer',
                      }}
                    >
                      {creatingClaimFor === o.insurer_id ? '…' : (lang === 'fr' ? '+ Créer réclamation' : '+ Create claim')}
                    </button>
                  )}
                  {hasDraft && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {lang === 'fr' ? 'Brouillon existant ↓' : 'Draft exists ↓'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--color-warning-text)', margin: '8px 0 0' }}>
            {lang === 'fr'
              ? 'Ces montants sont dus par les assureurs — ils ne figurent pas dans la caisse. Créez une réclamation, soumettez-la à l\'assureur, puis enregistrez le paiement quand vous le recevez.'
              : 'These amounts are owed by insurers — they are not in the cashier. Create a claim, submit it to the insurer, then record payment when received.'}
          </p>
        </div>
      )}

      {claimError && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '1rem' }}>{claimError}</p>}

      {/* Insurers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
          {lang === 'fr' ? 'Assureurs' : 'Insurers'}
        </p>
        <button onClick={() => setShowInsurerForm((s) => !s)} style={{
          fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
        }}>
          {showInsurerForm ? (lang === 'fr' ? 'Annuler' : 'Cancel') : (lang === 'fr' ? '+ Nouvel assureur' : '+ New insurer')}
        </button>
      </div>

      {showInsurerForm && <InsurerForm onDone={() => setShowInsurerForm(false)} />}

      {insurers.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          {lang === 'fr' ? 'Aucun assureur enregistré.' : 'No insurers registered.'}
        </p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          {insurers.map((ins, i) => {
            const outstanding = (outstandingInsurers ?? []).find(o => o.insurer_id === ins.id)
            return (
              <div key={ins.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', fontSize: '13px',
                borderBottom: i < insurers.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <div>
                  <span>{ins.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    {lang === 'fr' ? `${ins.coverage_percentage}% couvert` : `${ins.coverage_percentage}% coverage`}
                  </span>
                  {outstanding && outstanding.total > 0 && (
                    <span style={{ fontSize: '11px', marginLeft: '10px', color: 'var(--color-warning-text)', fontWeight: 500 }}>
                      {outstanding.total.toLocaleString(locale)} FCFA {lang === 'fr' ? 'à réclamer' : 'to claim'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleCreateClaim(ins.id)}
                  disabled={creatingClaimFor === ins.id}
                  style={{ fontSize: '11px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-accent)', cursor: 'pointer' }}
                >
                  {creatingClaimFor === ins.id ? '…' : (lang === 'fr' ? 'Nouvelle réclamation' : 'New claim')}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Claims */}
      <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>
        {lang === 'fr' ? 'Réclamations' : 'Claims'}
      </p>
      {claims.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {lang === 'fr' ? 'Aucune réclamation créée.' : 'No claims created yet.'}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            {lang === 'fr'
              ? 'Cliquez « Nouvelle réclamation » ci-dessus pour regrouper les frais d\'un assureur en une réclamation envoyable.'
              : 'Click "New claim" above to bundle an insurer\'s charges into a sendable claim.'}
          </p>
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1fr 1.5fr', gap: '10px', padding: '10px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', minWidth: '620px' }}>
            <span>{lang === 'fr' ? 'N° réclamation' : 'Claim no.'}</span>
            <span>{lang === 'fr' ? 'Assureur' : 'Insurer'}</span>
            <span>{lang === 'fr' ? 'Réclamé' : 'Claimed'}</span>
            <span>{lang === 'fr' ? 'Approuvé' : 'Approved'}</span>
            <span>Statut</span>
            <span></span>
          </div>
          {claims.map((c) => <ClaimRow key={c.id} claim={c} />)}
        </div>
      )}
    </div>
  )
}
