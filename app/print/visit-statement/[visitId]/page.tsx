// app/print/visit-statement/[visitId]/page.tsx
//
// One printable document for the whole visit — every service_charge tied
// to the visit, whether it's already sitting on an invoice or still
// uninvoiced. This is the "one paper to hand to the patient/insurer"
// document: a consultation may generate a consultation-fee invoice, then
// pick up a lab charge and a pharmacy charge along the way, each on its
// own invoice or none at all. Patients and insurers want ONE statement
// for the visit, not three separate slips.
//
// This is Option A from the design discussion: a print-only bundle. It
// does NOT touch the underlying invoice/invoice_items records — payment
// history and reconciliation stay exactly as they are. It's purely a
// combined READ across everything for the visit, rendered as one document.

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import PrintButton from '@/components/PrintButton'

const CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  consultation: { fr: 'Consultation', en: 'Consultation' },
  lab: { fr: 'Laboratoire', en: 'Laboratory' },
  pharmacy: { fr: 'Pharmacie', en: 'Pharmacy' },
  admission: { fr: 'Hospitalisation', en: 'Inpatient' },
  procedure: { fr: 'Acte', en: 'Procedure' },
}

export default async function PrintVisitStatementPage({
  params,
}: {
  params: Promise<{ visitId: string }>
}) {
  const { visitId } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const fmt = (n: number) => Number(n).toLocaleString(locale)

  const { data: visit, error } = await supabase
    .from('visits')
    .select(`
      id, created_at, visit_reason,
      clinics(name, city, quartier, phone),
      patients(full_name, patient_code, date_of_birth, estimated_age, sex)
    `)
    .eq('id', visitId)
    .maybeSingle()

  if (error || !visit) notFound()

  const clinic = (visit as any).clinics
  const patient = (visit as any).patients

  // Every charge tied to this visit, invoiced or not — this is the bundle.
  const { data: charges } = await supabase
    .from('service_charges')
    .select(`
      id, description, category, amount_xaf, patient_portion_xaf, insurer_portion_xaf,
      amount_paid_xaf, status, created_at,
      invoice_items(invoice_id, invoices(invoice_number))
    `)
    .eq('visit_id', visitId)
    .order('created_at', { ascending: true })

  const rows = (charges ?? []).map((c: any) => {
    const ii = Array.isArray(c.invoice_items) ? c.invoice_items[0] : c.invoice_items
    return {
      id: c.id,
      description: c.description,
      category: c.category,
      amount: Number(c.amount_xaf),
      patientPortion: Number(c.patient_portion_xaf ?? c.amount_xaf),
      insurerPortion: Number(c.insurer_portion_xaf ?? 0),
      paid: Number(c.amount_paid_xaf ?? 0),
      status: c.status,
      invoiceNumber: ii?.invoices?.invoice_number ?? null,
      createdAt: c.created_at,
    }
  })

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0)
  const totalPatientPortion = rows.reduce((s, r) => s + r.patientPortion, 0)
  const totalInsurerPortion = rows.reduce((s, r) => s + r.insurerPortion, 0)
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
  const totalBalance = totalPatientPortion - totalPaid

  const L = {
    title: lang === 'fr' ? 'Relevé de visite' : 'Visit Statement',
    dob: lang === 'fr' ? 'Né(e) le' : 'DOB',
    estAge: lang === 'fr' ? 'ans (estimé)' : 'yrs (estimated)',
    reason: lang === 'fr' ? 'Motif' : 'Reason',
    visitDate: lang === 'fr' ? 'Date de visite' : 'Visit date',
    description: lang === 'fr' ? 'Description' : 'Description',
    category: lang === 'fr' ? 'Catégorie' : 'Category',
    invoiceRef: lang === 'fr' ? 'Facture' : 'Invoice',
    amount: lang === 'fr' ? 'Montant' : 'Amount',
    patientPortion: lang === 'fr' ? 'Part patient' : 'Patient portion',
    insurerPortion: lang === 'fr' ? 'Part assureur' : 'Insurer portion',
    paid: lang === 'fr' ? 'Payé' : 'Paid',
    uninvoiced: lang === 'fr' ? 'Non facturé' : 'Uninvoiced',
    total: lang === 'fr' ? 'TOTAL' : 'TOTAL',
    balanceDue: lang === 'fr' ? 'Solde dû par le patient' : 'Balance due from patient',
    insurerOwes: lang === 'fr' ? "Part à réclamer à l'assureur" : 'Portion to claim from insurer',
    fullyPaid: lang === 'fr' ? '✓ Entièrement payé' : '✓ Fully paid',
    noCharges: lang === 'fr' ? 'Aucun frais enregistré pour cette visite.' : 'No charges recorded for this visit.',
    footer: lang === 'fr'
      ? 'Ce relevé regroupe tous les frais de la visite, qu\'ils soient déjà facturés séparément ou non — il ne remplace pas les factures et reçus individuels déjà émis.'
      : 'This statement combines every charge from the visit, whether separately invoiced or not — it does not replace individual invoices/receipts already issued.',
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontSize: '10px', textTransform: 'uppercase', borderBottom: '2px solid #333', color: '#555' }
  const td: React.CSSProperties = { padding: '7px 8px', fontSize: '13px', borderBottom: '1px solid #ddd' }
  const tdRight: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'monospace' }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif', color: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #111', paddingBottom: '12px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px' }}>{clinic?.name}</h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#555' }}>
            {[clinic?.quartier, clinic?.city].filter(Boolean).join(', ')}{clinic?.phone ? ` · ${clinic.phone}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{L.title}</p>
          <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
            {L.visitDate}: {new Date(visit.created_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', margin: '0 0 2px' }}><strong>{patient?.full_name}</strong></p>
        <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>
          {patient?.patient_code}
          {patient?.date_of_birth
            ? ` · ${L.dob}: ${new Date(patient.date_of_birth).toLocaleDateString(locale)}`
            : patient?.estimated_age
            ? ` · ${patient.estimated_age} ${L.estAge}`
            : ''}
          {patient?.sex ? ` · ${patient.sex}` : ''}
        </p>
        {visit.visit_reason && (
          <p style={{ fontSize: '13px', color: '#555', margin: '4px 0 0' }}>{L.reason}: {visit.visit_reason}</p>
        )}
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#555' }}>{L.noCharges}</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr>
                <th style={th}>{L.description}</th>
                <th style={th}>{L.category}</th>
                <th style={th}>{L.invoiceRef}</th>
                <th style={{ ...th, textAlign: 'right' }}>{L.amount}</th>
                <th style={{ ...th, textAlign: 'right' }}>{L.patientPortion}</th>
                <th style={{ ...th, textAlign: 'right' }}>{L.paid}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={td}>{r.description}</td>
                  <td style={td}>{CATEGORY_LABELS[r.category]?.[lang] ?? r.category}</td>
                  <td style={td}>
                    {r.invoiceNumber ?? (
                      <span style={{ color: '#b45309', fontSize: '11px' }}>⚠ {L.uninvoiced}</span>
                    )}
                  </td>
                  <td style={tdRight}>{fmt(r.amount)}</td>
                  <td style={tdRight}>{fmt(r.patientPortion)}</td>
                  <td style={tdRight}>{fmt(r.paid)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700, borderTop: '2px solid #333' }} colSpan={3}>{L.total}</td>
                <td style={{ ...tdRight, fontWeight: 700, borderTop: '2px solid #333' }}>{fmt(totalAmount)}</td>
                <td style={{ ...tdRight, fontWeight: 700, borderTop: '2px solid #333' }}>{fmt(totalPatientPortion)}</td>
                <td style={{ ...tdRight, fontWeight: 700, borderTop: '2px solid #333' }}>{fmt(totalPaid)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ flex: 1, border: `2px solid ${totalBalance > 0 ? '#b91c1c' : '#16a34a'}`, borderRadius: '6px', padding: '12px 16px', background: totalBalance > 0 ? '#fef2f2' : '#f0fdf4' }}>
              <p style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', color: totalBalance > 0 ? '#991b1b' : '#166534' }}>
                {totalBalance > 0 ? L.balanceDue : L.fullyPaid}
              </p>
              {totalBalance > 0 && (
                <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 700, fontFamily: 'monospace', color: '#991b1b' }}>{fmt(totalBalance)} FCFA</p>
              )}
            </div>
            {totalInsurerPortion > 0 && (
              <div style={{ flex: 1, border: '2px solid #2563eb', borderRadius: '6px', padding: '12px 16px', background: '#eff6ff' }}>
                <p style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', color: '#1e40af' }}>{L.insurerOwes}</p>
                <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 700, fontFamily: 'monospace', color: '#1e40af' }}>{fmt(totalInsurerPortion)} FCFA</p>
              </div>
            )}
          </div>
        </>
      )}

      <p style={{ fontSize: '10px', color: '#999', marginTop: '24px' }}>{L.footer}</p>

      <div className="no-print" style={{ marginTop: '24px', textAlign: 'center' }}>
        <PrintButton lang={lang} />
      </div>
    </div>
  )
}
