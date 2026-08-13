'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePatient } from '@/lib/actions/patients'

interface Patient {
  id: string
  full_name: string
  sex: string | null
  date_of_birth: string | null
  estimated_age: number | null
  national_id_number: string | null
  phone: string | null
  quartier: string | null
  city: string | null
  next_of_kin_name: string | null
  next_of_kin_phone: string | null
  allergies: string | null
  chronic_conditions: string | null
  payment_category: string | null
}

export default function EditPatientForm({ patient }: { patient: Patient }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(formData: FormData) {
    setError(null)
    setSaving(true)
    const result = await updatePatient(patient.id, formData)
    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }
    router.push(`/patients/${patient.id}`)
    router.refresh()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)', fontSize: '14px',
    background: 'var(--color-surface)', color: 'var(--color-text-primary)', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px',
  }
  const group: React.CSSProperties = { marginBottom: '1rem' }

  return (
    <form action={submit}>
      <div style={group}>
        <label style={labelStyle}>Nom complet / Full name *</label>
        <input name="full_name" required defaultValue={patient.full_name} style={inputStyle} />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Sexe / Sex</label>
          <select name="sex" defaultValue={patient.sex ?? ''} style={inputStyle}>
            <option value="">—</option>
            <option value="F">Féminin / Female</option>
            <option value="M">Masculin / Male</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Catégorie de paiement / Payment</label>
          <select name="payment_category" defaultValue={patient.payment_category ?? 'cash'} style={inputStyle}>
            <option value="cash">Comptant / Cash</option>
            <option value="employer_scheme">Régime employeur / Employer scheme</option>
            <option value="cnps">CNPS</option>
            <option value="private_insurance">Assurance privée / Private insurance</option>
          </select>
        </div>
      </div>

      <div style={group}>
        <label style={labelStyle}>Date de naissance / Date of birth</label>
        <input type="date" name="date_of_birth" defaultValue={patient.date_of_birth ?? ''} style={inputStyle} />
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '5px 0 0' }}>If DOB is unknown, leave this empty and enter an estimated age below.</p>
      </div>

      <div style={group}>
        <label style={labelStyle}>Âge estimé / Estimated age</label>
        <input type="number" name="estimated_age" min="0" max="130" defaultValue={patient.estimated_age ?? ''} style={inputStyle} />
      </div>

      <div style={group}>
        <label style={labelStyle}>Numéro CNI / National ID</label>
        <input name="national_id_number" defaultValue={patient.national_id_number ?? ''} style={inputStyle} />
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ ...group, flex: 1 }}>
          <label style={labelStyle}>Téléphone / Phone</label>
          <input name="phone" type="tel" defaultValue={patient.phone ?? ''} style={inputStyle} />
        </div>
        <div style={{ ...group, flex: 1 }}>
          <label style={labelStyle}>Quartier / Neighborhood</label>
          <input name="quartier" defaultValue={patient.quartier ?? ''} style={inputStyle} />
        </div>
      </div>

      <div style={group}>
        <label style={labelStyle}>Ville / City</label>
        <input name="city" defaultValue={patient.city ?? ''} style={inputStyle} />
      </div>

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '1.25rem 0 0.5rem' }}>Personne à contacter / Emergency contact</p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ ...group, flex: 1 }}>
          <label style={labelStyle}>Nom / Name</label>
          <input name="next_of_kin_name" defaultValue={patient.next_of_kin_name ?? ''} style={inputStyle} />
        </div>
        <div style={{ ...group, flex: 1 }}>
          <label style={labelStyle}>Téléphone / Phone</label>
          <input name="next_of_kin_phone" type="tel" defaultValue={patient.next_of_kin_phone ?? ''} style={inputStyle} />
        </div>
      </div>

      <div style={group}>
        <label style={labelStyle}>Allergies</label>
        <textarea name="allergies" defaultValue={patient.allergies ?? ''} rows={3} style={inputStyle} />
      </div>

      <div style={{ ...group, marginBottom: '1.5rem' }}>
        <label style={labelStyle}>Maladies chroniques / Chronic conditions</label>
        <textarea name="chronic_conditions" defaultValue={patient.chronic_conditions ?? ''} rows={3} style={inputStyle} />
      </div>

      {error && (
        <div style={{ background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => router.push(`/patients/${patient.id}`)} disabled={saving} style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer' }}>
          Cancel / Annuler
        </button>
        <button type="submit" disabled={saving} style={{ padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: saving ? 'wait' : 'pointer', fontWeight: 500 }}>
          {saving ? 'Saving… / Enregistrement…' : 'Save changes / Enregistrer'}
        </button>
      </div>
    </form>
  )
}
