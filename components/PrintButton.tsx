'use client'

// components/PrintButton.tsx
//
// Used only inside app/print/* pages, which are NOT wrapped in LangProvider
// (they're plain server components using staff.preferredLanguage directly).
// So lang is passed as a prop here rather than read from context.

export default function PrintButton({ lang = 'fr' }: { lang?: 'fr' | 'en' }) {
  return (
    <button
      onClick={() => window.print()}
      style={{
        background: '#2F6F62', color: 'white', border: 'none',
        padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
        fontFamily: 'sans-serif',
      }}
    >
      {lang === 'fr' ? 'Imprimer / Enregistrer en PDF' : 'Print / Save as PDF'}
    </button>
  )
}
