'use client'

// components/platformAdmin/PlatformAdminDashboard.tsx
//
// The platform-wide management console — separate from any single
// clinic's staff app. Three tabs:
//   Overview  — totals across every clinic (patients, staff, revenue)
//   Clinics   — per-clinic stats, rename, suspend/reactivate
//   New Clinic — the original provisioning form

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  provisionClinicAction, platformAdminSignOutAction, getClinicSummariesAction,
  renameClinicAction, setClinicActiveAction, getPlatformAuditLogAction,
  listPlatformAdminsAction, invitePlatformAdminAction, setPlatformAdminActiveAction,
  type ClinicListItem, type ClinicSummary, type PlatformOverview, type AuditLogEntry,
  type PlatformAdminListItem,
} from '@/lib/actions/platformAdmin'
import type { CurrentPlatformAdmin } from '@/lib/platformAdmin/session'
import { useLang } from '@/lib/i18n/LangContext'
import { TabBar, type TabDef } from '@/components/ui'
import { LayoutGrid, Building2, PlusCircle, ScrollText, Users } from 'lucide-react'

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-primary)', width: '100%',
}
const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }

function fmtDate(iso: string | null, lang: 'fr' | 'en' = 'fr') {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso: string, lang: 'fr' | 'en' = 'fr') {
  return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtMoney(n: number, lang: 'fr' | 'en' = 'fr') {
  return n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') + ' FCFA'
}

type Tab = 'overview' | 'clinics' | 'new' | 'audit' | 'admins'

export default function PlatformAdminDashboard({ clinics, currentAdmin }: { clinics: ClinicListItem[]; currentAdmin: CurrentPlatformAdmin }) {
  const lang = useLang()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')

  const tabs: TabDef<Tab>[] = [
    { id: 'overview', label: lang === 'fr' ? "Vue d'ensemble" : 'Overview', icon: LayoutGrid },
    { id: 'clinics', label: lang === 'fr' ? 'Cliniques' : 'Clinics', icon: Building2 },
    { id: 'new', label: lang === 'fr' ? 'Nouvelle clinique' : 'New clinic', icon: PlusCircle },
    { id: 'audit', label: lang === 'fr' ? 'Journal' : 'Audit log', icon: ScrollText },
    { id: 'admins', label: lang === 'fr' ? 'Administrateurs' : 'Admins', icon: Users },
  ]

  async function handleSignOut() {
    await platformAdminSignOutAction()
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
              {lang === 'fr' ? 'Administration plateforme' : 'Platform administration'}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
              {lang === 'fr' ? 'Connecté en tant que' : 'Signed in as'} <strong>{currentAdmin.fullName}</strong>
            </p>
          </div>
          <button onClick={handleSignOut} style={{
            fontSize: '12px', padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer',
          }}>
            {lang === 'fr' ? 'Se déconnecter' : 'Sign out'}
          </button>
        </div>

        <TabBar tabs={tabs} active={tab} onChange={setTab} />
        <div style={{ marginTop: '1.25rem' }}>
          {tab === 'overview' && <OverviewTab lang={lang} />}
          {tab === 'clinics' && <ClinicsTab lang={lang} />}
          {tab === 'new' && <NewClinicTab lang={lang} clinics={clinics} />}
          {tab === 'audit' && <AuditLogTab lang={lang} />}
          {tab === 'admins' && <AdminsTab lang={lang} currentAdmin={currentAdmin} />}
        </div>
      </div>
    </div>
  )
}

// ─── Overview ────────────────────────────────────────────────────────────

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', minWidth: '140px', flex: 1 }}>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0 }}>{value}</p>
    </div>
  )
}

