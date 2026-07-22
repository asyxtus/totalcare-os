// lib/supabase/server.ts
// Server client — reads the session from cookies. Used in server
// components (like the authenticated layout) to fetch the current staff
// member's role and clinic BEFORE rendering, so role-gated nav shows the
// right items on first paint instead of flashing then correcting.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component that can't set cookies —
            // safe to ignore if middleware is refreshing the session.
          }
        },
      },
    }
  )
}
