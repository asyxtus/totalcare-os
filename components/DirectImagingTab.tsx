'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createDirectImagingVisit, searchPatientsForDirectImaging } from '@/lib/actions/imaging'
import type { ImagingCatalogItem } from './admin/pricing/ImagingSection'

type Patient = {
  id: string
  full_name: string
  patient_code: string
  phone?: string | null
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  fontSize: 13,
}

export default function DirectImagingTab({
  lang,
  items,
}: {
  lang: 'fr' | 'en'
  items: ImagingCatalogItem[]
}) {
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [patient, setPatient] = useState<Patient | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [indication, setIndication] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<any>(null)

  async function findPatient() {
    setError(null)
    setPatient(null)
    setSuccess(null)
    const result = await searchPatientsForDirectImaging(query)
    setPatients(result as Patient[])
  }

  function toggle(id: string) {
    setSelected(current =>
      current.includes(id)
        ? current.filter(itemId => itemId !== id)
        : [...current, id],
    )
  }

  const activeItems = items.filter(item => item.is_active)
  const total = activeItems
    .filter(item => selected.includes(item.id))
    .reduce((sum, item) => sum + Number(item.price_xaf), 0)

  async function submit() {
    if (!patient) {
      setError(lang === 'fr' ? 'Sélectionnez un patient.' : 'Select a patient.')
      return
    }

    if (selected.length === 0) {
      setError(
        lang === 'fr'
          ? 'Sélectionnez au moins un examen.'
          : 'Select at least one examination.',
      )
      return
    }

    setBusy(true)
    setError(null)

    try {
      const result = await createDirectImagingVisit(
        patient.id,
        selected,
        indication,
        reason,
      )

      if ('error' in result && result.error) {
        setError(result.error)
      } else {
        setSuccess(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create imaging visit.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setQuery('')
    setPatients([])
    setPatient(null)
    setSelected([])
    setIndication('')
    setReason('')
    setError(null)
    setSuccess(null)
  }

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ margin: '1rem 0' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>
          {lang === 'fr'
            ? 'Imagerie directe — sans consultation'
            : 'Direct imaging — no consultation'}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
          {lang === 'fr'
            ? 'Créer une visite d’imagerie et sa facture sans passer par une consultation.'
            : 'Create an imaging encounter and invoice without a consultation.'}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '9px 12px',
            marginBottom: 10,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-critical-bg)',
            color: 'var(--color-critical-text)',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {success ? (
        <div
          style={{
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-success-text)',
              margin: '0 0 8px',
            }}
          >
            {lang === 'fr' ? 'Visite d’imagerie créée.' : 'Imaging visit created.'}
          </p>
          <p style={{ fontSize: 13, margin: '0 0 12px' }}>
            Total:{' '}
            <strong>
              {Number(success.totalAmountXaf).toLocaleString()} FCFA
            </strong>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link
              href="/billing"
              style={{
                padding: '7px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-accent)',
                color: 'var(--color-accent-text-on)',
                textDecoration: 'none',
                fontSize: 12,
              }}
            >
              {lang === 'fr' ? 'Ouvrir la caisse →' : 'Open cashier →'}
            </Link>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '7px 12px',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {lang === 'fr' ? 'Nouvelle visite' : 'New visit'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              marginBottom: 10,
            }}
          >
            <label
              style={{
                fontSize: 11,
                color: 'var(--color-text-secondary)',
                display: 'block',
                marginBottom: 4,
              }}
            >
              {lang === 'fr' ? 'Rechercher le patient' : 'Search patient'}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void findPatient()
                  }
                }}
                placeholder={
                  lang === 'fr'
                    ? 'Nom, code ou téléphone…'
                    : 'Name, code or phone…'
                }
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => void findPatient()}
                disabled={query.trim().length < 2}
                style={{
                  padding: '0 16px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-accent)',
                  color: 'var(--color-accent-text-on)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {lang === 'fr' ? 'Rechercher' : 'Search'}
              </button>
            </div>

            {patients.length > 0 && !patient && (
              <div style={{ marginTop: 8, display: 'grid', gap: 5 }}>
                {patients.map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setPatient(item)
                      setPatients([])
                    }}
                    style={{
                      textAlign: 'left',
                      padding: 8,
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-bg)',
                      cursor: 'pointer',
                    }}
                  >
                    <strong style={{ fontSize: 12 }}>{item.full_name}</strong>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-secondary)',
                        marginLeft: 8,
                      }}
                    >
                      {item.patient_code}
                    </span>
                    {item.phone && (
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-secondary)',
                          marginLeft: 8,
                        }}
                      >
                        {item.phone}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {patient && (
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {lang === 'fr' ? 'Patient sélectionné' : 'Selected patient'}
                  </div>
                  <strong style={{ fontSize: 14 }}>{patient.full_name}</strong>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-secondary)',
                      marginLeft: 8,
                    }}
                  >
                    {patient.patient_code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPatient(null)}
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                  gap: 8,
                }}
              >
                {activeItems.map(item => (
                  <label
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: 8,
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      background: selected.includes(item.id)
                        ? 'var(--color-bg)'
                        : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                    <span style={{ flex: 1, fontSize: 12 }}>
                      {lang === 'fr' ? item.name_fr : item.name_en}
                      <small
                        style={{
                          display: 'block',
                          fontSize: 10,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {item.modality}
                        {item.turnaround_minutes
                          ? ` · ${item.turnaround_minutes} min`
                          : ''}
                      </small>
                    </span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      {Number(item.price_xaf).toLocaleString()} F
                    </span>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <input
                  value={indication}
                  onChange={event => setIndication(event.target.value)}
                  placeholder={lang === 'fr' ? 'Indication clinique' : 'Clinical indication'}
                  style={inputStyle}
                />
                <input
                  value={reason}
                  onChange={event => setReason(event.target.value)}
                  placeholder={lang === 'fr' ? 'Motif (optionnel)' : 'Reason (optional)'}
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: '1px solid var(--color-border-subtle)',
                }}
              >
                <strong>{total.toLocaleString()} FCFA</strong>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || selected.length === 0}
                  style={{
                    padding: '9px 15px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-accent)',
                    color: 'var(--color-accent-text-on)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {busy
                    ? '…'
                    : lang === 'fr'
                      ? 'Enregistrer et envoyer à la caisse'
                      : 'Register and send to cashier'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
