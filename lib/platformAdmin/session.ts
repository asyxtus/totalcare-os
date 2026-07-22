// lib/platformAdmin/session.ts
//
// Not a new auth system — the same PLATFORM_ADMIN_SECRET the API route
// checks against a Bearer header, just held in an httpOnly cookie after
// you type it in once, so the dashboard doesn't ask for it on every
// click. Short-lived (4 hours) on purpose: this gates provisioning a
// whole new tenant, not something that should stay unlocked in a
// browser tab indefinitely.

import { cookies } from 'next/headers'

const COOKIE_NAME = 'platform_admin_session'
const MAX_AGE_SECONDS = 60 * 60 * 4

export async function isPlatformAdminUnlocked(): Promise<boolean> {
  const expected = process.env.PLATFORM_ADMIN_SECRET
  if (!expected) return false
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value === expected
}

export async function setPlatformAdminSession(secret: string) {
  const store = await cookies()
  store.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/platform-admin',
  })
}

export async function clearPlatformAdminSession() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
