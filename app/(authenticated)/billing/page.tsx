// app/(authenticated)/billing/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'
import OpenShiftForm from '@/components/OpenShiftForm'
import CloseShiftForm from '@/components/CloseShiftForm'
import BillingTabs from '@/components/BillingTabs'
import CashierCollectForm from '@/components/CashierCollectForm'
import DiscountApprovalRow from '@/components/DiscountApprovalRow'
import ShiftVarianceRow from '@/components/ShiftVarianceRow'
import PatientAccountTab from '@/components/PatientAccountTab'
import InsuranceTab from '@/components/InsuranceTab'
import InsuranceAgingReport from '@/components/InsuranceAgingReport'

export default async function BillingPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const rpcErrors: string[] = []

  const { data: queueRows, error: queueError } = await supabase.rpc('cashier_queue_summary', { p_clinic_id: staff.clinicId })
  if (queueError) rpcErrors.push(`cashier_queue_summary: ${queueError.message}`)

  // Confirmed via create_payment's actual source: cashier_shifts uses a
  // status column ('open'/closed), not a closed_at timestamp — my
  // earlier guess was wrong, fixed now that the real function body
  // revealed the actual column.
  const { data: currentShift, error: shiftError } = await supabase
    .from('cashier_shifts')
    .select('id, opening_cash_xaf, opened_at')
    .eq('staff_id', staff.staffId)
    .eq('status', 'open')
    .maybeSingle()
  if (shiftError) rpcErrors.push(`cashier_shifts lookup: ${shiftError.message}`)

  const todayStart = new Date()
  todayStart.setUTCHours(-1, 0, 0, 0)

  const { data: todayPayments } = await supabase
    .from('payments')
    .select('total_amount_xaf')
    .eq('clinic_id', staff.clinicId)
    .eq('status', 'completed')
    .gte('created_at', todayStart.toISOString())

  const totalRevenueToday = (todayPayments ?? []).reduce((sum, p) => sum + Number(p.total_amount_xaf), 0)

  const totalOutstanding = (queueRows ?? []).reduce((sum: number, r: any) => sum + Number(r.balance_xaf), 0)
  const patientsInQueue = (queueRows ?? []).length
  const emergencyRows = (queueRows ?? []).filter((r: any) => r.has_emergency)

  // Approvals: pending discounts — neither approved nor rejected yet.
  // discounts has TWO foreign keys to staff (requested_by, approved_by),
  // which makes Supabase's nested join syntax genuinely ambiguous
  // without knowing the real constraint name — fetching the raw IDs and
  // resolving names separately avoids guessing at that name.
  const { data: pendingDiscounts, error: discountsError } = await supabase
    .from('discounts')
    .select('id, discount_amount_xaf, reason, created_at, service_charge_id, requested_by, service_charges(description)')
    .is('approved_at', null)
    .is('rejected_reason', null)
    .order('created_at', { ascending: true })
  if (discountsError) rpcErrors.push(`discounts (approvals): ${discountsError.message}`)

  const requesterIds = [...new Set((pendingDiscounts ?? []).map((d) => d.requested_by))]
  const { data: requesters } = requesterIds.length > 0
    ? await supabase.from('staff').select('id, full_name').in('id', requesterIds)
    : { data: [] }
  const requesterNameById = new Map((requesters ?? []).map((s) => [s.id, s.full_name]))

  // Reconciliation: closed shifts flagged for review. Same ambiguous-FK
  // concern as discounts (staff_id and reviewed_by both reference
  // staff) — resolving names separately rather than guessing a
  // constraint name.
  const { data: shiftsNeedingReview, error: shiftsError } = await supabase
    .from('cashier_shifts')
    .select('id, staff_id, opening_cash_xaf, closing_cash_xaf, expected_cash_xaf, variance_xaf, closed_at, notes')
    .eq('requires_review', true)
    .is('reviewed_at', null)
    .order('closed_at', { ascending: false })
  if (shiftsError) rpcErrors.push(`cashier_shifts (reconciliation): ${shiftsError.message}`)

  const shiftStaffIds = [...new Set((shiftsNeedingReview ?? []).map((s) => s.staff_id))]
  const { data: shiftStaff } = shiftStaffIds.length > 0
    ? await supabase.from('staff').select('id, full_name').in('id', shiftStaffIds)
    : { data: [] }
  const shiftStaffNameById = new Map((shiftStaff ?? []).map((s) => [s.id, s.full_name]))

  // Revenue: clinic-wide daily revenue, 30 days.
  const { data: dailyRevenue, error: revenueError } = await supabase.rpc('clinic_daily_revenue', { p_clinic_id: staff.clinicId, p_days: 30 })
  if (revenueError) rpcErrors.push(`clinic_daily_revenue: ${revenueError.message}`)

  // Receipts: recent payments, printable.
  const { data: recentPayments, error: paymentsListError } = await supabase
    .from('payments')
    .select('id, total_amount_xaf, status, created_at, patients(full_name, patient_code)')
    .eq('clinic_id', staff.clinicId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (paymentsListError) rpcErrors.push(`payments (receipts): ${paymentsListError.message}`)

  const approvalsContent = (
    <div>
      {(!pendingDiscounts || pendingDiscounts.length === 0) ? (
        <p style={{ fontSize: '13px', color: 'var(--color-success-text)' }}>{lang === 'fr' ? 'Aucune remise en attente.' : 'No discounts pending.'}</p>
      ) : (
        pendingDiscounts.map((d: any) => (
          <DiscountApprovalRow
            key={d.id}
            discount={{
              id: d.id,
              discount_amount_xaf: d.discount_amount_xaf,
              reason: d.reason,
              created_at: d.created_at,
              requester_name: requesterNameById.get(d.requested_by) ?? '—',
              charge_description: d.service_charges?.description ?? '—',
            }}
          />
        ))
      )}
    </div>
  )

  const reconciliationContent = (
    <div>
      {(!shiftsNeedingReview || shiftsNeedingReview.length === 0) ? (
        <p style={{ fontSize: '13px', color: 'var(--color-success-text)' }}>{lang==='fr'?'Aucun écart de caisse à examiner.':'No cash variances to review.'}</p>
      ) : (
        shiftsNeedingReview.map((s: any) => (
          <ShiftVarianceRow
            key={s.id}
            shift={{
              id: s.id,
              staff_name: shiftStaffNameById.get(s.staff_id) ?? '—',
              opening_cash_xaf: s.opening_cash_xaf,
              closing_cash_xaf: s.closing_cash_xaf,
              expected_cash_xaf: s.expected_cash_xaf,
              variance_xaf: s.variance_xaf,
              closed_at: s.closed_at,
              notes: s.notes,
            }}
          />
        ))
      )}
    </div>
  )

  const revenueContent = (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '8px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>
        <span>Date</span><span style={{ textAlign: 'right' }}>{lang==='fr'?'Recettes':'Revenue'}</span><span style={{ textAlign: 'right' }}>Transactions</span>
      </div>
      {(dailyRevenue ?? []).map((d: any, i: number) => (
        <div key={d.report_date} style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '8px 14px', fontSize: '13px',
          borderBottom: i < (dailyRevenue?.length ?? 0) - 1 ? '1px solid var(--color-border-subtle)' : 'none',
          opacity: Number(d.revenue_xaf) === 0 ? 0.5 : 1,
        }}>
          <span>{d.report_date}</span>
          <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Number(d.revenue_xaf).toLocaleString(locale)} FCFA</span>
          <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{d.transaction_count}</span>
        </div>
      ))}
    </div>
  )

  const receiptsContent = (
    <div>
      {(!recentPayments || recentPayments.length === 0) ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucun paiement enregistré.':'No payments recorded.'}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {recentPayments.map((p: any, i: number) => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', fontSize: '13px',
              borderBottom: i < recentPayments.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              opacity: p.status === 'reversed' ? 0.5 : 1,
            }}>
              <span>
                {p.patients?.full_name} <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>({p.patients?.patient_code})</span>
                {' · '}{new Date(p.created_at).toLocaleDateString(locale)}
                {p.status === 'reversed' && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--color-critical-text)' }}>{lang==='fr'?'ANNULÉ':'CANCELLED'}</span>}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{Number(p.total_amount_xaf).toLocaleString(locale)} FCFA</span>
                <a href={`/print/payments/${p.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--color-accent)' }}>{lang==='fr'?'Imprimer →':'Print →'}</a>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // For the cashier queue: find which patients have active insurance
  // so we can show the split (patient portion vs insurer portion) clearly.
  const queuePatientIds = (queueRows ?? []).map((r: any) => r.patient_id)
  const { data: patientInsuranceData } = queuePatientIds.length > 0
    ? await supabase
        .from('patient_insurance')
        .select('patient_id, policy_number, policyholder_name, insurers(name, coverage_percentage)')
        .in('patient_id', queuePatientIds)
        .eq('is_active', true)
    : { data: [] }

  const insuranceByPatient = new Map(
    (patientInsuranceData ?? []).map((pi: any) => [pi.patient_id, pi])
  )

  // Outstanding insurer totals — charges with insurer_portion_xaf that
  // haven't been bundled into a claim yet. Shown on the Insurance tab
  // as a call-to-action rather than buried in claim history.
  const { data: outstandingByInsurer } = await supabase
    .from('service_charges')
    .select('insurer_id, insurer_portion_xaf, insurers(name)')
    .eq('clinic_id', staff.clinicId)
    .in('status', ['pending', 'partial', 'paid'])
    .not('insurer_id', 'is', null)
    .not('insurer_portion_xaf', 'is', null)

  // Group by insurer: sum unclaimed portions
  const outstandingMap = new Map<string, { name: string; total: number }>()
  for (const sc of outstandingByInsurer ?? []) {
    const key = (sc as any).insurer_id
    const existing = outstandingMap.get(key) ?? { name: (sc as any).insurers?.name ?? '—', total: 0 }
    existing.total += Number((sc as any).insurer_portion_xaf ?? 0)
    outstandingMap.set(key, existing)
  }
  const outstandingInsurers = Array.from(outstandingMap.entries()).map(([id, v]) => ({ insurer_id: id, ...v }))
  const totalOutstandingInsurer = outstandingInsurers.reduce((s, r) => s + r.total, 0)

  const { data: insurersData } = await supabase
    .from('insurers')
    .select('id, name, payer_type, coverage_percentage, is_active')
    .eq('clinic_id', staff.clinicId)
    .eq('is_active', true)
    .order('name')

  // insurance_claims has a single FK to insurers — safe direct join,
  // no ambiguity risk like the staff-table cases found earlier.
  const { data: claimsData } = await supabase
    .from('insurance_claims')
    .select('id, claim_number, status, total_claimed_xaf, total_approved_xaf, submitted_at, created_at, insurers(name)')
    .eq('clinic_id', staff.clinicId)
    .order('created_at', { ascending: false })

  const insuranceContent = (
    <InsuranceTab
      insurers={insurersData ?? []}
      outstandingInsurers={outstandingInsurers}
      claims={(claimsData ?? []).map((c: any) => ({
        id: c.id,
        claim_number: c.claim_number,
        status: c.status,
        total_claimed_xaf: c.total_claimed_xaf,
        total_approved_xaf: c.total_approved_xaf,
        submitted_at: c.submitted_at,
        created_at: c.created_at,
        insurer_name: c.insurers?.name ?? '—',
      }))}
    />
  )

  // ── Insurance aging report ──────────────────────────────────────────────
  const { data: agingRows } = await supabase.rpc('insurance_aging_summary', { p_clinic_id: staff.clinicId })
  // Fetch detail for each insurer that has receivables
  const detailByInsurer: Record<string, any[]> = {}
  for (const row of (agingRows ?? [])) {
    const { data: detail } = await supabase.rpc('insurance_aging_detail', {
      p_clinic_id: staff.clinicId,
      p_insurer_id: row.insurer_id,
    })
    detailByInsurer[row.insurer_id] = detail ?? []
  }
  const agingContent = <InsuranceAgingReport rows={agingRows ?? []} detailByInsurer={detailByInsurer} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{lang==='fr'?'Facturation & Caisse':'Billing & Cashier'}</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <a
            href={`/print/end-of-day/${new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
              textDecoration: 'none', background: 'var(--color-surface)',
            }}
          >
            📄 {lang==='fr'?'Rapport de fin de journée':'End-of-day report'}
          </a>
          {currentShift ? (
            <CloseShiftForm shiftId={currentShift.id} openingCash={currentShift.opening_cash_xaf} />
          ) : (
            <OpenShiftForm />
          )}
        </div>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        {lang==='fr'?"Grand livre patient, file d'attente caisse, reçus et contrôle de caisse":'Patient ledger, cashier queue, receipts and cash control'}
      </p>

      {rpcErrors.length > 0 && (
        <div style={{
          background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '12px',
        }}>
          <strong>{lang==='fr'?"Certaines données n'ont pas pu être chargées":'Some data could not be loaded'}</strong> — {lang==='fr'?'probablement une migration SQL non exécutée ou un nom de colonne à vérifier :':'likely a missing SQL migration or column name issue:'}
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            {rpcErrors.map((e, i) => <li key={i} style={{ fontFamily: 'var(--font-mono)' }}>{e}</li>)}
          </ul>
        </div>
      )}

      <StatCardRow>
        <StatCard label={lang==='fr'?'En attente (file)':'Queue balance'} value={`${totalOutstanding.toLocaleString(locale)} FCFA`} accent={totalOutstanding > 0 ? 'warning' : undefined} />
        <StatCard label={lang==='fr'?'Patients en file':'Patients in queue'} value={patientsInQueue} />
        <StatCard label={lang==='fr'?"Recettes aujourd'hui":'Revenue today'} value={`${totalRevenueToday.toLocaleString(locale)} FCFA`} />
        <StatCard label={lang==='fr'?'Caisse (session)':'Shift cash'} value={currentShift ? `${Number(currentShift.opening_cash_xaf).toLocaleString(locale)} FCFA` : '—'} />
        <StatCard label={lang==='fr'?'Dû par assureurs':'Insurer balances'} value={`${totalOutstandingInsurer.toLocaleString(locale)} FCFA`} accent={totalOutstandingInsurer > 0 ? 'warning' : undefined} />
      </StatCardRow>

      <BillingTabs
        lang={staff.preferredLanguage}
        queueContent={<QueueTable rows={queueRows ?? []} insuranceByPatient={insuranceByPatient} lang={lang} />}
        emergencyContent={<QueueTable rows={emergencyRows} emptyLabel={lang==='fr'?"Aucune visite d'urgence impayée.":'No unpaid emergency visits.'} insuranceByPatient={insuranceByPatient} lang={lang} />}
        accountContent={<PatientAccountTab />}
        insuranceContent={insuranceContent}
        agingContent={agingContent}
        approvalsContent={approvalsContent}
        reconciliationContent={reconciliationContent}
        revenueContent={revenueContent}
        receiptsContent={receiptsContent}
      />
    </div>
  )
}

