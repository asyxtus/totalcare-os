// app/page.tsx
'use client'

// Was a plain server-side redirect('/login') — but URL fragments
// (#access_token=...) are never sent to the server and don't survive a
// server-side redirect, so any Supabase auth email that lands on the bare
// root domain (which happens whenever Site URL is the root rather than a
// specific page — e.g. any dashboard-triggered action like "Send password
// recovery" that doesn't accept a custom redirectTo) would silently drop
// the token and dead-end at /login. This checks client-side, before
// redirecting anywhere, whether a token is actually present.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const hasAuthToken = typeof window !== 'undefined' && window.location.hash.includes('access_token=')
    if (hasAuthToken) {
      // Preserve the hash across navigation — router.push alone can drop
      // it depending on how the target page reads it, so build the full
      // destination URL directly.
      window.location.href = '/accept-invite' + window.location.hash
    } else {
      router.replace('/login')
    }
  }, [router])

  return null
}
