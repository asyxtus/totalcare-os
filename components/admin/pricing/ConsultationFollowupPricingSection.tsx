'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  createConsultationFollowupPolicy,
  updateConsultationFollowupPolicy,
  toggleConsultationFollowupPolicy,
} from '@/lib/actions/consultationFollowupPricingAdmin'

interface Policy {
  id: string
  name: string
  min_days_after_consultation: number
  max_days_after_consultation: number
  patient_fee_xaf: number
  is_active: boolean
}

export default function ConsultationFollowupPricingSection({ lang }: { lang: 'fr' | 'en' }) {
  const [rows, setRows] = useState<Policy[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [minDays, setMinDays] = useState('0')
  const [maxDays, setMaxDays] = useState('30')
  const [patientFee, setPatientFee] = useState('0')

  const load = async () => {
    const db = createClient()
    const { data, error: loadError } = await db.rpc('get_consultation_followup_policies')
    if (loadError) setError(loadError.message)
    else setRows((data ?? []) as Policy[])
  }

  useEffect(() => { load() }, [])

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await createConsultationFollowupPolicy(formData)
      if ('error' in result && result.error) setError(result.error)
      else {
        setName(''); setMinDays('0'); setMaxDays('30'); setPatientFee('0')
        await load()
      }
    })
  }

  const update = (row: Policy) => {
    const form = new FormData()
    form.set('min_days_after_consultation', String(row.min_days_after_consultation))
    form.set('max_days_after_consultation', String(row.max_days_after_consultation))
    form.set('patient_fee_xaf', String(row.patient_fee_xaf))
    setError(null)
    startTransition(async () => {
      const result = await updateConsultationFollowupPolicy(row.id, form)
      if ('error' in result && result.error) setError(result.error)
      else await load()
    })
  }

  const fr = lang === 'fr'

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{fr ? 'Suivi — tarifs de consultation' : 'Follow-up consultation pricing'}</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {fr
            ? 'Ces règles déterminent automatiquement le montant dû lorsqu’un médecin crée un suivi depuis une consultation terminée. La réception et la caisse ne peuvent pas choisir la remise.'
            : 'These rules automatically determine what the patient owes when a doctor creates a follow-up from a completed consultation. Reception and cashier cannot choose the discount.'}
        </p>
      </div>

      {error && <div role="alert" style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', fontSize: 12 }}>{error}</div>}

      <form onSubmit={submit} className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .7fr .7fr .9fr auto', gap: 8, alignItems: 'end' }}>
          <label style={{ fontSize: 11 }}>{fr ? 'Nom' : 'Name'}<input name="name" required value={name} onChange={e => setName(e.target.value)} placeholder={fr ? 'Suivi ≤ 30 jours' : 'Follow-up ≤ 30 days'} style={{ width: '100%', marginTop: 4, padding: 8 }} /></label>
          <label style={{ fontSize: 11 }}>{fr ? 'Min. jours' : 'Min days'}<input name="min_days_after_consultation" type="number" min="0" required value={minDays} onChange={e => setMinDays(e.target.value)} style={{ width: '100%', marginTop: 4, padding: 8 }} /></label>
          <label style={{ fontSize: 11 }}>{fr ? 'Max. jours' : 'Max days'}<input name="max_days_after_consultation" type="number" min="0" required value={maxDays} onChange={e => setMaxDays(e.target.value)} style={{ width: '100%', marginTop: 4, padding: 8 }} /></label>
          <label style={{ fontSize: 11 }}>{fr ? 'Patient paie' : 'Patient pays'}<input name="patient_fee_xaf" type="number" min="0" step="100" required value={patientFee} onChange={e => setPatientFee(e.target.value)} style={{ width: '100%', marginTop: 4, padding: 8 }} /></label>
          <button disabled={busy} type="submit" style={{ padding: '8px 12px', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', border: 0, borderRadius: 'var(--radius-sm)' }}>{fr ? 'Ajouter' : 'Add'}</button>
        </div>
      </form>

      <div style={{ display: 'grid', gap: 8 }}>
        {rows.length === 0 && <div className="card" style={{ padding: 14, fontSize: 12, color: 'var(--color-text-secondary)' }}>{fr ? 'Aucune règle configurée. Les suivis seront facturés au tarif normal.' : 'No policy configured. Follow-ups will use the normal consultation fee.'}</div>}
        {rows.map(row => (
          <PolicyRow key={row.id} row={row} fr={fr} busy={busy} onUpdate={update} onToggle={(active) => startTransition(async () => { const result = await toggleConsultationFollowupPolicy(row.id, active); if ('error' in result && result.error) setError(result.error); else await load() })} />
        ))}
      </div>
    </div>
  )
}

function PolicyRow({ row, fr, busy, onUpdate, onToggle }: { row: Policy; fr: boolean; busy: boolean; onUpdate: (row: Policy) => void; onToggle: (active: boolean) => void }) {
  const [min, setMin] = useState(String(row.min_days_after_consultation))
  const [max, setMax] = useState(String(row.max_days_after_consultation))
  const [fee, setFee] = useState(String(row.patient_fee_xaf))

  const changed = Number(min) !== row.min_days_after_consultation || Number(max) !== row.max_days_after_consultation || Number(fee) !== row.patient_fee_xaf
  const draft = { ...row, min_days_after_consultation: Number(min), max_days_after_consultation: Number(max), patient_fee_xaf: Number(fee) }

  return (
    <div className="card" style={{ padding: 12, opacity: row.is_active ? 1 : .6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .7fr .7fr .9fr auto auto', gap: 8, alignItems: 'end' }}>
        <div><strong style={{ fontSize: 12 }}>{row.name}</strong><div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>{fr ? 'Le médecin choisit seulement la date; la règle choisit le prix.' : 'Doctor chooses the date; the policy chooses the price.'}</div></div>
        <label style={{ fontSize: 10 }}>{fr ? 'Min' : 'Min'}<input type="number" min="0" value={min} onChange={e => setMin(e.target.value)} style={{ width: '100%', padding: 6, marginTop: 3 }} /></label>
        <label style={{ fontSize: 10 }}>{fr ? 'Max' : 'Max'}<input type="number" min="0" value={max} onChange={e => setMax(e.target.value)} style={{ width: '100%', padding: 6, marginTop: 3 }} /></label>
        <label style={{ fontSize: 10 }}>{fr ? 'Patient' : 'Patient'}<input type="number" min="0" step="100" value={fee} onChange={e => setFee(e.target.value)} style={{ width: '100%', padding: 6, marginTop: 3 }} /></label>
        <button disabled={busy || !changed} onClick={() => onUpdate(draft)} style={{ padding: '7px 10px', border: '1px solid var(--color-border)', background: 'transparent', borderRadius: 'var(--radius-sm)', fontSize: 11 }}>{fr ? 'Enregistrer' : 'Save'}</button>
        <button disabled={busy} onClick={() => onToggle(!row.is_active)} style={{ padding: '7px 10px', border: '1px solid var(--color-border)', background: 'transparent', borderRadius: 'var(--radius-sm)', fontSize: 11 }}>{row.is_active ? (fr ? 'Désactiver' : 'Disable') : (fr ? 'Activer' : 'Enable')}</button>
      </div>
    </div>
  )
}
