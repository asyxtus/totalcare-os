'use client'

// components/WhatsAppSummaryButton.tsx
//
// Sends the patient a WhatsApp message with their visit summary: diagnosis,
// prescription, and follow-up. Uses a wa.me deep link — no SMS gateway, no
// cost. Staff clicks → WhatsApp opens with the message pre-filled → they hit
// send. Works from any phone or desktop with WhatsApp.
//
// The message is plain text (WhatsApp doesn't render markdown reliably), kept
// short and clear, in the clinic's language.

import { useLang } from '@/lib/i18n/LangContext'

interface RxLine {
  name: string
  dose?: string | null
  frequency?: string | null
  durationDays?: number | null
  instructions?: string | null
}

export default function WhatsAppSummaryButton({
  patientPhone,
  patientName,
  clinicName,
  visitDate,
  diagnosis,
  prescriptions,
  followUp,
  compact = false,
}: {
  patientPhone: string | null
  patientName: string
  clinicName: string
  visitDate: string
  diagnosis?: string | null
  prescriptions: RxLine[]
  followUp?: string | null
  compact?: boolean
}) {
  const lang = useLang()

  // Normalize the phone number to international format for wa.me.
  // Cameroon numbers: 9 digits, country code 237. Strip spaces, +, leading 0.
  function normalizePhone(raw: string | null): string | null {
    if (!raw) return null
    let digits = raw.replace(/[^\d]/g, '')
    // Already has country code
    if (digits.startsWith('237') && digits.length === 12) return digits
    // 9-digit local number → prepend 237
    if (digits.length === 9) return '237' + digits
    // Some numbers stored with leading 0 (10 digits) → drop 0, prepend 237
    if (digits.length === 10 && digits.startsWith('0')) return '237' + digits.slice(1)
    // Fallback: if it's already 11-13 digits assume it's international
    if (digits.length >= 11 && digits.length <= 13) return digits
    return null
  }

  const phone = normalizePhone(patientPhone)

  function buildMessage(): string {
    const L = lang === 'fr'
    const lines: string[] = []

    lines.push(L ? `Bonjour ${patientName},` : `Hello ${patientName},`)
    lines.push('')
    lines.push(L
      ? `Voici le résumé de votre visite du ${visitDate} à ${clinicName} :`
      : `Here is a summary of your visit on ${visitDate} at ${clinicName}:`)
    lines.push('')

    if (diagnosis) {
      lines.push(L ? `🩺 Diagnostic : ${diagnosis}` : `🩺 Diagnosis: ${diagnosis}`)
      lines.push('')
    }

    if (prescriptions.length > 0) {
      lines.push(L ? '💊 Ordonnance :' : '💊 Prescription:')
      for (const rx of prescriptions) {
        const parts = [rx.name]
        if (rx.dose) parts.push(rx.dose)
        if (rx.frequency) parts.push(rx.frequency)
        if (rx.durationDays) parts.push(L ? `pendant ${rx.durationDays} jours` : `for ${rx.durationDays} days`)
        lines.push(`• ${parts.join(' — ')}`)
        if (rx.instructions) lines.push(`   ↳ ${rx.instructions}`)
      }
      lines.push('')
    }

    if (followUp) {
      lines.push(L ? `📅 Suivi : ${followUp}` : `📅 Follow-up: ${followUp}`)
      lines.push('')
    }

    lines.push(L
      ? `Prenez soin de vous.\n${clinicName}`
      : `Take care.\n${clinicName}`)

    return lines.join('\n')
  }

  if (!phone) {
    return (
      <span
        title={lang === 'fr' ? 'Numéro de téléphone manquant ou invalide' : 'Missing or invalid phone number'}
        style={{
          fontSize: compact ? '11px' : '12px', color: 'var(--color-text-secondary)',
          padding: compact ? '2px 8px' : '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px',
          opacity: 0.6, cursor: 'not-allowed',
        }}
      >
        {lang === 'fr' ? 'WhatsApp (n° manquant)' : 'WhatsApp (no number)'}
      </span>
    )
  }

  const href = `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage())}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontSize: compact ? '11px' : '13px',
        fontWeight: 500,
        color: '#fff',
        background: '#25D366',
        padding: compact ? '3px 10px' : '7px 14px',
        borderRadius: 'var(--radius-sm)',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width={compact ? 13 : 15} height={compact ? 13 : 15} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24s-3.69 8.24-8.23 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/>
      </svg>
      {lang === 'fr' ? 'Envoyer résumé WhatsApp' : 'Send WhatsApp summary'}
    </a>
  )
}
