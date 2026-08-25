'use client'

// components/ui/index.tsx
// Shared component library.

import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: LucideIcon
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, loading, className, children, disabled, ...rest }, ref
) {
  const iconSize = size === 'sm' ? 13 : 15
  return (
    <button
      ref={ref}
      className={`btn btn-${variant}${size === 'sm' ? ' btn-sm' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={iconSize} className="spin" aria-hidden /> : Icon ? <Icon size={iconSize} aria-hidden /> : null}
      {children}
    </button>
  )
})

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) { return <input ref={ref} className={`input${className ? ` ${className}` : ''}`} {...rest} /> }
)

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) { return <select ref={ref} className={`input${className ? ` ${className}` : ''}`} {...rest}>{children}</select> }
)

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) { return <textarea ref={ref} className={`input${className ? ` ${className}` : ''}`} {...rest} /> }
)

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>{label}{required ? ' *' : ''}</label>
      {children}
      {hint && <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>{hint}</p>}
    </div>
  )
}

export function Card({ interactive, className, style, children, ...rest }: { interactive?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card${interactive ? ' card-interactive' : ''}${className ? ` ${className}` : ''}`} style={style} {...rest}>{children}</div>
}

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'critical' | 'accent'
export function Badge({ variant = 'neutral', icon: Icon, children }: { variant?: BadgeVariant; icon?: LucideIcon; children: React.ReactNode }) {
  return <span className={`badge badge-${variant}`}>{Icon && <Icon size={11} aria-hidden />}{children}</span>
}

export interface TabDef<T extends string = string> { id: T; label: string; icon?: LucideIcon }

export function TabBar<T extends string>({ tabs, active, onChange, className }: {
  tabs: TabDef<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div className={`tabbar${className ? ` ${className}` : ''}`} role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} data-active={active === t.id} className="tab" onClick={() => onChange(t.id)}>
          {t.icon && <t.icon size={15} aria-hidden />}
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
      <Icon size={28} aria-hidden style={{ color: 'var(--color-text-secondary)', opacity: 0.5, marginBottom: '8px' }} />
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{title}</p>
      {hint && <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', opacity: 0.8, margin: '4px 0 0' }}>{hint}</p>}
      {action && <div style={{ marginTop: '12px' }}>{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '1.25rem' }}><div><h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{title}</h1>{subtitle && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>{subtitle}</p>}</div>{action}</div>
}

export function ErrorBanner({ message, detail }: { message: string; detail?: string | null }) {
  return <div style={{ background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', marginBottom: '10px' }}><p style={{ margin: 0 }}>{message}</p>{detail && <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: '11px', opacity: 0.85 }}>{detail}</p>}</div>
}
