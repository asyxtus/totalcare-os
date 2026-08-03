'use client'

// components/ConsultationForm.tsx

import { useState, useRef } from 'react'
import { completeConsultation } from '@/lib/actions/consultation'
import { useLang } from '@/lib/i18n/LangContext'
import ReferralForm from '@/components/ReferralForm'

interface Product {
  id: string
  name: string
  genericName?: string | null
  dosageForm: string | null
  isAntibiotic: boolean
  onHand: number
  drugClassName: string | null
}

interface Template {
  id: string
  category: string
  name_fr: string
  name_en?: string | null
  age_group_label: string | null
  subjective_prompt?: string | null
  subjective_prompt_en?: string | null
  objective_prompt?: string | null
  objective_prompt_en?: string | null
  assessment_prompt?: string | null
  assessment_prompt_en?: string | null
  plan_prompt?: string | null
  plan_prompt_en?: string | null
  suggested_icd10_code?: string | null
}

interface Icd10Code { code: string; description_fr: string; category: string }
interface LabOption { id: string; name: string; category: string }
interface ProcedureOption { id: string; service_name: string; category: string; price_xaf: number }
interface InitialValues {
  subjective: string
  objective: string
  diagnosis: string
  diagnosisCode: string
  treatmentPlan: string
}
interface RxRow {
  mode: 'catalog' | 'freetext'
  productId: string
  freetextName: string
  dose: string
  frequency: string
  durationDays: string
  quantity: string
  instructions: string
}

