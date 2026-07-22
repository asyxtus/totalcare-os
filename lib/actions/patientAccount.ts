// lib/actions/patientAccount.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export async function searchPatientsForAccount(query: string) {
  if (query.trim().length < 2) return []
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data } = await supabase
    .from('patients')
    .select('id, full_name, patient_code')
    .eq('clinic_id', staff.clinicId)
    .or(`full_name.ilike.%${query}%,patient_code.ilike.%${query}%`)
    .limit(8)

  return data ?? []
}

export async function getPatientAccountData(patientId: string) {
  const staff = await getCurrentStaff()
  const supabase = await createClient()

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id, full_name, patient_code, phone')
    .eq('id', patientId)
    .maybeSingle()

  if (patientError || !patient) return { error: 'Patient introuvable.' }

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_amount_xaf, created_at, invoice_items(id, service_charge_id, amount_xaf, service_charges(description, category, insurer_portion_xaf, patient_portion_xaf))')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  const invoiceIds = (invoices ?? []).map((inv) => inv.id)

  const { data: payments, error: paymentsError } = invoiceIds.length > 0
    ? await supabase
        .from('payments')
        .select('id, invoice_id, total_amount_xaf, status, created_at, payment_splits(method, amount_xaf)')
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null }

  if (invoicesError || paymentsError) {
    return { error: [invoicesError?.message, paymentsError?.message].filter(Boolean).join(' · ') }
  }

  const { data: depositBalance } = await supabase.rpc('get_patient_deposit_balance', {
    p_clinic_id: staff.clinicId,
    p_patient_id: patientId,
  })

  // patient_insurance has a single FK to insurers — safe direct join.
  const { data: activeInsurance } = await supabase
    .from('patient_insurance')
    .select('id, policy_number, policyholder_name, coverage_start_date, coverage_end_date, insurers(id, name, payer_type, coverage_percentage)')
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .maybeSingle()

  // Patient-facing balance must reflect only what the PATIENT owes, not
  // the full charge — matches the same fix already applied to
  // cashier_queue_summary. Computed per line item (not per invoice
  // total), since patient_portion_xaf lives on each service_charge.
  const totalCharged = (invoices ?? []).reduce((sum, inv: any) => {
    const invoiceTotal = (inv.invoice_items ?? []).reduce((itemSum: number, item: any) => {
      const portion = item.service_charges?.patient_portion_xaf
      return itemSum + Number(portion != null ? portion : item.amount_xaf)
    }, 0)
    return sum + invoiceTotal
  }, 0)
  const totalPaid = (payments ?? [])
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.total_amount_xaf), 0)
  const balance = totalCharged - totalPaid

  const { data: allInsurers } = await supabase
    .from('insurers')
    .select('id, name, payer_type')
    .eq('is_active', true)
    .order('name')

  return {
    patient,
    invoices: invoices ?? [],
    payments: payments ?? [],
    totals: { charged: totalCharged, paid: totalPaid, balance },
    depositBalance: Number(depositBalance ?? 0),
    activeInsurance: activeInsurance ? {
      id: activeInsurance.id,
      policy_number: activeInsurance.policy_number,
      policyholder_name: activeInsurance.policyholder_name,
      insurer_name: (activeInsurance.insurers as any)?.name ?? '—',
      payer_type: (activeInsurance.insurers as any)?.payer_type ?? '—',
      coverage_percentage: (activeInsurance.insurers as any)?.coverage_percentage ?? 0,
    } : null,
    allInsurers: allInsurers ?? [],
  }
}
