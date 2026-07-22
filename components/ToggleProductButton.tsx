'use client'

// components/ToggleProductButton.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toggleProductActive } from '@/lib/actions/pharmacy'
import { useLang } from '@/lib/i18n/LangContext'

export default function ToggleProductButton({ productId, isActive }: { productId: string; isActive: boolean }) {
  const lang = useLang()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleClick() {
    setSubmitting(true)
    await toggleProductActive(productId, isActive)
    router.refresh()
  }

  return (
    <button onClick={handleClick} disabled={submitting} style={{
      fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
    }}>
      {submitting ? '…' : isActive ? (lang==='fr'?'Désactiver':'Deactivate') : 'Activer'}
    </button>
  )
}
