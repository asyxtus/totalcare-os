// app/(authenticated)/admin/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { fetchAuditLogAction } from '@/lib/actions/auditLog'
import AdminHub from '@/components/admin/AdminHub'

export default async function AdminPage() {
  const staff = await getCurrentStaff()
  if (!['admin', 'auditor'].includes(staff.role)) redirect('/dashboard')

  const supabase = await createClient()
  const lang = staff.preferredLanguage
  const isAdmin = staff.role === 'admin'

  // Auditors get read-only visibility into the audit trail only — the
  // other tabs (Staff, Pricing, Inpatient) are privileged write
  // surfaces with no reason to even fetch their data for a role that
  // can't act on it.
  const { entries: auditEntries } = await fetchAuditLogAction({})

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: '960px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>Administration</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
          {staff.clinicName} · Journal d'audit (lecture seule)
        </p>
        <AdminHub
          role="auditor"
          staff={[]} currentStaffId={staff.staffId}
          services={[]} clinicTests={[]} clinicPanels={[]} fullCatalog={[]}
          wards={[]} nursingRate={null}
          auditEntries={auditEntries}
          lang={lang}
        />
      </div>
    )
  }

  const { data: staffRows, error: staffError } = await supabase
    .from('staff')
    .select('id, full_name, role, is_active, preferred_language, auth_user_id, created_at')
    .eq('clinic_id', staff.clinicId)
    .order('full_name')

  // Email lives on auth.users, not the staff table — resolved via the
  // service-role client since the anon client has no visibility into
  // other people's auth records. N sequential lookups is fine at the
  // scale a single clinic's staff table actually reaches.
  const adminClient = createAdminClient()
  const staffWithEmail = await Promise.all(
    (staffRows ?? []).map(async (row) => {
      if (!row.auth_user_id) return { ...row, email: null as string | null }
      const { data } = await adminClient.auth.admin.getUserById(row.auth_user_id)
      return { ...row, email: data?.user?.email ?? null }
    })
  )

  const { data: services } = await supabase
    .from('service_prices')
    .select('id, service_name, category, price_xaf, is_active')
    .eq('clinic_id', staff.clinicId)
    .order('category').order('service_name')

  const { data: clinicTests } = await supabase
    .from('clinic_lab_tests')
    .select('id, price_xaf, is_active, lab_test_catalog(id, name_fr, name_en, category, result_type)')
    .eq('clinic_id', staff.clinicId)

  const { data: clinicPanels } = await supabase
    .from('clinic_lab_panels')
    .select('id, price_xaf, is_active, lab_panels(id, name_fr, name_en, category, lab_panel_items(lab_test_catalog_id, lab_test_catalog(name_fr)))')
    .eq('clinic_id', staff.clinicId)

  // Full catalog for the "which tests go in this new panel" picker —
  // scoped to this clinic's own catalog (lab_test_catalog is
  // clinic-owned as of 95_lab_catalog_clinic_scoping.sql).
  const { data: fullCatalog } = await supabase
    .from('lab_test_catalog')
    .select('id, name_fr, name_en, category')
    .eq('clinic_id', staff.clinicId)
    .order('category').order('name_fr')

  const { data: wards } = await supabase
    .from('wards')
    .select('id, name, code, daily_rate_xaf, is_active')
    .eq('clinic_id', staff.clinicId)
    .order('name')

  const { data: clinicRow } = await supabase
    .from('clinics')
    .select('nursing_daily_rate_xaf')
    .eq('id', staff.clinicId)
    .maybeSingle()

  return (
    <div style={{ maxWidth: '960px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>
        {lang === 'fr' ? 'Administration' : 'Administration'}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' }}>
        {staff.clinicName}
      </p>

      {staffError && (
        <div style={{ background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '12px' }}>
          {staffError.message}
        </div>
      )}

      <AdminHub
        role="admin"
        staff={staffWithEmail}
        currentStaffId={staff.staffId}
        services={services ?? []}
        clinicTests={(clinicTests ?? []) as any}
        clinicPanels={(clinicPanels ?? []) as any}
        fullCatalog={fullCatalog ?? []}
        wards={wards ?? []}
        nursingRate={clinicRow?.nursing_daily_rate_xaf ?? null}
        auditEntries={auditEntries}
        lang={lang}
      />
    </div>
  )
}
