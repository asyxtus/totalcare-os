// app/api/admin/provision-clinic/route.ts
//
// curl/CI-friendly entry point for tenant onboarding. For interactive
// use, the /platform-admin dashboard calls the same underlying logic
// (lib/platformAdmin/provisionClinic.ts) through a form instead — this
// route stays useful for scripting or a one-off call without opening a
// browser.
//
// Protected by PLATFORM_ADMIN_SECRET — deliberately separate from
// CRON_SECRET, since that one fires automatically every night and this
// one provisions an entire tenant.
//
// Usage:
//   curl -X POST https://your-domain/api/admin/provision-clinic \
//     -H "Authorization: Bearer $PLATFORM_ADMIN_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{
//       "clinic_name": "Clinique Exemple Yaoundé",
//       "template_clinic_id": "<Total Care'\''s clinic id, to clone its catalog>",
//       "admin_full_name": "Jane Doe",
//       "admin_email": "jane@example.com"
//     }'

import { NextResponse } from 'next/server'
import { provisionClinicCore } from '@/lib/platformAdmin/provisionClinic'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expected = process.env.PLATFORM_ADMIN_SECRET

  if (!expected) {
    console.error('PLATFORM_ADMIN_SECRET is not set — refusing to provision a clinic.')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { clinic_name?: string; template_clinic_id?: string; admin_full_name?: string; admin_email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = await provisionClinicCore({
    clinicName: body.clinic_name ?? '',
    templateClinicId: body.template_clinic_id,
    adminFullName: body.admin_full_name ?? '',
    adminEmail: body.admin_email ?? '',
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, detail: result.detail, clinic_id: result.clinicId },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    clinic_id: result.clinicId,
    admin_email: result.adminEmail,
    message: "Clinic provisioned and admin invited. They'll receive an email to set their password.",
  })
}
