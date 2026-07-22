// lib/i18n/LangContext.tsx
//
// Why a context and not props: 88 components were French-only when the
// EN pass started. Prop-drilling `lang` into each would mean editing
// every parent up the tree too. With this provider mounted once in
// AppShell (which already knows the staff member's language), any
// client component can call useLang() and become bilingual without a
// single parent changing. Server components don't need this — they
// already read getCurrentStaff().preferredLanguage directly.

'use client'

import { createContext, useContext } from 'react'

const LangContext = createContext<'fr' | 'en'>('fr')

export function LangProvider({ lang, children }: { lang: 'fr' | 'en'; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>
}

export function useLang(): 'fr' | 'en' {
  return useContext(LangContext)
}

// Locale string helper — the ONE place that maps lang -> Intl locale.
// Use this everywhere instead of hardcoding 'fr-FR', so a hardcoded locale
// never leaks into English mode again. For server components, call
// localeFor(lang) directly with staff.preferredLanguage. For client
// components, call useLocale() which reads lang from context.
export function localeFor(lang: 'fr' | 'en'): string {
  return lang === 'fr' ? 'fr-FR' : 'en-US'
}

export function useLocale(): string {
  const lang = useContext(LangContext)
  return localeFor(lang)
}