const STR = {
  fr: {
    subjective: 'S — Subjectif',
    subjectivePh: 'Symptômes rapportés par le patient…',
    objective: 'O — Objectif',
    objectivePh: 'Observations cliniques, examens physiques…',
    assessment: 'A — Analyse',
    diagPh: 'Diagnostic principal…',
    plan: 'P — Plan',
    planPh: 'Conduite à tenir, conseils, suivi…',
    template: 'Modèle de consultation',
    noTemplate: 'Sans modèle',
    templateHelper: 'Choisir un modèle pré-remplit les champs ci-dessous — tout reste modifiable.',
    icd: 'Code CIM-10',
    prescription: 'Ordonnance',
    fromStock: 'Stock de la pharmacie',
    extDrug: 'Médicament externe (texte libre)',
    drugPh: 'Nom du médicament',
    searchDrugPh: '— Rechercher un médicament (nom ou DCI) —',
    noDrugFound: 'Aucun médicament trouvé — essayez la saisie libre.',
    outOfStockTag: 'épuisé',
    freetextHint: "Ce médicament ne sera pas déduit du stock — utilisez ceci pour tout ce que la pharmacie n'a pas (rupture de stock ou hors catalogue). Le patient l'achètera ailleurs.",
    typeManually: '✎ Saisie libre (hors catalogue)',
    chooseFromStock: '↺ Choisir dans le stock',
    dosePh: 'Posologie',
    freqPh: 'Fréquence',
    durPh: 'Durée (j)',
    qtyPh: 'Qté',
    addDrug: '+ Ajouter un médicament',
    labs: 'Examens de laboratoire',
    labSearch: 'Rechercher un examen…',
    noLabs: 'Aucun examen configuré pour cette clinique.',
    noLabResults: (q: string) => `Aucun résultat pour « ${q} ».`,
    extLab: 'Examen externe (hors catalogue)',
    extLabPh: 'ex. Scanner thoracique, IRM lombaire…',
    procedures: 'Procédures (imagerie, actes techniques…)',
    noProcedures: "Aucune procédure configurée pour cette clinique — un administrateur peut en ajouter depuis Administration → Services (catégorie autre que « consultation »).",
    procedureSelected: (n: number) => `${n} procédure(s) sélectionnée(s)`,
    allergyWarning: (m: string) => `⚠ Allergie signalée par le patient : « ${m} » — vérifiez avant de prescrire`,
    selected: (n: number) => `${n} test(s) sélectionné(s)`,
    backToQueue: '← Retour à la file',
    admit: 'Admettre en hospitalisation',
    admitNote: "Note d'admission",
    admitPh: "Motif d'hospitalisation…",
    processing: 'Enregistrement…',
    processingNote: 'Enregistrement en cours…',
    finish: 'Terminer la consultation',
    add: 'Ajouter',
    locale: 'fr-FR',
  },
  en: {
    subjective: 'S — Subjective',
    subjectivePh: 'Symptoms reported by the patient…',
    objective: 'O — Objective',
    objectivePh: 'Clinical observations, physical examination…',
    assessment: 'A — Assessment',
    diagPh: 'Primary diagnosis…',
    plan: 'P — Plan',
    planPh: 'Management, advice, follow-up…',
    template: 'Consultation template',
    noTemplate: 'No template',
    templateHelper: 'Selecting a template pre-fills the fields below — everything remains editable.',
    icd: 'ICD-10 code',
    prescription: 'Prescription',
    fromStock: 'Pharmacy stock',
    extDrug: 'External medication (free text)',
    drugPh: 'Medication name',
    searchDrugPh: '— Search medication (name or generic) —',
    noDrugFound: 'No medication found — try typing manually.',
    outOfStockTag: 'out of stock',
    freetextHint: "This medication won't be deducted from stock — use this for anything the pharmacy doesn't have (out of stock or not in the catalog). The patient will buy it elsewhere.",
    typeManually: '✎ Type manually (not in catalog)',
    chooseFromStock: '↺ Choose from stock',
    dosePh: 'Dose',
    freqPh: 'Frequency',
    durPh: 'Duration (d)',
    qtyPh: 'Qty',
    addDrug: '+ Add medication',
    labs: 'Laboratory tests',
    labSearch: 'Search for a test…',
    noLabs: 'No tests configured for this clinic.',
    noLabResults: (q: string) => `No results for "${q}".`,
    extLab: 'External test (off-catalog)',
    extLabPh: 'e.g. Chest CT, lumbar MRI…',
    procedures: 'Procedures (imaging, technical acts…)',
    noProcedures: 'No procedures configured for this clinic — an administrator can add one from Administration → Services (any category other than "consultation").',
    procedureSelected: (n: number) => `${n} procedure(s) selected`,
    allergyWarning: (m: string) => `⚠ Patient-reported allergy: «${m}» — verify before prescribing`,
    selected: (n: number) => `${n} test(s) selected`,
    backToQueue: '← Back to queue',
    admit: 'Admit for inpatient care',
    admitNote: 'Admission note',
    admitPh: 'Reason for admission…',
    processing: 'Saving…',
    processingNote: 'Saving…',
    finish: 'Complete consultation',
    add: 'Add',
    locale: 'en-US',
  },
} as const

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', fontSize: '13px',
  background: 'var(--color-bg)', color: 'var(--color-text-primary)',
}

const CATEGORY_LABELS_I18N: Record<string, { fr: string; en: string }> = {
  illness: { fr: 'Maladies courantes', en: 'Common illnesses' },
  annual_physical: { fr: 'Examen annuel', en: 'Annual physical' },
  antenatal: { fr: 'Prénatal', en: 'Antenatal' },
  well_child: { fr: "Suivi de l'enfant", en: 'Well-child visit' },
}

function emptyRxRow(): RxRow {
  return { mode: 'catalog', productId: '', freetextName: '', dose: '', frequency: '', durationDays: '', quantity: '', instructions: '' }
}

// Heuristic allergy check — splits patient allergy text into tokens and
// checks if any appear in the product name or drug class. NOT a guaranteed
// safety net — warns when it can, does not prove absence of risk when silent.
function checkAllergyMatch(product: Product, patientAllergies: string | null): string | null {
  if (!patientAllergies) return null
  const tokens = patientAllergies.toLowerCase().split(/[,;]/).map(t => t.trim()).filter(t => t.length > 2)
  const text = `${product.name} ${product.drugClassName ?? ''} ${product.dosageForm ?? ''}`.toLowerCase()
  return tokens.find(tok => text.includes(tok)) ?? null
}

