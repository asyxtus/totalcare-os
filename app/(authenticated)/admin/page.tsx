// app/(authenticated)/admin/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { fetchAuditLogAction } from '@/lib/actions/auditLog'
import AdminHub from '@/components/admin/AdminHub'
import type { StaffRole } from '@/lib/types'

export default async function AdminPage() {
  const staff = await getCurrentStaff()
  if (!['admin', 'auditor'].includes(staff.role)) redirect('/dashboard')

  const supabase = await createClient()
  const lang = staff.preferredLanguage
  const isAdmin = staff.role === 'admin'

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

  const adminClient = createAdminClient()
  const staffWithEmail = await Promise.all(
    (staffRows ?? []).map(async (row) => {
      if (!row.auth_user_id) return { ...row, email: null as string | null }
      const { data } = await adminClient.auth.admin.getUserById(row.auth_user_id)
      return { ...row, email: data?.user?.email ?? null }
    })
  )

  const staffIds = staffWithEmail.map((s) => s.id)
  const { data: secondaryRolesRaw } = staffIds.length > 0
    ? await supabase.from('staff_secondary_roles').select('staff_id, role').in('staff_id', staffIds)
    : { data: [] }
  const secondaryRolesByStaffId = new Map<string, StaffRole[]>()
  for (const row of secondaryRolesRaw ?? []) {
    const list = secondaryRolesByStaffId.get(row.staff_id) ?? []
    list.push(row.role as StaffRole)
    secondaryRolesByStaffId.set(row.staff_id, list)
  }
  const staffWithRoles = staffWithEmail.map((s) => ({ ...s, secondary_roles: secondaryRolesByStaffId.get(s.id) ?? [] }))

  const { data: services } = await supabase
    .from('service_prices')
    .select('id, service_name, category, price_xaf, is_active')
    .eq('clinic_id', staff.clinicId)
    .order('category').order('service_name')

  // Laboratory admin view: this is the clinic's activated/priced catalogue.
  // Include the full clinical metadata so the same Laboratory tab is the
  // source of truth for code, specimen, container, turnaround and ranges.
  const { data: clinicTests } = await supabase
    .from('clinic_lab_tests')
    .select(`
      id, price_xaf, is_active,
      lab_test_catalog(
        id, name_fr, name_en, category, result_type, lab_code,
        specimen_type, unit, reference_range_low, reference_range_high,
        critical_low, critical_high, qualitative_options,
        abnormal_qualitative_values, collection_container, turnaround_time
      )
    `)
    .eq('clinic_id', staff.clinicId)

  const { data: clinicPanels } = await supabase
    .from('clinic_lab_panels')
    .select('id, price_xaf, is_active, lab_panels(id, name_fr, name_en, category, lab_panel_items(lab_test_catalog_id, lab_test_catalog(name_fr)))')
    .eq('clinic_id', staff.clinicId)

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
      <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>Administration</h1>
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
        staff={staffWithRoles}
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
