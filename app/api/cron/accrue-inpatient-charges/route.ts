// app/api/cron/accrue-inpatient-charges/route.ts
//
// Triggers accrue_nightly_inpatient_charges() (96_inpatient_nightly_billing.sql)
// once per day. This is the FIRST API route in the project — everything
// else so far is a server action, which only makes sense for something a
// logged-in person triggers. A nightly billing run has no logged-in
// person behind it, so it needs an endpoint an external scheduler can
// hit instead.
//
// Auth model: a single shared secret (CRON_SECRET), checked against the
// Authorization header. This is NOT staff auth — there is no staff
// session here — so it deliberately doesn't go through
// getCurrentStaff()/RLS at all. The service-role client inside the
// called function is what actually has the privilege to write charges
// across every clinic; this route's only job is to make sure the
// caller is your scheduler and nobody else.
//
// Wire this up with EITHER:
//   - Vercel Cron (simplest if deploying there): add to vercel.json —
//       { "crons": [{ "path": "/api/cron/accrue-inpatient-charges", "schedule": "0 0 * * *" }] }
//     Vercel Cron schedules run in UTC, not local time. "0 0 * * *" is
//     00:00 UTC, which is 01:00 in Douala (WAT, UTC+1, no DST — stable
//     year-round, no seasonal adjustment needed). If this ever needs to
//     change, convert from Douala time to UTC first, not the other way.
//     Vercel sends CRON_SECRET automatically as a Bearer token to its
//     own scheduled routes once the env var is set — no extra config.
//   - GitHub Actions (same pattern as your SME compliance/scholarship
//     monitors): a scheduled workflow that does
//       curl -X POST https://your-domain/api/cron/accrue-inpatient-charges \
//         -H "Authorization: Bearer $CRON_SECRET"

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET

  if (!expected) {
    console.error('CRON_SECRET is not set — refusing to run the nightly accrual.')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient.rpc('accrue_nightly_inpatient_charges')

    if (error) {
      console.error('accrue_nightly_inpatient_charges failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      admissions_charged: data?.length ?? 0,
      details: data ?? [],
    })
  } catch (err: any) {
    console.error('Nightly accrual route crashed:', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}

// Vercel Cron sends GET by default unless configured otherwise — support
// both so it works regardless of which scheduler config is used.
export async function GET(request: Request) {
  return POST(request)
}
