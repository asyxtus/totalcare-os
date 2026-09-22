'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAdmissionBedSummaryAction } from '@/lib/actions/admissions'
import DischargeRow from '@/components/DischargeRow'
import { useLang } from '@/lib/i18n/LangContext'

interface BedSummary {
  id: string
  patient_name: string
  patient_code?: string
  admission_number?: string
  ward_name: string
  bed_number: string
  admission_id?: string
  days_admitted?: number
}

export default function BedPatientModal({ bed, onClose }: { bed: BedSummary; onClose: () => void }) {
  const lang = useLang()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!bed.admission_id) return
    getAdmissionBedSummaryAction(bed.admission_id).then((result) => {
      if (!active) return
      if ('error' in result) setError(result.error)
      else setSummary(result)
      setLoading(false)
    })
    return () => { active = false }
  }, [bed.admission_id])

  if (!bed.admission_id) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'fr' ? 'Résumé du patient hospitalisé' : 'Admitted patient summary'}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.42)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div style={{
        width: 'min(820px, 100%)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,.2)',
      }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 2, padding: '18px 20px',
          background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
          display: 'flex', justifyContent: 'space-between', gap: '16px',
        }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 650 }}>{bed.patient_name}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              {bed.patient_code ?? '—'} · {bed.admission_number ?? '—'} · {bed.ward_name} — {lang === 'fr' ? 'Lit' : 'Bed'} {bed.bed_number}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--color-border)',
            background: 'var(--color-bg)', cursor: 'pointer', fontSize: 18,
          }}>×</button>
        </div>

        <div style={{ padding: '18px 20px' }}>
          {loading && <p style={{ color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Chargement du résumé…' : 'Loading summary…'}</p>}
          {error && <p style={{ color: 'var(--color-critical-text)' }}>{error}</p>}

          {summary && (
            <>
              {summary.admission.patient?.allergies && (
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', marginBottom: 14, fontSize: 12 }}>
                  ⚠ {lang === 'fr' ? 'Allergies' : 'Allergies'}: {summary.admission.patient.allergies}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                {[
                  [lang === 'fr' ? 'Jour' : 'Day', bed.days_admitted ?? '—'],
                  [lang === 'fr' ? 'Notes' : 'Notes', summary.notes.length],
                  [lang === 'fr' ? 'Médicaments' : 'Medications', summary.medications.items],
                  [lang === 'fr' ? 'Examens' : 'Labs', summary.labs.orders],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--color-text-secondary)' }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 650, marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 12 }}>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--color-text-secondary)', marginBottom: 7 }}>
                    {lang === 'fr' ? 'Admission / consultation' : 'Admission / consultation'}
                  </div>
                  <p style={{ fontSize: 13, margin: '0 0 8px' }}>{summary.admission.admission_reason || '—'}</p>
                  <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: 0 }}>
                    {lang === 'fr' ? 'Visite' : 'Visit'}: {summary.admission.visit_id}
                  </p>
                  <a href={`/admissions/${summary.admission.id}/care`} style={{
                    display: 'inline-block', marginTop: 12, fontSize: 11, padding: '7px 10px',
                    border: '1px solid var(--color-border)', borderRadius: 7, color: 'var(--color-text-primary)',
                    textDecoration: 'none',
                  }}>
                    {lang === 'fr' ? 'Ouvrir le dossier hospitalier →' : 'Open inpatient record →'}
                  </a>
                </div>

                <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--color-text-secondary)', marginBottom: 7 }}>
                    {lang === 'fr' ? 'État des soins' : 'Care status'}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                    <div>✓ {summary.tasks.completed} {lang === 'fr' ? 'soins/tâches terminés' : 'tasks completed'}</div>
                    <div>• {summary.tasks.pending} {lang === 'fr' ? 'en attente' : 'pending'}</div>
                    <div>✓ {summary.labs.completed} {lang === 'fr' ? 'examens terminés' : 'labs completed'}</div>
                    <div>• {summary.labs.pending} {lang === 'fr' ? 'examens en attente' : 'labs pending'}</div>
                    <div>💊 {summary.medications.items} {lang === 'fr' ? 'médicaments prescrits' : 'medication items'}</div>
                  </div>
                </div>
              </div>

              {summary.latestVitals && (
                <div style={{ marginTop: 12, border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--color-text-secondary)', marginBottom: 9 }}>
                    {lang === 'fr' ? 'Derniers paramètres vitaux' : 'Latest vital signs'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12 }}>
                    <span><b>TA</b> {summary.latestVitals.blood_pressure_systolic ?? '—'}/{summary.latestVitals.blood_pressure_diastolic ?? '—'}</span>
                    <span><b>FC</b> {summary.latestVitals.heart_rate ?? '—'}</span>
                    <span><b>SpO₂</b> {summary.latestVitals.oxygen_saturation ?? '—'}%</span>
                    <span><b>T°</b> {summary.latestVitals.temperature_celsius ?? '—'}°C</span>
                    <span><b>FR</b> {summary.latestVitals.respiratory_rate ?? '—'}</span>
                  </div>
                </div>
              )}

              {summary.notes.length > 0 && (
                <div style={{ marginTop: 12, border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                    {lang === 'fr' ? 'Dernières notes' : 'Recent notes'}
                  </div>
                  {summary.notes.slice(0, 3).map((n: any) => (
                    <div key={n.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--color-border-subtle)', fontSize: 12 }}>
                      <div>{n.note}</div>
                      <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                        {n.round_type ?? ''} · {n.recorded_at ? new Date(n.recorded_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <DischargeRow
                  admission={{
                    id: summary.admission.id,
                    admission_number: summary.admission.admission_number,
                    patient_name: summary.admission.patient?.full_name ?? bed.patient_name,
                    ward_name: summary.admission.ward?.name ?? bed.ward_name,
                    bed_number: summary.admission.bed?.bed_number ?? bed.bed_number,
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
