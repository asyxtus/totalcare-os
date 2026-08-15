'use client'

// components/TransferControl.tsx

import { useRef, useState } from 'react'
import { transferPatientToDoctor } from '@/lib/actions/transfer'
import { useLang } from '@/lib/i18n/LangContext'

interface Doctor { id: string; full_name: string }

export default function TransferControl({ visitId, doctors, currentDoctorId }: { visitId: string; doctors: Doctor[]; currentDoctorId: string | null }) {
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitLock = useRef(false)

  async function handleSubmit(formData: FormData) {
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    setError(null)
    try {
      const result = await transferPatientToDoctor(visitId, formData)
      if (result && 'error' in result && result.error) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    } catch {
      setError(lang === 'fr' ? 'Une erreur est survenue. Veuillez réessayer.' : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
      submitLock.current = false
    }
  }

  if (!open) {
    return <button onClick={(e) => { e.preventDefault(); setOpen(true) }} style={{ fontSize: '11px', color: 'var(--color-text-secondary)', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{lang === 'fr' ? 'Transférer' : 'Transfer'}</button>
  }

  return (
    <form action={handleSubmit} onClick={(e) => e.preventDefault()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <select name="new_doctor_id" defaultValue="" required style={{ fontSize: '11px', padding: '3px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}>
        <option value="" disabled>{lang === 'fr' ? 'Choisir…' : 'Choose…'}</option>
        {doctors.filter((d) => d.id !== currentDoctorId).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
      </select>
      <button type="submit" disabled={submitting} style={{ fontSize: '11px', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>{submitting ? '…' : 'OK'}</button>
      {error && <span style={{ fontSize: '10px', color: 'var(--color-critical-text)' }}>{error}</span>}
    </form>
  )
}
