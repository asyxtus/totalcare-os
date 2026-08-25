'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createDirectLabVisit, searchPatientsForDirectLab } from '@/lib/actions/directLab'

type Patient = { id: string; full_name: string; patient_code: string; phone?: string | null }
type Test = {
  id: string
  price_xaf: number
  lab_test_catalog: { id: string; name_fr: string; name_en: string | null; category: string | null }
}
type Panel = {
  id: string
  price_xaf: number
  lab_panels: { id: string; name_fr: string; name_en: string | null }
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', fontSize: '13px',
  background: 'var(--color-bg)', color: 'var(--color-text-primary)',
}

export default function DirectLaboratoryTab({
  lang, tests, panels,
}: {
  lang: 'fr' | 'en'
  tests: Test[]
  panels: Panel[]
}) {
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [patient, setPatient] = useState<Patient | null>(null)
  const [selectedTests, setSelectedTests] = useState<string[]>([])
  const [selectedPanels, setSelectedPanels] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ invoiceId?: string; total: number } | null>(null)

  const t = {
    title: lang === 'fr' ? 'Laboratoire direct — sans consultation' : 'Direct laboratory — no consultation',
    subtitle: lang === 'fr'
      ? 'Pour les patients qui viennent uniquement pour des analyses. Une visite de laboratoire et une facture sont créées automatiquement.'
      : 'For patients who come only for laboratory tests. A laboratory encounter and invoice are created automatically.',
    search: lang === 'fr' ? 'Rechercher le patient' : 'Search patient',
    searchPlaceholder: lang === 'fr' ? 'Nom, code patient ou téléphone…' : 'Name, patient code or phone…',
    find: lang === 'fr' ? 'Rechercher' : 'Search',
    selected: lang === 'fr' ? 'Patient sélectionné' : 'Selected patient',
    tests: lang === 'fr' ? 'Tests individuels' : 'Individual tests',
    panels: lang === 'fr' ? 'Panels' : 'Panels',
    reason: lang === 'fr' ? 'Motif (optionnel)' : 'Reason (optional)',
    reasonPlaceholder: lang === 'fr' ? 'Ex. Bilan biologique demandé…' : 'e.g. Requested blood work…',
    register: lang === 'fr' ? 'Enregistrer et envoyer à la caisse' : 'Register and send to cashier',
    none: lang === 'fr' ? 'Aucun résultat' : 'No patients found',
    success: lang === 'fr' ? 'Visite de laboratoire créée. Le patient peut passer à la caisse.' : 'Laboratory visit created. The patient can proceed to cashier.',
    viewBilling: lang === 'fr' ? 'Ouvrir la facturation →' : 'Open billing →',
    clear: lang === 'fr' ? 'Nouvelle visite' : 'New visit',
  }

  async function findPatients() {
    setError(null)
    setPatient(null)
    setSuccess(null)
    const result = await searchPatientsForDirectLab(query)
    setPatients(result as Patient[])
  }

  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) {
    setter((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
  }

  async function submit() {
    if (!patient) {
      setError(lang === 'fr' ? 'Sélectionnez un patient.' : 'Select a patient.')
      return
    }
    if (!selectedTests.length && !selectedPanels.length) {
      setError(lang === 'fr' ? 'Sélectionnez au moins un examen.' : 'Select at least one test or panel.')
      return
    }

    setError(null)
    setBusy(true)

    const items = [
      ...selectedTests.map((catalog_id) => ({ type: 'individual_test' as const, catalog_id })),
      ...selectedPanels.map((panel_id) => ({ type: 'panel' as const, panel_id })),
    ]

    const result = await createDirectLabVisit(patient.id, items, reason)
    if ('error' in result && result.error) {
      setError(result.error)
      setBusy(false)
      return
    }

    setSuccess({ invoiceId: result.invoiceId, total: result.totalAmountXaf ?? 0 })
    setBusy(false)
  }

  function reset() {
    setPatient(null)
    setPatients([])
    setQuery('')
    setSelectedTests([])
    setSelectedPanels([])
    setReason('')
    setError(null)
    setSuccess(null)
  }

  const selectedTotal = tests
    .filter((t) => selectedTests.includes(t.lab_test_catalog.id))
    .reduce((s, t) => s + Number(t.price_xaf), 0)
    + panels
      .filter((p) => selectedPanels.includes(p.lab_panels.id))
      .reduce((s, p) => s + Number(p.price_xaf), 0)

  return (
    <div style={{ maxWidth: '920px' }}>
      <div style={{ margin: '1rem 0' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>{t.title}</h2>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>{t.subtitle}</p>
      </div>

      {error && <div role="alert" style={{ padding: '9px 12px', marginBottom: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', fontSize: '12px' }}>{error}</div>}

      {success ? (
        <div style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
          <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: 'var(--color-success-text)' }}>{t.success}</p>
          <p style={{ margin: '0 0 12px', fontSize: '13px' }}>
            {lang === 'fr' ? 'Total :' : 'Total:'} <strong>{success.total.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA</strong>
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/billing" style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', textDecoration: 'none', fontSize: '12px' }}>{t.viewBilling}</Link>
            <button onClick={reset} style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', fontSize: '12px', cursor: 'pointer' }}>{t.clear}</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t.search}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); findPatients() } }} placeholder={t.searchPlaceholder} style={inputStyle} />
              <button onClick={findPatients} disabled={query.trim().length < 2} style={{ padding: '0 16px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer', fontSize: '12px' }}>{t.find}</button>
            </div>

            {patients.length > 0 && !patient && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {patients.map((p) => (
                  <button key={p.id} onClick={() => { setPatient(p); setPatients([]) }} style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', cursor: 'pointer' }}>
                    <strong style={{ fontSize: '12px' }}>{p.full_name}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '8px', fontFamily: 'var(--font-mono)' }}>{p.patient_code}</span>
                    {p.phone && <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>{p.phone}</span>}
                  </button>
                ))}
              </div>
            )}
            {query.trim().length >= 2 && patients.length === 0 && !patient && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>{t.none}</p>}
          </div>

          {patient && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.selected}</div>
                  <strong style={{ fontSize: '14px' }}>{patient.full_name}</strong>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>{patient.patient_code}</span>
                </div>
                <button onClick={() => setPatient(null)} style={{ border: '1px solid var(--color-border)', background: 'transparent', borderRadius: 'var(--radius-sm)', padding: '5px 9px', fontSize: '11px', cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 7px' }}>{t.tests}</p>
                  {tests.map((test) => {
                    const id = test.lab_test_catalog.id
                    const checked = selectedTests.includes(id)
                    return <label key={test.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', marginBottom: '4px', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: checked ? 'var(--color-bg)' : 'transparent' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(setSelectedTests, id)} />
                      <span style={{ flex: 1, fontSize: '12px' }}>{lang === 'fr' ? test.lab_test_catalog.name_fr : (test.lab_test_catalog.name_en || test.lab_test_catalog.name_fr)}</span>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{Number(test.price_xaf).toLocaleString()} F</span>
                    </label>
                  })}
                </div>

                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 7px' }}>{t.panels}</p>
                  {panels.map((panel) => {
                    const id = panel.lab_panels.id
                    const checked = selectedPanels.includes(id)
                    return <label key={panel.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', marginBottom: '4px', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: checked ? 'var(--color-bg)' : 'transparent' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(setSelectedPanels, id)} />
                      <span style={{ flex: 1, fontSize: '12px' }}>{lang === 'fr' ? panel.lab_panels.name_fr : (panel.lab_panels.name_en || panel.lab_panels.name_fr)}</span>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{Number(panel.price_xaf).toLocaleString()} F</span>
                    </label>
                  })}
                </div>
              </div>

              <div style={{ marginTop: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t.reason}</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.reasonPlaceholder} style={inputStyle} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)' }}>
                <strong style={{ fontSize: '14px' }}>{selectedTotal.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA</strong>
                <button onClick={submit} disabled={busy || selectedTotal <= 0} style={{ padding: '9px 15px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, fontSize: '12px', fontWeight: 600 }}>
                  {busy ? '…' : t.register}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
