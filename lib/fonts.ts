// lib/fonts.ts
// Two type roles per the design plan: Plex Sans for all UI text (chosen
// for genuine French-accent support and technical character), Plex Mono
// specifically for patient codes, invoice numbers, and XAF amounts —
// tabular figures in a monospace face are what let a cashier's eye track
// a column of numbers instantly, versus everything sharing one sans.
// Source Serif 4 (used for printed documents — prescriptions, receipts,
// the controlled-drug ledger) is loaded separately at print-render time,
// not globally, since it's never seen in the live UI.

import { IBM_Plex_Sans, IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google'

export const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
})

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

// For printed documents only (prescriptions, lab reports) — decided in
// the design audit: printed paper gets an "official registry" weight
// distinct from the live app's UI sans, matching the OHADA/CNI-style
// paperwork patients already recognize.
export const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-source-serif',
  display: 'swap',
})