function OverviewTab({ lang }: { lang: 'fr' | 'en' }) {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [clinics, setClinics] = useState<ClinicSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getClinicSummariesAction().then((result) => {
      if ('error' in result) {
        setError(result.error)
      } else {
        setOverview(result.overview)
        setClinics(result.clinics)
      }
      setLoading(false)
    })
  }, [])

  if (loading) return <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Chargement…' : 'Loading…'}</p>
  if (error) return <p style={{ fontSize: '13px', color: 'var(--color-critical-text)' }}>{error}</p>
  if (!overview) return null

  const topByRevenue = [...clinics].sort((a, b) => b.revenue30dXaf - a.revenue30dXaf).slice(0, 5)

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <StatBlock label={lang === 'fr' ? 'Cliniques actives' : 'Active clinics'} value={overview.activeClinics} />
        <StatBlock label={lang === 'fr' ? 'Cliniques suspendues' : 'Suspended clinics'} value={overview.suspendedClinics} />
        <StatBlock label={lang === 'fr' ? 'Patients (total)' : 'Patients (total)'} value={overview.totalPatients.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} />
        <StatBlock label={lang === 'fr' ? 'Personnel actif' : 'Active staff'} value={overview.totalStaff} />
        <StatBlock label={lang === 'fr' ? 'Revenu (30j)' : 'Revenue (30d)'} value={fmtMoney(overview.totalRevenue30dXaf, lang)} />
      </div>

      <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 8px' }}>
        {lang === 'fr' ? 'Meilleures cliniques (revenu 30j)' : 'Top clinics (30d revenue)'}
      </p>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
        {topByRevenue.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', padding: '14px' }}>
            {lang === 'fr' ? 'Aucune donnée pour le moment.' : 'No data yet.'}
          </p>
        ) : topByRevenue.map((c, i) => (
          <div key={c.clinicId} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px',
            borderBottom: i < topByRevenue.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
          }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{c.clinicName}</span>
              {!c.isActive && (
                <span style={{ marginLeft: '8px', fontSize: '10px', padding: '1px 7px', borderRadius: '999px', background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)' }}>
                  {lang === 'fr' ? 'SUSPENDUE' : 'SUSPENDED'}
                </span>
              )}
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {c.patientCount} {lang === 'fr' ? 'patients' : 'patients'} · {c.staffCount} {lang === 'fr' ? 'personnel' : 'staff'}
              </div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}>{fmtMoney(c.revenue30dXaf, lang)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Clinics (manage) ────────────────────────────────────────────────────

function ClinicRow({ clinic, lang, onChanged }: { clinic: ClinicSummary; lang: 'fr' | 'en'; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(clinic.clinicName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRename() {
    setBusy(true)
    setError(null)
    const result = await renameClinicAction(clinic.clinicId, name)
    if (result && 'error' in result && result.error) {
      setError(result.error)
    } else {
      setEditing(false)
      onChanged()
    }
    setBusy(false)
  }

  async function handleToggleActive() {
    const confirmMsg = clinic.isActive
      ? (lang === 'fr'
          ? `Suspendre "${clinic.clinicName}" ? Le personnel ne pourra plus se connecter, mais aucune donnée ne sera supprimée.`
          : `Suspend "${clinic.clinicName}"? Staff will be signed out and unable to log in — no data is deleted.`)
      : (lang === 'fr'
          ? `Réactiver "${clinic.clinicName}" ?`
          : `Reactivate "${clinic.clinicName}"?`)
    if (!window.confirm(confirmMsg)) return

    setBusy(true)
    setError(null)
    const result = await setClinicActiveAction(clinic.clinicId, !clinic.isActive)
    if (result && 'error' in result && result.error) setError(result.error)
    else onChanged()
    setBusy(false)
  }

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          {editing ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: 1 }} autoFocus />
              <button onClick={handleRename} disabled={busy} style={{
                fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', cursor: 'pointer',
              }}>
                {lang === 'fr' ? 'Enregistrer' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setName(clinic.clinicName) }} style={{
                fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
              }}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
            </div>
          ) : (
            <div>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{clinic.clinicName}</span>
              {!clinic.isActive && (
                <span style={{ marginLeft: '8px', fontSize: '10px', padding: '1px 7px', borderRadius: '999px', background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)' }}>
                  {lang === 'fr' ? 'SUSPENDUE' : 'SUSPENDED'}
                </span>
              )}
              <button onClick={() => setEditing(true)} style={{
                marginLeft: '8px', fontSize: '11px', background: 'none', border: 'none',
                color: 'var(--color-accent)', cursor: 'pointer', textDecoration: 'underline',
              }}>
                {lang === 'fr' ? 'renommer' : 'rename'}
              </button>
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {lang === 'fr' ? 'Créée le' : 'Created'} {fmtDate(clinic.createdAt, lang)}
            {' · '}{clinic.patientCount} {lang === 'fr' ? 'patients' : 'patients'}
            {' · '}{clinic.staffCount} {lang === 'fr' ? 'personnel actif' : 'active staff'}
            {' · '}{fmtMoney(clinic.revenue30dXaf, lang)} {lang === 'fr' ? '(30j)' : '(30d)'}
          </div>
        </div>

        <button onClick={handleToggleActive} disabled={busy} style={{
          fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
          background: clinic.isActive ? 'var(--color-surface)' : 'var(--color-accent)',
          color: clinic.isActive ? 'var(--color-critical-text)' : 'var(--color-accent-text-on)',
          cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
        }}>
          {clinic.isActive
            ? (lang === 'fr' ? 'Suspendre' : 'Suspend')
            : (lang === 'fr' ? 'Réactiver' : 'Reactivate')}
        </button>
      </div>
      {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '8px 0 0' }}>{error}</p>}
    </div>
  )
}

