'use client'

// components/PreferenceToggles.tsx

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sun, Moon, Monitor } from 'lucide-react'
import { setMyLanguageAction } from '@/lib/actions/myPreferences'

type ThemeChoice = 'light' | 'dark' | 'system'

function applyTheme(choice: ThemeChoice) {
  if (choice === 'system') {
    localStorage.removeItem('tc-theme')
    document.documentElement.removeAttribute('data-theme')
  } else {
    localStorage.setItem('tc-theme', choice)
    document.documentElement.setAttribute('data-theme', choice)
  }
}

const segBtn: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '5px 0', border: 'none', background: 'transparent', cursor: 'pointer',
  borderRadius: '5px', color: 'var(--color-text-on-dark-secondary)',
}

export default function PreferenceToggles({ lang }: { lang: 'fr' | 'en' }) {
  const router = useRouter()
  const [theme, setTheme] = useState<ThemeChoice>('system')
  const [langPending, setLangPending] = useState(false)

  // Read the persisted choice after mount — localStorage doesn't exist
  // during server render, so initial state has to be settled client-side.
  useEffect(() => {
    const saved = localStorage.getItem('tc-theme')
    if (saved === 'light' || saved === 'dark') setTheme(saved)
  }, [])

  function chooseTheme(next: ThemeChoice) {
    setTheme(next)
    applyTheme(next)
  }

  async function chooseLang(next: 'fr' | 'en') {
    if (next === lang || langPending) return
    setLangPending(true)
    await setMyLanguageAction(next)
    router.refresh() // getCurrentStaff re-reads → lang flows to every screen that respects it
    setLangPending(false)
  }

  const themeOptions: { id: ThemeChoice; icon: typeof Sun; label: string }[] = [
    { id: 'light', icon: Sun, label: lang === 'fr' ? 'Clair' : 'Light' },
    { id: 'system', icon: Monitor, label: lang === 'fr' ? 'Système' : 'System' },
    { id: 'dark', icon: Moon, label: lang === 'fr' ? 'Sombre' : 'Dark' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Theme segmented control */}
      <div style={{
        display: 'flex', gap: '2px', background: 'var(--color-sidebar-surface-raised)',
        borderRadius: '7px', padding: '2px',
      }} role="group" aria-label={lang === 'fr' ? 'Thème' : 'Theme'}>
        {themeOptions.map((opt) => {
          const Icon = opt.icon
          const active = theme === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => chooseTheme(opt.id)}
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={active}
              style={{
                ...segBtn,
                background: active ? 'var(--color-sidebar)' : 'transparent',
                color: active ? 'var(--color-text-on-dark)' : 'var(--color-text-on-dark-secondary)',
              }}
            >
              <Icon size={13} aria-hidden />
            </button>
          )
        })}
      </div>

      {/* Language segmented control */}
      <div style={{
        display: 'flex', gap: '2px', background: 'var(--color-sidebar-surface-raised)',
        borderRadius: '7px', padding: '2px', opacity: langPending ? 0.6 : 1,
      }} role="group" aria-label={lang === 'fr' ? 'Langue' : 'Language'}>
        {(['fr', 'en'] as const).map((l) => (
          <button
            key={l}
            onClick={() => chooseLang(l)}
            aria-pressed={lang === l}
            style={{
              ...segBtn,
              fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
              background: lang === l ? 'var(--color-sidebar)' : 'transparent',
              color: lang === l ? 'var(--color-text-on-dark)' : 'var(--color-text-on-dark-secondary)',
            }}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
