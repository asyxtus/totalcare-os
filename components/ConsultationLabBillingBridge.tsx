'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'

type BillingMode = 'pay_now' | 'charge_to_encounter' | 'deferred'

export default function ConsultationLabBillingBridge() {
  const pathname = usePathname()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [mode, setMode] = useState<BillingMode>('pay_now')
  const [emergency, setEmergency] = useState(false)

  useEffect(() => {
    if (!pathname?.includes('/visits/') || !pathname.endsWith('/consultation')) {
      setTarget(null)
      return
    }

    const timer = window.setInterval(() => {
      const form = document.querySelector('form')
      if (!form) return
      const text = document.body.textContent || ''
      const isEmergency = text.includes('URGENCE') || text.includes('EMERGENCY')
      setEmergency(isEmergency)
      if (isEmergency) setMode('charge_to_encounter')

      if (!form.querySelector('[data-lab-billing-bridge]')) {
        const anchor = Array.from(form.querySelectorAll('p')).find(p => {
          const value = (p.textContent || '').trim()
          return value === 'Examens de laboratoire' || value === 'Laboratory tests'
        })
        const mount = document.createElement('div')
        mount.setAttribute('data-lab-billing-bridge', 'true')
        if (anchor?.parentElement) anchor.parentElement.insertBefore(mount, anchor)
        else form.prepend(mount)
        setTarget(mount)
      }
    }, 100)

    return () => window.clearInterval(timer)
  }, [pathname])

  if (!target) return null

  const labels = {
    pay_now: { fr: 'Pay now', en: 'Pay now', icon: '🟢' },
    charge_to_encounter: { fr: 'Charge à la rencontre', en: 'Charge to encounter', icon: '🟠' },
    deferred: { fr: 'Différer', en: 'Defer', icon: '⚪' },
  }

  const choose = (next: BillingMode) => {
    if (emergency) return
    setMode(next)
  }

  return createPortal(
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 12, background: 'var(--color-surface)' }}>
      <input type="hidden" name="lab_billing_mode" value={mode} />
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Laboratory tests → Payment mode</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
        {(Object.keys(labels) as BillingMode[]).map(key => {
          const selected = mode === key
          const disabled = emergency && key !== 'charge_to_encounter'
          return <button key={key} type="button" onClick={() => choose(key)} disabled={disabled} aria-pressed={selected} style={{ textAlign: 'left', padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: selected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)', background: selected ? 'var(--color-success-bg)' : 'var(--color-bg)', color: 'var(--color-text-primary)', opacity: disabled ? .45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{labels[key].icon} {labels[key].en}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>{labels[key].fr}</div>
          </button>
        })}
      </div>
      {emergency && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>Emergency: Charge to encounter is required. No laboratory payment is required before an authorized emergency test is performed.</div>}
    </div>,
    target,
  )
}