function ClinicsTab({ lang }: { lang: 'fr' | 'en' }) {
  const [clinics, setClinics] = useState<ClinicSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    getClinicSummariesAction().then((result) => {
      if ('error' in result) setError(result.error)
      else setClinics(result.clinics)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  if (loading) return <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Chargement…' : 'Loading…'}</p>
  if (error) return <p style={{ fontSize: '13px', color: 'var(--color-critical-text)' }}>{error}</p>

  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 8px' }}>
        {lang === 'fr' ? `Cliniques (${clinics.length})` : `Clinics (${clinics.length})`}
      </p>
      {clinics.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucune clinique pour le moment.' : 'No clinics yet.'}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {clinics.map((c) => <ClinicRow key={c.clinicId} clinic={c} lang={lang} onChanged={load} />)}
        </div>
      )}
    </div>
  )
}

// ─── New clinic (original provisioning form) ──────────────────────────────

function NewClinicTab({ lang, clinics }: { lang: 'fr' | 'en'; clinics: ClinicListItem[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ clinicId: string; adminEmail: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null); setDetail(null); setSuccess(null); setSubmitting(true)
    const result = await provisionClinicAction(formData)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setDetail(result.detail ?? null)
    } else if (result?.success) {
      setSuccess({ clinicId: result.clinicId!, adminEmail: result.adminEmail! })
      router.refresh()
    }
    setSubmitting(false)
  }

  return (
    <form action={handleSubmit} style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '1.25rem',
    }}>
      <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>{lang === 'fr' ? 'Nouvelle clinique' : 'New clinic'}</p>

      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>{lang === 'fr' ? 'Nom de la clinique *' : 'Clinic name *'}</label>
        <input name="clinic_name" required style={inputStyle} placeholder={lang === 'fr' ? 'ex. Clinique Bonapriso Douala' : 'e.g. Bonapriso Douala Clinic'} />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>{lang === 'fr' ? 'Cloner le catalogue depuis' : 'Clone catalog from'}</label>
        <select name="template_clinic_id" style={inputStyle} defaultValue="">
          <option value="">{lang === 'fr' ? 'Clinique vide — aucun service, test, ou lit préconfiguré' : 'Blank clinic — no services, tests, or beds preconfigured'}</option>
          {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
          {lang === 'fr'
            ? "Copie les services, lits, et tout le catalogue de laboratoire de la clinique choisie — chaque test obtient sa propre fiche, indépendante de l'originale."
            : 'Copies services, beds, and the full lab catalog from the selected clinic — each test gets its own record, independent of the original.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? "Nom de l'administrateur *" : 'Admin full name *'}</label>
          <input name="admin_full_name" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'fr' ? "Email de l'administrateur *" : 'Admin email *'}</label>
          <input name="admin_email" type="email" required style={inputStyle} />
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', marginBottom: '10px' }}>
          <p style={{ margin: 0 }}>{error}</p>
          {detail && <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: '11px', opacity: 0.85 }}>{detail}</p>}
        </div>
      )}
      {success && (
        <div style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', marginBottom: '10px' }}>
          {lang === 'fr' ? 'Clinique créée et invitation envoyée à' : 'Clinic created and invitation sent to'} {success.adminEmail}.
        </div>
      )}

      <button type="submit" disabled={submitting} style={{
        padding: '9px 16px', border: 'none', borderRadius: 'var(--radius-sm)',
        background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
        fontSize: '13px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
      }}>
        {submitting ? (lang === 'fr' ? 'Création…' : 'Creating…') : (lang === 'fr' ? 'Créer la clinique' : 'Create clinic')}
      </button>
    </form>
  )
}

