// app/(authenticated)/admissions/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { StatCard, StatCardRow } from '@/components/dashboard/StatCard'
import AdmissionsTabs from '@/components/AdmissionsTabs'
import AdmissionQueueRow from '@/components/AdmissionQueueRow'
import DischargeRow from '@/components/DischargeRow'
import AdmissionListRow from '@/components/AdmissionListRow'
import NewAdmissionForm from '@/components/NewAdmissionForm'
import WardsTable from '@/components/WardsTable'
import BedsTable from '@/components/BedsTable'
import BedMap from '@/components/BedMap'

function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`
}

export default async function AdmissionsPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const DISCHARGE_TYPE_LABELS: Record<string, string> = {
    routine: lang === 'fr' ? 'Routine' : 'Routine',
    transfer_out: lang === 'fr' ? 'Transfert' : 'Transfer',
    against_medical_advice: lang === 'fr' ? 'Contre avis médical' : 'Against medical advice',
    deceased: lang === 'fr' ? 'Décès' : 'Deceased',
  }

  const rpcErrors: string[] = []

  const { data: occupancyRows, error: occupancyError } = await supabase.rpc('bed_occupancy_summary', { p_clinic_id: staff.clinicId })
  if (occupancyError) rpcErrors.push(`bed_occupancy_summary: ${occupancyError.message}`)
  const occupancy = occupancyRows?.[0]

  const { data: awaitingBed, error: awaitingError } = await supabase
    .from('admissions')
    .select('id, admission_number, source, admission_reason, recommended_at, patients(full_name)')
    .eq('status', 'awaiting_bed')
    .order('recommended_at', { ascending: true })
  if (awaitingError) rpcErrors.push(`admissions (awaiting_bed): ${awaitingError.message}`)

  const { data: admitted, error: admittedError } = await supabase
    .from('admissions')
    .select('id, admission_number, bed_assigned_at, patients(full_name), wards(name), beds(bed_number)')
    .eq('status', 'admitted')
    .order('bed_assigned_at', { ascending: false })
  if (admittedError) rpcErrors.push(`admissions (admitted): ${admittedError.message}`)

  const { data: allAdmissions, error: allAdmissionsError } = await supabase
    .from('admissions')
    .select('id, admission_number, source, status, recommended_at, patients(full_name), wards(name), beds(bed_number)')
    .order('recommended_at', { ascending: false })
  if (allAdmissionsError) rpcErrors.push(`admissions (all): ${allAdmissionsError.message}`)

  const { data: discharges, error: dischargesError } = await supabase
    .from('admissions')
    .select('id, admission_number, discharge_type, discharge_outcome, discharged_at, patients(full_name, phone), wards(name)')
    .eq('status', 'discharged')
    .order('discharged_at', { ascending: false })
  if (dischargesError) rpcErrors.push(`admissions (discharges): ${dischargesError.message}`)

  const { data: wardsWithBeds, error: wardsError } = await supabase
    .from('wards')
    .select('id, name, code, ward_type, capacity, daily_rate_xaf, is_active, beds(id, bed_number, bed_type, status)')
    .order('name')
  if (wardsError) rpcErrors.push(`wards: ${wardsError.message}`)

  const { data: reportSummaryRows, error: reportError } = await supabase.rpc('admission_reports_summary', { p_clinic_id: staff.clinicId, p_days: 30 })
  if (reportError) rpcErrors.push(`admission_reports_summary: ${reportError.message}`)
  const reportSummary = reportSummaryRows?.[0]

  const { data: dailyAdmissions, error: dailyError } = await supabase.rpc('admissions_daily_count', { p_clinic_id: staff.clinicId, p_days: 30 })
  if (dailyError) rpcErrors.push(`admissions_daily_count: ${dailyError.message}`)

  const { data: patients } = await supabase.from('patients').select('id, full_name, patient_code').eq('clinic_id', staff.clinicId).order('full_name')

  // Occupied-bed patient info for the Map — who's in which bed and how
  // many days they've been admitted.
  const { data: occupiedAdmissions } = await supabase
    .from('admissions')
    .select('bed_id, admission_number, bed_assigned_at, patients(full_name)')
    .eq('status', 'admitted')
    .not('bed_id', 'is', null)

  const bedInfoById = new Map(
    (occupiedAdmissions ?? []).map((a: any) => [a.bed_id, {
      patient_name: a.patients?.full_name,
      admission_number: a.admission_number,
      days_admitted: a.bed_assigned_at ? Math.max(1, Math.ceil((Date.now() - new Date(a.bed_assigned_at).getTime()) / 86400000)) : 1,
    }])
  )

  // Critical results specifically for currently-admitted patients — the
  // Dashboard banner. The full clinic-wide list lives on /clinical-alerts.
  const { data: criticalResultsRows, error: criticalError } = await supabase.rpc('critical_results_pending_review', { p_clinic_id: staff.clinicId })
  if (criticalError) rpcErrors.push(`critical_results_pending_review: ${criticalError.message}`)
  const admittedCriticalCount = (criticalResultsRows ?? []).filter((r: any) => r.is_admitted).length

  const wardsForActions = (wardsWithBeds ?? []).map((w: any) => ({
    id: w.id,
    name: w.name,
    beds: (w.beds ?? []).filter((b: any) => b.status === 'available').map((b: any) => ({ id: b.id, bed_number: b.bed_number })),
  }))

  const allBeds = (wardsWithBeds ?? []).flatMap((w: any) =>
    (w.beds ?? []).map((b: any) => ({ id: b.id, bed_number: b.bed_number, bed_type: b.bed_type, status: b.status, ward_id: w.id, ward_name: w.name }))
  )

  const dashboardContent = (
    <div>
      {admittedCriticalCount > 0 && (
        <a href="/clinical-alerts" style={{
          display: 'block', textDecoration: 'none', background: 'var(--color-critical-bg)',
          border: '1px solid var(--color-critical-text)', borderRadius: 'var(--radius-md)',
          padding: '10px 14px', marginBottom: '1.25rem', fontSize: '13px', color: 'var(--color-critical-text)', fontWeight: 500,
        }}>
          ⚠ {admittedCriticalCount} {lang==='fr'?`résultat${admittedCriticalCount>1?'s':''} critique${admittedCriticalCount>1?'s':''} en attente pour des patients admis — voir les Alertes cliniques →`:`critical result${admittedCriticalCount>1?'s':''} pending for admitted patients — see Clinical Alerts →`}
        </a>
      )}

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
        {lang==='fr'?"En attente d'assignation de lit":'Awaiting bed assignment'} ({awaitingBed?.length ?? 0})
      </p>
      {(!awaitingBed || awaitingBed.length === 0) ? (
        <p style={{ fontSize: '13px', color: 'var(--color-success-text)', marginBottom: '1.5rem' }}>{lang === 'fr' ? 'Aucune admission en attente.' : 'No pending admissions.'}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', overflowX: 'auto' }}>
          {awaitingBed.map((a: any) => (
            <AdmissionQueueRow key={a.id} admission={{
              id: a.id, admission_number: a.admission_number, patient_name: a.patients?.full_name ?? '—',
              source: a.source, admission_reason: a.admission_reason, recommended_at: a.recommended_at,
            }} wards={wardsForActions} />
          ))}
        </div>
      )}

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
        {lang==='fr'?'Patients admis':'Admitted patients'} ({admitted?.length ?? 0})
      </p>
      {(!admitted || admitted.length === 0) ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucun patient actuellement admis.' : 'No patients currently admitted.'}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {admitted.map((a: any, i: number) => (
            <div key={a.id} style={{ borderBottom: i < admitted.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
              <DischargeRow admission={{
                id: a.id, admission_number: a.admission_number, patient_name: a.patients?.full_name ?? '—',
                ward_name: a.wards?.name ?? '—', bed_number: a.beds?.bed_number ?? '—',
              }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const admissionsContent = (
    <div>
      <NewAdmissionForm patients={patients ?? []} />
      {(!allAdmissions || allAdmissions.length === 0) ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucune admission enregistrée.':'No admissions recorded.'}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr 1.3fr 1fr 1.5fr', gap: '10px', padding: '10px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', minWidth: '760px' }}>
            <span>{lang==='fr'?'N° admission':'Admission no.'}</span>
            <span>{lang==='fr'?'Patient':'Patient'}</span>
            <span>Source</span>
            <span>{lang==='fr'?'Service':'Ward'}</span>
            <span>{lang==='fr'?'Lit':'Bed'}</span>
            <span>{lang==='fr'?'Statut':'Status'}</span>
            <span>Date</span>
            <span></span>
          </div>
          {allAdmissions.map((a: any) => (
            <AdmissionListRow key={a.id} admission={{
              id: a.id, admission_number: a.admission_number, patient_name: a.patients?.full_name ?? '—',
              source: a.source, ward_name: a.wards?.name ?? null, bed_number: a.beds?.bed_number ?? null,
              status: a.status, recommended_at: a.recommended_at,
            }} wards={wardsForActions} />
          ))}
        </div>
      )}
    </div>
  )

  const wardsContent = (
    <WardsTable wards={(wardsWithBeds ?? []).map((w: any) => ({
      id: w.id, name: w.name, code: w.code, ward_type: w.ward_type, capacity: w.capacity,
      daily_rate_xaf: w.daily_rate_xaf, is_active: w.is_active, bed_count: (w.beds ?? []).length,
    }))} />
  )

  const bedsContent = (
    <BedsTable wards={(wardsWithBeds ?? []).map((w: any) => ({ id: w.id, name: w.name }))} beds={allBeds} />
  )

  const mapContent = (
    <BedMap wards={(wardsWithBeds ?? []).map((w: any) => ({
      id: w.id, name: w.name, ward_type: w.ward_type, capacity: w.capacity,
      beds: (w.beds ?? []).map((b: any) => ({
        id: b.id, bed_number: b.bed_number, status: b.status,
        ...(bedInfoById.get(b.id) ?? {}),
      })),
    }))} />
  )

  const dischargesContent = (
    (!discharges || discharges.length === 0) ? (
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucune sortie enregistrée.':'No discharges recorded.'}</p>
    ) : (
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1.3fr 1.3fr 1.5fr', gap: '10px', padding: '10px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', minWidth: '680px' }}>
          <span>{lang==='fr'?'N° admission':'Adm. no.'}</span><span>{lang==='fr'?'Patient':'Patient'}</span><span>{lang==='fr'?'Service':'Ward'}</span><span>Type</span><span>{lang==='fr'?'Sorti le':'Discharged'}</span><span>{lang==='fr'?'Résultat':'Outcome'}</span><span></span>
        </div>
        {discharges.map((d: any, i: number) => {
          const patient = d.patients
          const message = `Bonjour ${patient?.full_name}, voici votre résumé de sortie ${d.admission_number}. Nous restons à votre disposition.`
          return (
            <div key={d.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1.3fr 1.3fr 1.5fr', gap: '10px', padding: '10px 14px', alignItems: 'center', fontSize: '13px', minWidth: '680px',
              borderBottom: i < discharges.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{d.admission_number}</span>
              <span>{patient?.full_name ?? '—'}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{d.wards?.name ?? '—'}</span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{DISCHARGE_TYPE_LABELS[d.discharge_type] ?? d.discharge_type}</span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{d.discharged_at ? new Date(d.discharged_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') : '—'}</span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{d.discharge_outcome ?? '—'}</span>
              <span style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <a href={`/print/admissions/${d.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', textDecoration: 'none' }}>PDF</a>
                {patient?.phone && (
                  <a href={whatsappLink(patient.phone, message)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid #25D366', color: '#25D366', textDecoration: 'none' }}>WhatsApp</a>
                )}
              </span>
            </div>
          )
        })}
      </div>
    )
  )

  const reportsContent = (
    <div>
      <StatCardRow>
        <StatCard label={lang==='fr'?'Admissions (30j)':'Admissions (30d)'} value={reportSummary?.total_admissions ?? 0} />
        <StatCard label={lang==='fr'?'Durée moyenne de séjour':'Avg. length of stay'} value={reportSummary?.avg_length_of_stay_days != null ? `${reportSummary.avg_length_of_stay_days} ${lang==='fr'?'j':'d'}` : '—'} />
        <StatCard label={lang==='fr'?'Sorties routine':'Routine discharges'} value={reportSummary?.routine_discharges ?? 0} />
        <StatCard label={lang==='fr'?'Décès':'Deaths'} value={reportSummary?.deceased_discharges ?? 0} accent={reportSummary?.deceased_discharges ? 'warning' : undefined} />
      </StatCardRow>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>{lang==='fr'?'Admissions par jour (30 jours)':'Admissions per day (30 days)'}</p>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '8px 14px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>
          <span>Date</span><span style={{ textAlign: 'right' }}>Admissions</span>
        </div>
        {(dailyAdmissions ?? []).map((d: any, i: number) => (
          <div key={d.report_date} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '8px 14px', fontSize: '13px',
            borderBottom: i < (dailyAdmissions?.length ?? 0) - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            opacity: Number(d.admission_count) === 0 ? 0.5 : 1,
          }}>
            <span>{d.report_date}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{d.admission_count}</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>{lang==='fr'?'Admissions & Gestion des lits':'Admissions & Bed Management'}</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        {lang==='fr'?'Admissions, services, lits, transferts et sorties':'Admissions, wards, beds, transfers, and discharges'}
      </p>

      {rpcErrors.length > 0 && (
        <div style={{ background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '12px' }}>
          <strong>{lang==='fr'?"Certaines données n'ont pas pu être chargées":'Some data could not be loaded'}</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            {rpcErrors.map((e, i) => <li key={i} style={{ fontFamily: 'var(--font-mono)' }}>{e}</li>)}
          </ul>
        </div>
      )}

      <StatCardRow>
        <StatCard label={lang==='fr'?'Total lits':'Total beds'} value={occupancy?.total_beds ?? 0} />
        <StatCard label={lang==='fr'?'Disponibles':'Available'} value={occupancy?.available_beds ?? 0} />
        <StatCard label={lang==='fr'?'Occupés':'Occupied'} value={occupancy?.occupied_beds ?? 0} accent={occupancy?.occupied_beds ? 'warning' : undefined} />
        <StatCard label={lang==='fr'?'Réservés':'Reserved'} value={occupancy?.reserved_beds ?? 0} />
        <StatCard label={lang==='fr'?"Taux d'occupation":'Occupancy rate'} value={`${occupancy?.occupancy_pct ?? 0}%`} />
      </StatCardRow>

      <AdmissionsTabs
        lang={staff.preferredLanguage}
        dashboardContent={dashboardContent}
        admissionsContent={admissionsContent}
        wardsContent={wardsContent}
        bedsContent={bedsContent}
        mapContent={mapContent}
        dischargesContent={dischargesContent}
        reportsContent={reportsContent}
      />
    </div>
  )
}