function QueueTable({ rows, emptyLabel, insuranceByPatient, lang = 'fr' }: { rows: any[]; emptyLabel?: string; insuranceByPatient?: Map<string, any>; lang?: 'fr' | 'en' }) {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const resolvedEmptyLabel = emptyLabel ?? (lang === 'fr' ? 'Aucun patient en attente de paiement.' : 'No patients waiting for payment.')
  if (rows.length === 0) {
    return <p style={{ fontSize: '13px', color: 'var(--color-success-text)' }}>{resolvedEmptyLabel}</p>
  }

  const CATEGORY_COLOR: Record<string, { bg: string; text: string; label: { fr: string; en: string } }> = {
    consultation: { bg: 'var(--color-bg)',          text: 'var(--color-text-secondary)',  label: { fr: 'Consultation', en: 'Consultation' } },
    lab:          { bg: 'color-mix(in srgb, #3b82f6 10%, transparent)', text: '#1d4ed8', label: { fr: 'Laboratoire',  en: 'Laboratory' } },
    pharmacy:     { bg: 'color-mix(in srgb, #16a34a 10%, transparent)', text: '#15803d', label: { fr: 'Pharmacie',    en: 'Pharmacy' } },
    admission:    { bg: 'color-mix(in srgb, #9333ea 10%, transparent)', text: '#7e22ce', label: { fr: 'Hospitalisation', en: 'Inpatient' } },
    procedure:    { bg: 'color-mix(in srgb, #f59e0b 10%, transparent)', text: '#b45309', label: { fr: 'Acte',         en: 'Procedure' } },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {rows.map((r: any) => {
        const ins = insuranceByPatient?.get(r.patient_id)
        const insurer = ins?.insurers
        const charges: any[] = r.charges_json ?? []
        const balance = Number(r.balance_xaf)

        return (
          <div key={r.patient_id} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', overflow: 'hidden',
          }}>
            {/* Patient header */}
            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.patient_name}</span>
                {r.has_emergency && (
                  <span style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 7px', borderRadius: '999px', background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', fontWeight: 700 }}>
                    {lang === 'fr' ? 'URGENCE' : 'EMERGENCY'}
                  </span>
                )}
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '1px', fontFamily: 'var(--font-mono)' }}>
                  {r.patient_code}
                  {insurer && <span style={{ marginLeft: '8px', color: 'var(--color-accent)' }}>🛡 {insurer.name} · {insurer.coverage_percentage}%</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-critical-text)' }}>
                  {balance.toLocaleString(locale)} FCFA
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  {lang === 'fr' ? 'à encaisser' : 'to collect'}
                </div>
              </div>
            </div>

            {/* Charge breakdown */}
            <div style={{ padding: '8px 14px' }}>
              {charges.filter(c => Number(c.balance) > 0).map((c: any, ci: number) => {
                const cat = CATEGORY_COLOR[c.category] ?? CATEGORY_COLOR.consultation
                const visitDate = c.visit_date ? new Date(c.visit_date).toLocaleDateString(locale, { day: '2-digit', month: 'short' }) : null
                return (
                  <div key={c.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 0',
                    borderBottom: ci < charges.filter(x => Number(x.balance) > 0).length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontSize: '10px', padding: '1px 7px', borderRadius: '999px', whiteSpace: 'nowrap',
                        background: cat.bg, color: cat.text, fontWeight: 600,
                      }}>
                        {cat.label[lang]}
                      </span>
                      <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.description}
                      </span>
                      {!c.invoiced && (
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          ⚠ {lang === 'fr' ? 'Non facturé' : 'Uninvoiced'}
                        </span>
                      )}
                      {visitDate && (
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {visitDate}{c.visit_status === 'admitted' ? ` · ${lang === 'fr' ? 'Hospitalisé' : 'Admitted'}` : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500 }}>
                        {Number(c.balance).toLocaleString(locale)} FCFA
                      </span>
                      {Number(c.insurer_owes) > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                          + {Number(c.insurer_owes).toLocaleString(locale)} {lang === 'fr' ? 'assureur' : 'insurer'}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Insurance split summary + Collect button */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {insurer ? (
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>🛡 {insurer.name}</span>
                  {lang === 'fr' ? ' prend en charge ' : ' covers '}
                  <strong>{insurer.coverage_percentage}%</strong>
                  {' · '}
                  {lang === 'fr' ? 'Patient : ' : 'Patient: '}
                  <strong style={{ color: 'var(--color-accent)' }}>{balance.toLocaleString(locale)} FCFA</strong>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {charges.filter(c => !c.invoiced && Number(c.balance) > 0).length > 0 && (
                    <span style={{ color: 'var(--color-warning-text)' }}>
                      ⚠ {lang === 'fr'
                        ? `${charges.filter(c => !c.invoiced && Number(c.balance) > 0).length} frais hors facture`
                        : `${charges.filter(c => !c.invoiced && Number(c.balance) > 0).length} uninvoiced charge(s)`}
                    </span>
                  )}
                </div>
              )}
              <CashierCollectForm
                invoiceIds={(r.invoice_ids ?? []).filter(Boolean)}
                chargeIds={(r.charges_json ?? []).map((c: any) => c.id).filter(Boolean)}
                charges={(r.charges_json ?? [])
                  .filter((c: any) => Number(c.balance) > 0)
                  .map((c: any) => ({ id: c.id, invoice_id: c.invoice_id ?? null, balance: Number(c.balance) }))}
                balanceXaf={balance}
                patientId={r.patient_id}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
