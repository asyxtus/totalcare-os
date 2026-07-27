'use client'

// components/LogoutButton.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton({ lang, compact }: { lang: 'fr' | 'en'; compact?: boolean }) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleLogout() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      disabled={signingOut}
      style={{
        fontSize: compact ? '10px' : '11px',
        color: 'var(--color-text-on-dark-secondary)',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: signingOut ? 'default' : 'pointer',
        textDecoration: 'underline',
        textAlign: 'left',
      }}
    >
      {signingOut
        ? (lang === 'fr' ? 'Déconnexion…' : 'Signing out…')
        : (lang === 'fr' ? 'Se déconnecter' : 'Sign out')}
    </button>
  )
}