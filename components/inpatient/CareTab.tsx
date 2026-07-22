'use client'

// components/inpatient/CareTab.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createInpatientPrescriptionAction, recordCareTaskAction } from '@/lib/actions/inpatientCare'
import { useLang } from '@/lib/i18n/LangContext'

const STR = {
  fr: {
    rxTitle: '💊 Prescrire un médicament (envoyé à la pharmacie)',
    searchInventory: 'Rechercher dans le stock…',
    freetextPh: 'Nom du médicament',
    fromCatalog: '← Choisir depuis le catalogue', offCatalog: 'Médicament hors catalogue →',
    dose: 'Dose', dosePh: 'ex. 500mg', route: 'Voie', topical: 'Topique',
    frequency: 'Fréquence', freqPh: 'BD / TDS / QID',
    duration: 'Durée (jours)', quantity: 'Quantité *', instructions: 'Instructions',
    rxSent: '✓ Prescription envoyée à la pharmacie.',
    sendToPharmacy: 'Envoyer à la pharmacie',
    tasksTitle: 'Tâches de soins',
    taskPh: 'ex. Pansement refait, patient repositionné…',
    logTask: '+ Consigner',
    noTasks: 'Aucune tâche enregistrée.',
    locale: 'fr-FR',
  },
  en: {
    rxTitle: '💊 Prescribe Medication (sent to pharmacy)',
    searchInventory: 'Search inventory…',
    freetextPh: 'Medication name',
    fromCatalog: '← Choose from catalog', offCatalog: 'Off-catalog medication →',
    dose: 'Dose', dosePh: 'e.g. 500mg', route: 'Route', topical: 'Topical',
    frequency: 'Frequency', freqPh: 'BD / TDS / QID',
    duration: 'Duration (days)', quantity: 'Quantity *', instructions: 'Instructions',
    rxSent: '✓ Prescription sent to pharmacy.',
    sendToPharmacy: 'Send to Pharmacy',
    tasksTitle: 'Care Tasks',
    taskPh: 'e.g. Wound dressing changed, patient repositioned…',
    logTask: '+ Log Task',
    noTasks: 'No tasks recorded.',
    locale: 'en-US',
  },
} as const

interface Product {
  id: string
  name: string
  dosageForm?: string | null
  isAntibiotic?: boolean
  onHand?: number
}
interface Task { id: string; task_description: string; completed_at: string; staff_name: string }

export default function CareTab({ admissionId, products, tasks }: { admissionId: string; products: Product[]; tasks: Task[] }) {
  const lang = useLang()
  const t = STR[lang]
  const router = useRouter()
  const [useFreetext, setUseFreetext] = useState(false)
  const [rxError, setRxError] = useState<string | null>(null)
  const [rxSuccess, setRxSuccess] = useState(false)
  const [rxSubmitting, setRxSubmitting] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [taskSubmitting, setTaskSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', width: '100%', boxSizing: 'border-box',
  }

  async function handleRxSubmit(formData: FormData) {
    setRxError(null)
    setRxSuccess(false)
    setRxSubmitting(true)
    const result = await createInpatientPrescriptionAction(admissionId, formData)
    if (result?.error) {
      setRxError(result.error)
      setRxSubmitting(false)
    } else {
      setRxSubmitting(false)
      setRxSuccess(true)
      router.refresh()
      const form = document.getElementById('inpatient-rx-form') as HTMLFormElement | null
      form?.reset()
    }
  }

  async function handleTaskSubmit(formData: FormData) {
    setTaskError(null)
    setTaskSubmitting(true)
    const result = await recordCareTaskAction(admissionId, formData)
    if (result?.error) {
      setTaskError(result.error)
      setTaskSubmitting(false)
    } else {
      setTaskSubmitting(false)
      router.refresh()
    }
  }

  return (
    <div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>{t.rxTitle}</p>
        <form id="inpatient-rx-form" action={handleRxSubmit}>
          {!useFreetext ? (
            <select name="product_id" style={{ ...inputStyle, marginBottom: '8px' }}>
              <option value="">{t.searchInventory}</option>
              {products.map((p) => {
                const oos = (p.onHand ?? 0) === 0
                const low = !oos && (p.onHand ?? 0) < 10
                const stock = oos
                  ? (lang === 'fr' ? 'épuisé' : 'out of stock')
                  : low
                  ? `${p.onHand} ${lang === 'fr' ? 'restants' : 'left'}`
                  : `${p.onHand} ${lang === 'fr' ? 'en stock' : 'in stock'}`
                // Only show dosage form if it adds info not already in the name.
                // e.g. name "Fluoxetine 10MG" + form "10MG Capsule" → show just "Capsule"
                let formPart = ''
                if (p.dosageForm) {
                  const nameLower = p.name.toLowerCase()
                  // Strip any token from the dosage form that's already in the name
                  const formTokens = p.dosageForm.split(/\s+/).filter((tok: string) =>
                    !nameLower.includes(tok.toLowerCase())
                  )
                  formPart = formTokens.join(' ').trim()
                }
                const label = [
                  p.name,
                  formPart || null,
                  p.isAntibiotic ? '[Ab]' : null,
                ].filter(Boolean).join(' · ') + ` — ${stock}`
                return <option key={p.id} value={p.id} disabled={oos}>{label}</option>
              })}
            </select>
          ) : (
            <input name="freetext_name" placeholder={t.freetextPh} style={{ ...inputStyle, marginBottom: '8px' }} />
          )}
          <button type="button" onClick={() => setUseFreetext((f) => !f)} style={{ fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '8px', display: 'block' }}>
            {useFreetext ? t.fromCatalog : t.offCatalog}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.dose}</label>
              <input name="dose" placeholder={t.dosePh} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.route}</label>
              <select name="route" style={inputStyle}>
                <option value="PO">PO</option>
                <option value="IV">IV</option>
                <option value="IM">IM</option>
                <option value="SC">SC</option>
                <option value="Topique">{t.topical}</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.frequency}</label>
              <input name="frequency" placeholder={t.freqPh} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.duration}</label>
              <input name="duration_days" type="number" placeholder="5" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.quantity}</label>
              <input name="quantity" type="number" required style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t.instructions}</label>
              <input name="instructions" style={inputStyle} />
            </div>
          </div>

          {rxError && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{rxError}</p>}
          {rxSuccess && (
            <p style={{ fontSize: '12px', color: 'var(--color-success-text)', background: 'var(--color-success-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '8px' }}>
              {t.rxSent}
            </p>
          )}

          <button type="submit" disabled={rxSubmitting} style={{
            width: '100%', fontSize: '14px', fontWeight: 500, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
          }}>
            {rxSubmitting ? '…' : t.sendToPharmacy}
          </button>
        </form>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>{t.tasksTitle}</p>
        <form action={handleTaskSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input name="task_description" placeholder={t.taskPh} required style={{ ...inputStyle, flex: 1 }} />
          <button type="submit" disabled={taskSubmitting} style={{
            fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {taskSubmitting ? '…' : t.logTask}
          </button>
        </form>
        {taskError && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginBottom: '8px' }}>{taskError}</p>}

        {tasks.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t.noTasks}</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '13px' }}>
              {task.task_description}
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                — {task.staff_name}, {new Date(task.completed_at).toLocaleString(t.locale)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