// Searchable medication picker — replaces a plain <select> that only
// ever matched a product's own name from the very start of the string,
// with no way to search by generic/INN name at all. Filters by BOTH
// name and genericName, mirroring the search UX already used for lab
// tests just below this in the same form. The actual selected product
// id still submits via a plain hidden input — this component is purely
// the search/select UI, not the form field itself.
function MedicationPicker({
  products, value, onSelect, lang,
}: {
  products: Product[]
  value: string
  onSelect: (productId: string) => void
  lang: 'fr' | 'en'
}) {
  const t = STR[lang]
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const selected = products.find((p) => p.id === value)

  const q = query.trim().toLowerCase()
  const filtered = (
    q.length > 0
      ? products.filter((p) =>
          p.name.toLowerCase().includes(q) || (p.genericName ?? '').toLowerCase().includes(q)
        )
      : products
  ).slice(0, 8)

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={isOpen ? query : (selected?.name ?? '')}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { setQuery(''); setIsOpen(true) }}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder={t.searchDrugPh}
        style={{
          width: '100%', border: 'none', background: 'transparent',
          fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)',
          outline: 'none', padding: 0,
        }}
      />
      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)', maxHeight: '220px', overflowY: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {t.noDrugFound}
            </div>
          ) : (
            filtered.map((p) => {
              const oos = (p.onHand ?? 0) === 0
              return (
                <div
                  key={p.id}
                  onMouseDown={() => { if (!oos) { onSelect(p.id); setIsOpen(false) } }}
                  style={{
                    padding: '8px 12px', cursor: oos ? 'not-allowed' : 'pointer',
                    borderBottom: '1px solid var(--color-border-subtle)', opacity: oos ? 0.5 : 1,
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>
                    {p.name}{oos ? ` (${t.outOfStockTag})` : ''}
                  </div>
                  {(p.genericName || p.dosageForm) && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {[p.genericName, p.dosageForm].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

interface ConsultationFormProps {
  visitId: string
  consultationId: string
  patientId: string
  products: Product[]
  patientAllergies: string | null
  templates: Template[]
  icd10Codes: Icd10Code[]
  availablePanels: LabOption[]
  availableTests: LabOption[]
  availableProcedures?: ProcedureOption[]
  initialValues: InitialValues
}

export default function ConsultationForm({
  visitId, consultationId, patientId, products, patientAllergies,
  templates, icd10Codes, availablePanels, availableTests, availableProcedures = [], initialValues,
}: ConsultationFormProps) {
  const lang = useLang()
  const t = STR[lang]
  const [showReferral, setShowReferral] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submissionInFlight = useRef(false)

  const [subjective, setSubjective] = useState(initialValues.subjective)
  const [objective, setObjective] = useState(initialValues.objective)
  const [diagnosis, setDiagnosis] = useState(initialValues.diagnosis)
  const [diagnosisCode, setDiagnosisCode] = useState(initialValues.diagnosisCode)
  const [treatmentPlan, setTreatmentPlan] = useState(initialValues.treatmentPlan)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [rxRows, setRxRows] = useState<RxRow[]>([emptyRxRow()])
  const [selectedPanelIds, setSelectedPanelIds] = useState<string[]>([])
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([])
  const [externalTests, setExternalTests] = useState<string[]>([])
  const [externalTestInput, setExternalTestInput] = useState('')
  const [labSearchQuery, setLabSearchQuery] = useState('')
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<string[]>([])
  const [admitPatient, setAdmitPatient] = useState(false)
  const [admissionReason, setAdmissionReason] = useState('')

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId)
    if (!templateId) return
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return
    const useEn = lang === 'en'
    setSubjective(useEn && tpl.subjective_prompt_en ? tpl.subjective_prompt_en : (tpl.subjective_prompt ?? ''))
    setObjective(useEn && tpl.objective_prompt_en ? tpl.objective_prompt_en : (tpl.objective_prompt ?? ''))
    setDiagnosis(useEn && tpl.assessment_prompt_en ? tpl.assessment_prompt_en : (tpl.assessment_prompt ?? ''))
    setTreatmentPlan(useEn && tpl.plan_prompt_en ? tpl.plan_prompt_en : (tpl.plan_prompt ?? ''))
    if (tpl.suggested_icd10_code) setDiagnosisCode(tpl.suggested_icd10_code)
  }

  function updateRxRow(index: number, patch: Partial<RxRow>) {
    setRxRows(rows => rows.map((r, i) => i === index ? { ...r, ...patch } : r))
  }

  async function handleSubmit(formData: FormData) {
    if (submissionInFlight.current) return
    submissionInFlight.current = true
    setError(null)
    setSubmitting(true)
    const result = await completeConsultation(visitId, consultationId, formData)
    if (result && 'error' in result && result.error) {
      // "status: admitted" means the admit action already ran and changed the visit
      // status — this is actually success, not an error. Show the back-to-queue link.
      if (result.error.includes('admitted') || result.error.includes('status:')) {
        setAlreadyCompleted(true)
        setSubmitting(false)
        return
      }
      setError(result.error)
      setSubmitting(false)
      if (result.alreadyCompleted) {
        setAlreadyCompleted(true)
      } else {
        submissionInFlight.current = false
      }
    }
    // On success, completeConsultation redirects — component unmounts
  }

  const templatesByCategory = templates.reduce<Record<string, Template[]>>((acc, tpl) => {
    (acc[tpl.category] ??= []).push(tpl)
    return acc
  }, {})

  const icd10ByCategory = icd10Codes.reduce<Record<string, Icd10Code[]>>((acc, c) => {
    (acc[c.category] ??= []).push(c)
    return acc
  }, {})

  const proceduresByCategory = availableProcedures.reduce<Record<string, ProcedureOption[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p)
    return acc
  }, {})

  return (
    <form action={handleSubmit}>
      {/* Hidden SOAP fields */}
      <input type="hidden" name="subjective_notes" value={subjective} />
      <input type="hidden" name="examination_notes" value={objective} />
      <input type="hidden" name="diagnosis" value={diagnosis} />
      <input type="hidden" name="diagnosis_code" value={diagnosisCode} />
      <input type="hidden" name="treatment_plan" value={treatmentPlan} />

      {/* Template selector */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>{t.template}</label>
        <select value={selectedTemplateId} onChange={e => applyTemplate(e.target.value)} style={inputStyle}>
          <option value="">{t.noTemplate}</option>
          {Object.entries(templatesByCategory).map(([category, items]) => (
            <optgroup key={category} label={CATEGORY_LABELS_I18N[category]?.[lang] ?? category}>
              {items.map(tpl => (
                <option key={tpl.id} value={tpl.id}>
                  {(lang === 'en' && tpl.name_en) ? tpl.name_en : tpl.name_fr}
                  {tpl.age_group_label ? ` — ${tpl.age_group_label}` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          {t.templateHelper}
        </p>
      </div>

      {/* SOAP */}
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 8px' }}>{t.subjective}</p>
      <textarea value={subjective} onChange={e => setSubjective(e.target.value)} rows={3}
        placeholder={t.subjectivePh} style={{ ...inputStyle, resize: 'vertical', marginBottom: '1rem' }} />

      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 8px' }}>{t.objective}</p>
      <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={3}
        placeholder={t.objectivePh} style={{ ...inputStyle, resize: 'vertical', marginBottom: '1rem' }} />

      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 8px' }}>{t.assessment}</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
          placeholder={t.diagPh} style={{ ...inputStyle, flex: 2 }} />
        <select value={diagnosisCode} onChange={e => setDiagnosisCode(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}>
          <option value="">{t.icd}</option>
          {Object.entries(icd10ByCategory).map(([category, codes]) => (
            <optgroup key={category} label={category}>
              {codes.map(c => (
                <option key={c.code} value={c.code}>{c.code} — {c.description_fr}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 8px' }}>{t.plan}</p>
      <textarea value={treatmentPlan} onChange={e => setTreatmentPlan(e.target.value)} rows={2}
        placeholder={t.planPh} style={{ ...inputStyle, resize: 'vertical', marginBottom: '1.25rem' }} />

      {/* Prescription — one card per medication */}
      <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
        {t.prescription}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
        {rxRows.map((row, i) => {
          const selectedProduct = row.mode === 'catalog' ? products.find(p => p.id === row.productId) : null
          const allergyMatch = selectedProduct ? checkAllergyMatch(selectedProduct, patientAllergies) : null
          const outOfStock = selectedProduct && (selectedProduct.onHand ?? 0) === 0
          const lowStock = selectedProduct && !outOfStock && (selectedProduct.onHand ?? 0) < 10

          return (
            <div key={i} style={{
              border: allergyMatch ? '2px solid var(--color-critical-text)'
                : outOfStock ? '1px solid var(--color-critical-text)'
                : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              overflow: 'visible',
            }}>
              {/* Card header — product name + dosage info + × button */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '10px 12px 8px',
                borderBottom: '1px solid var(--color-border-subtle)',
                position: 'relative',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {row.mode === 'catalog' ? (
                    <>
                      <input type="hidden" name="rx_product_id" value={row.productId} />
                      <MedicationPicker
                        products={products}
                        value={row.productId}
                        onSelect={(id) => updateRxRow(i, { productId: id })}
                        lang={lang}
                      />
                      {/* Subtitle: generic name + dosage form + stock status + antibiotic tag */}
                      {selectedProduct && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                          {selectedProduct.genericName && (
                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                              {selectedProduct.genericName}
                            </span>
                          )}
                          {selectedProduct.dosageForm && (
                            <span style={{ fontSize: '12px', color: 'var(--color-accent)', fontWeight: 500 }}>
                              {selectedProduct.dosageForm}
                            </span>
                          )}
                          {selectedProduct.isAntibiotic && (
                            <span style={{
                              fontSize: '10px', padding: '1px 6px', borderRadius: '999px',
                              background: 'color-mix(in srgb, var(--color-warning-text) 12%, transparent)',
                              color: 'var(--color-warning-text)', fontWeight: 700,
                            }}>
                              {lang === 'fr' ? 'ANTIBIOTIQUE' : 'ANTIBIOTIC'}
                            </span>
                          )}
                          {outOfStock && (
                            <span style={{ fontSize: '11px', color: 'var(--color-critical-text)', fontWeight: 500 }}>
                              ⚠ {lang === 'fr' ? 'Épuisé — vérifier stock' : 'Out of stock — check pharmacy'}
                            </span>
                          )}
                          {lowStock && !outOfStock && (
                            <span style={{ fontSize: '11px', color: 'var(--color-warning-text)' }}>
                              ⚠ {lang === 'fr' ? `Stock faible (${selectedProduct.onHand ?? 0})` : `Low stock (${selectedProduct.onHand ?? 0})`}
                            </span>
                          )}
                          {!outOfStock && !lowStock && (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                              {selectedProduct.onHand ?? 0} {lang === 'fr' ? 'en stock' : 'in stock'}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Nudge toward free-text mode right where an out-of-
                          stock/off-catalog need would actually surface —
                          the toggle button alone (top-right of the card)
                          was easy to miss entirely. */}
                      {outOfStock && (
                        <button type="button" onClick={() => updateRxRow(i, { mode: 'freetext', productId: '', freetextName: selectedProduct?.name ?? '' })} style={{
                          fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none',
                          padding: '4px 0 0', cursor: 'pointer', textDecoration: 'underline',
                        }}>
                          {lang === 'fr' ? '→ Prescrire quand même (saisie libre)' : '→ Prescribe anyway (type manually)'}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <input
                        name="rx_freetext_name"
                        value={row.freetextName}
                        onChange={e => updateRxRow(i, { freetextName: e.target.value })}
                        placeholder={t.drugPh}
                        style={{
                          border: 'none', background: 'transparent', fontSize: '14px', fontWeight: 600,
                          color: 'var(--color-text-primary)', width: '100%', outline: 'none', padding: 0,
                        }}
                      />
                      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                        {t.freetextHint}
                      </p>
                    </>
                  )}
                  {row.mode === 'freetext' && <input type="hidden" name="rx_product_id" value="" />}
                  {row.mode === 'catalog' && <input type="hidden" name="rx_freetext_name" value="" />}
                </div>

                {/* Mode toggle + remove */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '12px', flexShrink: 0 }}>
                  <button type="button" onClick={() => updateRxRow(i, { mode: row.mode === 'catalog' ? 'freetext' : 'catalog', productId: '', freetextName: '' })} style={{
                    fontSize: '10px', padding: '3px 9px', borderRadius: '999px', cursor: 'pointer', whiteSpace: 'nowrap',
                    border: row.mode === 'freetext' ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                    background: row.mode === 'freetext' ? 'var(--color-accent)' : 'none',
                    color: row.mode === 'freetext' ? 'var(--color-accent-text-on)' : 'var(--color-text-secondary)',
                  }}>
                    {row.mode === 'catalog' ? t.typeManually : t.chooseFromStock}
                  </button>
                  <button type="button" onClick={() => setRxRows(rows => rows.filter((_, idx) => idx !== i))} style={{
                    fontSize: '14px', width: '24px', height: '24px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', borderRadius: '50%', border: 'none',
                    background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', lineHeight: 1,
                  }}>
                    ×
                  </button>
                </div>
              </div>

              {/* Allergy warning */}
              {allergyMatch && (
                <div style={{
                  background: 'var(--color-critical-bg)', padding: '6px 12px',
                  fontSize: '11px', color: 'var(--color-critical-text)', fontWeight: 500,
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}>
                  {t.allergyWarning(allergyMatch)}
                </div>
              )}

              {/* Fields row — auto-fit so on a phone this wraps onto two
                  rows (e.g. Dose/Frequency, then Duration/Qty/Instructions)
                  instead of squeezing 5 columns into ~60px each. */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '1px', background: 'var(--color-border-subtle)',
                borderTop: '1px solid var(--color-border-subtle)',
              }}>
                {[
                  { name: 'rx_dose', value: row.dose, key: 'dose', ph: t.dosePh },
                  { name: 'rx_frequency', value: row.frequency, key: 'frequency', ph: t.freqPh },
                  { name: 'rx_duration_days', value: row.durationDays, key: 'durationDays', ph: t.durPh },
                  { name: 'rx_quantity', value: row.quantity, key: 'quantity', ph: t.qtyPh },
                  { name: 'rx_instructions', value: (row as any).instructions ?? '', key: 'instructions', ph: lang === 'fr' ? 'Instructions patient' : 'Patient instructions' },
                ].map((field) => (
                  <input
                    key={field.key}
                    name={field.name}
                    value={field.value}
                    onChange={e => updateRxRow(i, { [field.key]: e.target.value } as any)}
                    placeholder={field.ph}
                    style={{
                      padding: '9px 12px', border: 'none',
                      fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)',
                      outline: 'none', width: '100%',
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <button type="button" onClick={() => setRxRows(rows => [...rows, emptyRxRow()])} style={{
        background: 'none', border: '1px dashed var(--color-border)', color: 'var(--color-accent)',
        padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', cursor: 'pointer',
        marginBottom: '1.25rem', width: '100%', textAlign: 'center',
      }}>
        {t.addDrug}
      </button>

      {/* Lab tests */}
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{t.labs}</p>
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px', marginBottom: '1rem' }}>
        {availablePanels.length === 0 && availableTests.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>{t.noLabs}</p>
        ) : (
          <>
            <input value={labSearchQuery} onChange={e => setLabSearchQuery(e.target.value)}
              placeholder={t.labSearch} style={{ ...inputStyle, marginBottom: '10px' }} />
            {(() => {
              const q = labSearchQuery.trim().toLowerCase()
              const matchedPanels = availablePanels.filter(p => p.name.toLowerCase().includes(q))
              const matchedTests = availableTests.filter(t => t.name.toLowerCase().includes(q))
              const testsByCategory = matchedTests.reduce<Record<string, LabOption[]>>((acc, t) => {
                (acc[t.category] ??= []).push(t); return acc
              }, {})
              return (
                <>
                  {matchedPanels.length > 0 && (
                    <details open={q.length > 0 || availablePanels.length <= 8} style={{ marginBottom: '8px' }}>
                      <summary style={{ fontSize: '12px', fontWeight: 500, cursor: 'pointer', padding: '4px 0' }}>
                        Panels ({matchedPanels.length})
                      </summary>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '6px 0 0 4px' }}>
                        {matchedPanels.map(p => (
                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                            <input type="checkbox" checked={selectedPanelIds.includes(p.id)}
                              onChange={e => setSelectedPanelIds(ids => e.target.checked ? [...ids, p.id] : ids.filter(i => i !== p.id))} />
                            {p.name}
                          </label>
                        ))}
                      </div>
                    </details>
                  )}
                  {Object.entries(testsByCategory).map(([category, tests]) => (
                    <details key={category} open={q.length > 0} style={{ marginBottom: '4px' }}>
                      <summary style={{ fontSize: '12px', fontWeight: 500, cursor: 'pointer', padding: '4px 0' }}>
                        {category} ({tests.length})
                      </summary>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '6px 0 0 4px' }}>
                        {tests.map(test => (
                          <label key={test.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                            <input type="checkbox" checked={selectedTestIds.includes(test.id)}
                              onChange={e => setSelectedTestIds(ids => e.target.checked ? [...ids, test.id] : ids.filter(i => i !== test.id))} />
                            {test.name}
                          </label>
                        ))}
                      </div>
                    </details>
                  ))}
                  {q.length > 0 && matchedPanels.length === 0 && Object.keys(testsByCategory).length === 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '6px 0' }}>
                      {t.noLabResults(labSearchQuery)}
                    </p>
                  )}
                </>
              )
            })()}
          </>
        )}
        {(selectedPanelIds.length > 0 || selectedTestIds.length > 0) && (
          <div style={{ fontSize: '11px', color: 'var(--color-accent)', margin: '8px 0 0' }}>
            {t.selected(selectedPanelIds.length + selectedTestIds.length)}
          </div>
        )}
        {/* External tests */}
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {t.extLab}
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
          <input value={externalTestInput} onChange={e => setExternalTestInput(e.target.value)}
            placeholder={t.extLabPh} style={{ ...inputStyle, flex: 1 }} />
          <button type="button" onClick={() => {
            if (externalTestInput.trim()) {
              setExternalTests(tests => [...tests, externalTestInput.trim()])
              setExternalTestInput('')
            }
          }} style={{
            fontSize: '12px', padding: '0 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer',
          }}>
            {t.add}
          </button>
        </div>
        {externalTests.map((name, i) => (
          <div key={i} style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '2px 0' }}>• {name}</div>
        ))}
        {selectedPanelIds.map(id => <input key={id} type="hidden" name="lab_panel_ids" value={id} />)}
        {selectedTestIds.map(id => <input key={id} type="hidden" name="lab_test_ids" value={id} />)}
        {externalTests.map((name, i) => <input key={i} type="hidden" name="lab_external_names" value={name} />)}
      </div>

      {/* Procedures — imaging, ECG, echocardiography, and any other
          non-consultation service_price. Same checkbox-list pattern as
          lab tests, grouped by category, each generating its own charge
          via add_consultation_procedure_charge on submit. */}
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{t.procedures}</p>
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px', marginBottom: '1.25rem' }}>
        {availableProcedures.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>{t.noProcedures}</p>
        ) : (
          Object.entries(proceduresByCategory).map(([category, procs]) => (
            <details key={category} open={proceduresByCategory && Object.keys(proceduresByCategory).length <= 3} style={{ marginBottom: '4px' }}>
              <summary style={{ fontSize: '12px', fontWeight: 500, cursor: 'pointer', padding: '4px 0' }}>
                {category} ({procs.length})
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px 0 0 4px' }}>
                {procs.map(proc => (
                  <label key={proc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="checkbox" checked={selectedProcedureIds.includes(proc.id)}
                        onChange={e => setSelectedProcedureIds(ids => e.target.checked ? [...ids, proc.id] : ids.filter(i => i !== proc.id))} />
                      {proc.service_name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                      {proc.price_xaf.toLocaleString(t.locale)} FCFA
                    </span>
                  </label>
                ))}
              </div>
            </details>
          ))
        )}
        {selectedProcedureIds.length > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--color-accent)', margin: '8px 0 0' }}>
            {t.procedureSelected(selectedProcedureIds.length)}
          </div>
        )}
        {selectedProcedureIds.map(id => <input key={id} type="hidden" name="procedure_ids" value={id} />)}
      </div>

      {/* Admit + referral */}
      <div style={{
        background: admitPatient ? 'var(--color-critical-bg)' : 'var(--color-surface)',
        border: admitPatient ? '1px solid var(--color-critical-text)' : '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: admitPatient ? 500 : 400, cursor: 'pointer' }}>
          <input type="checkbox" checked={admitPatient} onChange={e => setAdmitPatient(e.target.checked)} />
          {t.admit}
        </label>
        {admitPatient && (
          <>
            <textarea value={admissionReason} onChange={e => setAdmissionReason(e.target.value)}
              placeholder={t.admitPh} rows={2} style={{ ...inputStyle, resize: 'vertical', marginTop: '8px' }} />
            <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '6px 0 0' }}>{t.admitNote}</p>
          </>
        )}
        <input type="hidden" name="admit_patient" value={admitPatient ? 'true' : ''} />
        <input type="hidden" name="admission_reason" value={admissionReason} />

        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '10px 0 6px' }}>
          {lang === 'fr' ? 'Actions supplémentaires' : 'Additional actions'}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <button type="button" onClick={() => setShowReferral(v => !v)} style={{
            fontSize: '12px', padding: '5px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: showReferral ? 'var(--color-surface)' : 'transparent',
            color: 'var(--color-accent)', cursor: 'pointer',
          }}>
            {showReferral
              ? (lang === 'fr' ? '↑ Fermer la référence' : '↑ Close referral')
              : (lang === 'fr' ? '+ Référer à un spécialiste' : '+ Refer to specialist')}
          </button>
        </div>
        {showReferral && (
          <ReferralForm visitId={visitId} consultationId={consultationId} patientId={patientId} onDone={() => setShowReferral(false)} />
        )}
      </div>

      {error && (
        <p role="alert" style={{
          fontSize: '13px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)',
          padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem',
        }}>
          {error}
        </p>
      )}
      {alreadyCompleted && (
        <a href="/doctor" style={{
          display: 'inline-block', fontSize: '13px', color: 'var(--color-accent)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          padding: '8px 16px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', marginBottom: '1rem',
        }}>
          {t.backToQueue}
        </a>
      )}
      {submitting && (
        <p style={{
          fontSize: '13px', color: 'var(--color-accent)', background: 'var(--color-success-bg)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontWeight: 500,
        }}>
          {t.processingNote}
        </p>
      )}
      {!alreadyCompleted && (
        <button type="submit" disabled={submitting} style={{
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
          border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-sm)',
          fontSize: '14px', fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.6 : 1,
        }}>
          {submitting ? t.processing : t.finish}
        </button>
      )}
    </form>
  )
}