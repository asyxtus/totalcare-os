// lib/supabase/client.ts
// Browser client — uses the anon key, which is safe to expose. RLS on
// every table (built across the whole schema so far) is what actually
// protects data, not keeping this key secret.

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
