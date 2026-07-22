// app/print/claim/[id]/page.tsx
//
// Printable claim statement for submission to an insurer.
// Lists every service charge bundled in this claim, with patient details,
// dates, amounts, and the insurer portion. Designed to be stapled to
// supporting documents (consultation reports, lab results) when submitting.

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

const STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  draft:               { fr: 'Brouillon',              en: 'Draft' },
  submitted:           { fr: 'Soumise',                en: 'Submitted' },
  under_review:        { fr: 'En révision',             en: 'Under review' },
  approved:            { fr: 'Approuvée',              en: 'Approved' },
  partially_approved:  { fr: 'Partiellement approuvée', en: 'Partially approved' },
  denied:              { fr: 'Refusée',                en: 'Denied' },
  paid:                { fr: 'Payée',                  en: 'Paid' },
}

const CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  consultation: { fr: 'Consultation', en: 'Consultation' },
  lab:          { fr: 'Laboratoire', en: 'Laboratory' },
  pharmacy:     { fr: 'Pharmacie', en: 'Pharmacy' },
  admission:    { fr: 'Hospitalisation', en: 'Inpatient' },
}

export default async function PrintClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fmtMoney = (n: number) => n.toLocaleString(locale) + ' FCFA'

  const { data: claim } = await supabase
    .from('insurance_claims')
    .select(`
      id, claim_number, status, total_claimed_xaf, total_approved_xaf,
      submitted_at, created_at, notes,
      insurers(name, payer_type, coverage_percentage, contact_name, phone, email, address),
      created_by_staff:staff!created_by(full_name),
      submitted_by_staff:staff!submitted_by(full_name),
      clinics!clinic_id(name, city, quartier, phone)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!claim) notFound()

  const { data: items } = await supabase
    .from('insurance_claim_items')
    .select(`
      id, amount_xaf,
      service_charges(
        id, description, category, amount_xaf, insurer_portion_xaf, patient_portion_xaf,
        created_at,
        patients(full_name, patient_code, date_of_birth, estimated_age),
        patient_insurance(policy_number, policyholder_name)
      )
    `)
    .eq('claim_id', id)
    .order('id')

  const insurer = (claim as any).insurers
  const clinic = (claim as any).clinics
  const createdBy = (claim as any).created_by_staff
  const status = STATUS_LABELS[claim.status]?.[lang] ?? claim.status

  const byPatient = new Map<string, { patient: any; charges: any[] }>()
  for (const item of items ?? []) {
    const sc = (item as any).service_charges
    if (!sc) continue
    const patient = sc.patients
    const key = patient?.patient_code ?? 'unknown'
    if (!byPatient.has(key)) byPatient.set(key, { patient, charges: [] })
    byPatient.get(key)!.charges.push({ ...sc, claim_amount: item.amount_xaf })
  }

  const totalItems = items?.length ?? 0
  const totalClaimed = Number(claim.total_claimed_xaf)

  const L = {
    docTitle: lang === 'fr' ? "Réclamation d'assurance" : 'Insurance Claim',
    to: lang === 'fr' ? 'Destinataire' : 'To',
    coverage: lang === 'fr' ? 'Couverture' : 'Coverage',
    from: lang === 'fr' ? 'Émetteur' : 'From',
    preparedBy: lang === 'fr' ? 'Établi par' : 'Prepared by',
    submittedLbl: lang === 'fr' ? 'Soumise le' : 'Submitted',
    serviceCount: lang === 'fr' ? 'Nombre de prestations' : 'Number of services',
    totalBilled: lang === 'fr' ? 'Total facturé' : 'Total billed',
    insurerPortionClaimed: lang === 'fr' ? 'Part assureur réclamée' : 'Insurer portion claimed',
    approvedAmount: lang === 'fr' ? 'Montant approuvé' : 'Approved amount',
    serviceDetail: lang === 'fr' ? 'Détail des prestations' : 'Service Detail',
    policy: lang === 'fr' ? 'Police' : 'Policy',
    date: lang === 'fr' ? 'Date' : 'Date',
    service: lang === 'fr' ? 'Prestation' : 'Service',
    category: lang === 'fr' ? 'Catégorie' : 'Category',
    totalAmount: lang === 'fr' ? 'Montant total' : 'Total',
    insurerPortion: lang === 'fr' ? 'Part assureur' : 'Insurer',
    patientPortion: lang === 'fr' ? 'Part patient' : 'Patient',
    totalClaimedLbl: lang === 'fr' ? 'Total réclamé' : 'Total claimed',
    approved: lang === 'fr' ? 'Montant approuvé' : 'Approved',
    certification: lang === 'fr'
      ? 'Nous certifions que les prestations décrites ci-dessus ont été effectivement réalisées et facturées conformément aux tarifs en vigueur.'
      : 'We certify that the services described above were actually rendered and billed in accordance with current rates.',
    authorizedSignature: lang === 'fr' ? 'Signature autorisée' : 'Authorized signature',
    generated: lang === 'fr' ? 'Généré le' : 'Generated',
  }

  return (
    <div style={{ fontFamily: 'Georgia, serif', color: '#1a2820', maxWidth: '720px', margin: '0 auto', padding: '0 16px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '3px solid #2F6F62', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{clinic?.name}</h1>
          <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
            {clinic?.quartier}, {clinic?.city}{clinic?.phone ? ` · ${clinic.phone}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#2F6F62' }}>
            {L.docTitle}
          </p>
          <p style={{ fontSize: '14px', fontFamily: 'monospace', margin: '4px 0 0', color: '#2F6F62' }}>
            {claim.claim_number}
          </p>
          <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
            {fmtDate(claim.created_at)}
          </p>
          <span style={{
            display: 'inline-block', marginTop: '6px',
            fontSize: '11px', padding: '2px 10px', borderRadius: '999px',
            background: claim.status === 'paid' ? '#17251F' : claim.status === 'submitted' ? '#2A2015' : '#1C2620',
            color: claim.status === 'paid' ? '#4C9A7E' : claim.status === 'submitted' ? '#D9A55C' : '#9AA79F',
          }}>
            {status}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#F4F7F5', padding: '12px 14px', borderRadius: '6px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5C6B65', margin: '0 0 6px' }}>
            {L.to}
          </p>
          <p style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 2px' }}>{insurer?.name}</p>
          <p style={{ fontSize: '12px', color: '#5C6B65', margin: '2px 0' }}>
            {L.coverage}: <strong>{insurer?.coverage_percentage}%</strong>
          </p>
          {insurer?.contact_name && <p style={{ fontSize: '12px', margin: '2px 0' }}>{insurer.contact_name}</p>}
          {insurer?.phone && <p style={{ fontSize: '12px', color: '#5C6B65', margin: '2px 0' }}>{insurer.phone}</p>}
          {insurer?.email && <p style={{ fontSize: '12px', color: '#5C6B65', margin: '2px 0' }}>{insurer.email}</p>}
          {insurer?.address && <p style={{ fontSize: '12px', color: '#5C6B65', margin: '2px 0' }}>{insurer.address}</p>}
        </div>
        <div style={{ background: '#F4F7F5', padding: '12px 14px', borderRadius: '6px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5C6B65', margin: '0 0 6px' }}>
            {L.from}
          </p>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{clinic?.name}</p>
          <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
            {clinic?.quartier}, {clinic?.city}
          </p>
          {createdBy && (
            <p style={{ fontSize: '12px', margin: '4px 0 0' }}>
              {L.preparedBy}: {createdBy.full_name}
            </p>
          )}
          {claim.submitted_at && (
            <p style={{ fontSize: '12px', color: '#5C6B65', margin: '4px 0 0' }}>
              {L.submittedLbl}: {fmtDate(claim.submitted_at)}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {[
          { label: L.serviceCount, value: String(totalItems) },
          { label: L.totalBilled, value: fmtMoney(totalClaimed) },
          { label: L.insurerPortionClaimed, value: fmtMoney(totalClaimed) },
          { label: L.approvedAmount, value: claim.total_approved_xaf != null ? fmtMoney(Number(claim.total_approved_xaf)) : '—' },
        ].map((card, i) => (
          <div key={i} style={{ background: '#F4F7F5', padding: '10px 12px', borderRadius: '6px', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: '#5C6B65', margin: '0 0 4px' }}>{card.label}</p>
            <p style={{ fontSize: '14px', fontWeight: 700, margin: 0, fontFamily: i > 0 ? 'monospace' : 'inherit' }}>{card.value}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#2F6F62', borderBottom: '1.5px solid #2F6F62', paddingBottom: '4px', margin: '0 0 12px' }}>
        {L.serviceDetail}
      </p>

      {Array.from(byPatient.entries()).map(([code, { patient, charges }]) => {
        const pi = charges[0]?.patient_insurance
        const patientTotal = charges.reduce((s, c) => s + Number(c.insurer_portion_xaf ?? c.claim_amount), 0)
        return (
          <div key={code} style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #DCE3DE' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{patient?.full_name}</span>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#5C6B65', marginLeft: '10px' }}>{patient?.patient_code}</span>
                {pi?.policy_number && (
                  <span style={{ fontSize: '12px', color: '#5C6B65', marginLeft: '10px' }}>
                    {L.policy}: {pi.policy_number}
                  </span>
                )}
                {pi?.policyholder_name && (
                  <span style={{ fontSize: '11px', color: '#5C6B65', marginLeft: '8px' }}>
                    ({pi.policyholder_name})
                  </span>
                )}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>
                {fmtMoney(patientTotal)}
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ color: '#5C6B65' }}>
                  <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 500 }}>{L.date}</th>
                  <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 500 }}>{L.service}</th>
                  <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 500 }}>{L.category}</th>
                  <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 500 }}>{L.totalAmount}</th>
                  <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 500 }}>{L.insurerPortion}</th>
                  <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 500 }}>{L.patientPortion}</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #E8EDEB' }}>
                    <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontSize: '11px' }}>
                      {fmtDate(c.created_at)}
                    </td>
                    <td style={{ padding: '5px 6px' }}>{c.description}</td>
                    <td style={{ padding: '5px 6px', color: '#5C6B65' }}>
                      {CATEGORY_LABELS[c.category]?.[lang] ?? c.category}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {Number(c.amount_xaf).toLocaleString(locale)}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                      {Number(c.insurer_portion_xaf ?? c.claim_amount).toLocaleString(locale)}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#5C6B65' }}>
                      {Number(c.patient_portion_xaf ?? (c.amount_xaf - (c.insurer_portion_xaf ?? c.claim_amount))).toLocaleString(locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      <div style={{ borderTop: '2px solid #2F6F62', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
        <table style={{ fontSize: '13px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '3px 16px 3px 0', color: '#5C6B65' }}>{L.totalClaimedLbl}</td>
              <td style={{ padding: '3px 0', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}>{fmtMoney(totalClaimed)}</td>
            </tr>
            {claim.total_approved_xaf != null && (
              <tr>
                <td style={{ padding: '3px 16px 3px 0', color: '#5C6B65' }}>{L.approved}</td>
                <td style={{ padding: '3px 0', fontFamily: 'monospace', color: '#2F6F62', fontWeight: 700, textAlign: 'right' }}>{fmtMoney(Number(claim.total_approved_xaf))}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {claim.notes && (
        <div style={{ marginBottom: '24px', padding: '10px 14px', background: '#F4F7F5', borderRadius: '6px' }}>
          <p style={{ fontSize: '11px', color: '#5C6B65', margin: '0 0 4px' }}>Notes</p>
          <p style={{ fontSize: '13px', margin: 0 }}>{claim.notes}</p>
        </div>
      )}

      <p style={{ fontSize: '12px', color: '#5C6B65', fontStyle: 'italic', marginBottom: '32px' }}>
        {L.certification}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '12px', margin: '0 0 40px', color: '#5C6B65' }}>
            {L.authorizedSignature}
          </p>
          <div style={{ borderTop: '1px solid #1a2820', paddingTop: '6px', minWidth: '200px' }}>
            <p style={{ fontSize: '13px', margin: 0 }}>{clinic?.name}</p>
          </div>
        </div>
        <p style={{ fontSize: '10px', color: '#5C6B65', textAlign: 'right' }}>
          {clinic?.name} · {claim.claim_number}<br />
          {L.generated}: {fmtDate(new Date().toISOString())}
        </p>
      </div>
    </div>
  )
}