// ─── Audit log ─────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { fr: string; en: string; color: string }> = {
  provision_clinic:   { fr: 'Clinique créée',   en: 'Clinic created',    color: 'var(--color-accent)' },
  rename_clinic:       { fr: 'Renommée',         en: 'Renamed',           color: 'var(--color-text-secondary)' },
  suspend_clinic:      { fr: 'Suspendue',        en: 'Suspended',         color: 'var(--color-critical-text)' },
  reactivate_clinic:   { fr: 'Réactivée',        en: 'Reactivated',       color: 'var(--color-success-text)' },
  bootstrap_first_admin: { fr: 'Premier administrateur créé', en: 'First admin created', color: 'var(--color-accent)' },
  invite_admin:         { fr: 'Administrateur invité',         en: 'Admin invited',       color: 'var(--color-accent)' },
  deactivate_admin:     { fr: 'Administrateur désactivé',      en: 'Admin deactivated',   color: 'var(--color-critical-text)' },
  reactivate_admin:     { fr: 'Administrateur réactivé',       en: 'Admin reactivated',   color: 'var(--color-success-text)' },
}

function AuditLogTab({ lang }: { lang: 'fr' | 'en' }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlatformAuditLogAction().then((result) => {
      if (Array.isArray(result)) setEntries(result)
      else setError(result.error)
      setLoading(false)
    })
  }, [])

  if (loading) return <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Chargement…' : 'Loading…'}</p>
  if (error) return <p style={{ fontSize: '13px', color: 'var(--color-critical-text)' }}>{error}</p>

  return (
    <div>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
        {lang === 'fr'
          ? "Journal des actions effectuées via cette console — création, renommage, suspension. Les entrées antérieures au passage aux comptes individuels n'ont pas d'auteur identifié."
          : 'Log of actions taken through this console — creation, renaming, suspension. Entries from before individual accounts were introduced have no identified author.'}
      </p>
      {entries.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Aucune action enregistrée.' : 'No actions recorded yet.'}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {entries.map((e, i) => {
            const meta = ACTION_META[e.action]
            const detail = e.detail as any
            return (
              <div key={e.id} style={{
                padding: '10px 16px', fontSize: '13px',
                borderBottom: i < entries.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: meta?.color ?? 'var(--color-text-primary)' }}>
                      {meta?.[lang] ?? e.action}
                    </span>
                    {e.clinicName && (
                      <>{' — '}<span>{e.clinicName}</span></>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {fmtDateTime(e.createdAt, lang)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {e.adminName ?? (lang === 'fr' ? '— auteur inconnu —' : '— unknown author —')}
                    </div>
                  </div>
                </div>
                {e.action === 'rename_clinic' && detail?.from && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                    "{detail.from}" → "{detail.to}"
                  </p>
                )}
                {e.action === 'provision_clinic' && detail?.adminEmail && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                    {lang === 'fr' ? 'Admin invité :' : 'Admin invited:'} {detail.adminEmail}
                    {detail.clonedFrom && (lang === 'fr' ? ' · catalogue cloné' : ' · catalog cloned')}
                  </p>
                )}
                {e.action === 'invite_admin' && detail?.email && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                    {detail.fullName} ({detail.email})
                  </p>
                )}
                {(e.action === 'deactivate_admin' || e.action === 'reactivate_admin') && detail?.targetName && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                    {detail.targetName}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Admins (manage other platform admins) ─────────────────────────────────

function AdminRow({ admin, lang, currentAdminId, onChanged }: {
  admin: PlatformAdminListItem; lang: 'fr' | 'en'; currentAdminId: string; onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSelf = admin.id === currentAdminId

  async function handleToggle() {
    if (isSelf && admin.isActive) return // guarded server-side too, but no point showing a button that will just error
    const confirmMsg = admin.isActive
      ? (lang === 'fr' ? `Désactiver l'accès de ${admin.fullName} ?` : `Deactivate ${admin.fullName}'s access?`)
      : (lang === 'fr' ? `Réactiver l'accès de ${admin.fullName} ?` : `Reactivate ${admin.fullName}'s access?`)
    if (!window.confirm(confirmMsg)) return

    setBusy(true)
    setError(null)
    const result = await setPlatformAdminActiveAction(admin.id, !admin.isActive)
    if (result && 'error' in result && result.error) setError(result.error)
    else onChanged()
    setBusy(false)
  }

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{admin.fullName}</span>
          {isSelf && (
            <span style={{ marginLeft: '8px', fontSize: '10px', padding: '1px 7px', borderRadius: '999px', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)' }}>
              {lang === 'fr' ? 'VOUS' : 'YOU'}
            </span>
          )}
          {!admin.isActive && (
            <span style={{ marginLeft: '8px', fontSize: '10px', padding: '1px 7px', borderRadius: '999px', background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)' }}>
              {lang === 'fr' ? 'DÉSACTIVÉ' : 'DEACTIVATED'}
            </span>
          )}
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            {admin.email} · {lang === 'fr' ? 'depuis' : 'since'} {fmtDate(admin.createdAt, lang)}
            {admin.invitedByName && ` · ${lang === 'fr' ? 'invité par' : 'invited by'} ${admin.invitedByName}`}
          </div>
        </div>
        {!(isSelf && admin.isActive) && (
          <button onClick={handleToggle} disabled={busy} style={{
            fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: admin.isActive ? 'var(--color-surface)' : 'var(--color-accent)',
            color: admin.isActive ? 'var(--color-critical-text)' : 'var(--color-accent-text-on)',
            cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          }}>
            {admin.isActive ? (lang === 'fr' ? 'Désactiver' : 'Deactivate') : (lang === 'fr' ? 'Réactiver' : 'Reactivate')}
          </button>
        )}
      </div>
      {error && <p style={{ fontSize: '11px', color: 'var(--color-critical-text)', margin: '6px 0 0' }}>{error}</p>}
    </div>
  )
}

function AdminsTab({ lang, currentAdmin }: { lang: 'fr' | 'en'; currentAdmin: CurrentPlatformAdmin }) {
  const [admins, setAdmins] = useState<PlatformAdminListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<{ email: string; reactivated: boolean } | null>(null)
  const [inviting, setInviting] = useState(false)

  function load() {
    setLoading(true)
    listPlatformAdminsAction().then((result) => {
      if ('error' in result) setError(result.error)
      else setAdmins(result)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  async function handleInvite(formData: FormData) {
    setInviteError(null); setInviteSuccess(null); setInviting(true)
    const result = await invitePlatformAdminAction(formData)
    if (result && 'error' in result && result.error) {
      setInviteError(result.error)
    } else {
      setInviteSuccess({
        email: formData.get('email') as string,
        reactivated: !!(result && 'reactivated' in result && result.reactivated),
      })
      load()
    }
    setInviting(false)
  }

  return (
    <div>
      <form action={handleInvite} style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem',
      }}>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>
          {lang === 'fr' ? 'Inviter un administrateur' : 'Invite an administrator'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={labelStyle}>{lang === 'fr' ? 'Nom complet *' : 'Full name *'}</label>
            <input name="full_name" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input name="email" type="email" required style={inputStyle} />
          </div>
        </div>
        {inviteError && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', margin: '0 0 10px' }}>{inviteError}</p>}
        {inviteSuccess && (
          <p style={{ fontSize: '12px', color: 'var(--color-success-text)', margin: '0 0 10px' }}>
            {inviteSuccess.reactivated
              ? (lang === 'fr' ? 'Compte réactivé pour' : 'Account reactivated for')
              : (lang === 'fr' ? 'Invitation envoyée à' : 'Invitation sent to')} {inviteSuccess.email}.
          </p>
        )}
        <button type="submit" disabled={inviting} style={{
          padding: '9px 16px', border: 'none', borderRadius: 'var(--radius-sm)',
          background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
          fontSize: '13px', fontWeight: 500, cursor: inviting ? 'default' : 'pointer', opacity: inviting ? 0.7 : 1,
        }}>
          {inviting ? (lang === 'fr' ? 'Envoi…' : 'Sending…') : (lang === 'fr' ? 'Envoyer l\'invitation' : 'Send invitation')}
        </button>
      </form>

      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 8px' }}>
        {lang === 'fr' ? `Administrateurs (${admins.length})` : `Admins (${admins.length})`}
      </p>
      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? 'Chargement…' : 'Loading…'}</p>
      ) : error ? (
        <p style={{ fontSize: '13px', color: 'var(--color-critical-text)' }}>{error}</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {admins.map((a) => (
            <AdminRow key={a.id} admin={a} lang={lang} currentAdminId={currentAdmin.id} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}
