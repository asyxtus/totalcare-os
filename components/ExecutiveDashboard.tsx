'use client'

// Pure display component — all data pre-fetched server-side.
// Audit fixes applied here: (1) period-over-period comparison, since a
// raw number alone tells an owner nothing about whether today is good
// or bad; (2) routine vs overdue unpaid balances get genuinely different
// visual treatment, since alarming on every normal in-progress payment
// trains the eye to ignore the color entirely; (3) alert cards move to
// the top and get a summary banner when anything is actually active,
// so attention goes where it's needed instead of wherever happened to
// be first in the layout.

import { Bar, DeltaBadge, Card } from '@/components/dashboard/DashboardWidgets'
import { useLang } from '@/lib/i18n/LangContext'

const STAGE_LABELS: Record<string, { fr: string; en: string }> = {
  registered:           { fr: 'Enregistrement → triage',  en: 'Registration → triage' },
  triage:               { fr: 'Triage → médecin',          en: 'Triage → doctor' },
  waiting_consultation: { fr: 'Attente médecin',           en: 'Waiting for doctor' },
  in_consultation:      { fr: 'Consultation',              en: 'Consultation' },
  waiting_lab:          { fr: 'Attente laboratoire',       en: 'Waiting for lab' },
  waiting_pharmacy:     { fr: 'Attente pharmacie',         en: 'Waiting for pharmacy' },
  billing:              { fr: 'Attente caisse',            en: 'Waiting for cashier' },
}

// Format minutes into a readable "Xh Ym" or "Ym" string
function formatMinutes(min: number, lang: 'fr' | 'en'): string {
  if (min < 1) return lang === 'fr' ? '< 1 min' : '< 1 min'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m} min`
}

interface DayValue { date: string; value: number }
interface StaffProductivity { name: string; count: number }

interface ExecutiveDashboardProps {
  lang: 'fr' | 'en'
  revenueTrend: DayValue[]
  revenueDeltaPct: number | null
  todayRevenueByMethod: { method: string; total: number }[]
  visitTrend: DayValue[]
  visitDeltaPct: number | null
  doctorProductivityToday: StaffProductivity[]
  labProductivityToday: StaffProductivity[]
  outstanding: {
    totalOutstandingXaf: number
    unpaidChargeCount: number
    emergencyUnpaidCount: number
    overdueOutstandingXaf: number
    overdueChargeCount: number
  }
  compliance: { pendingPrescriptionReviews: number; pendingShiftVarianceReviews: number; pendingDiscountApprovals: number }
  inventory: { expiringSoonCount: number; lowStockProductCount: number }
  hasActiveAlerts: boolean
  margin: {
    totalRevenueXaf: number
    totalCostXaf: number
    totalProfitXaf: number
    marginPct: number | null
    dataCoveragePct: number | null
  }
  waitByStage?: { stage: string; avgMinutes: number; medianMinutes: number; maxMinutes: number; visitCount: number }[]
  waitByDoctor?: { doctorName: string; avgWaitToDoctorMin: number; avgConsultMin: number; patientsSeen: number }[]
}


export default function ExecutiveDashboard({
  revenueTrend, revenueDeltaPct, todayRevenueByMethod, visitTrend, visitDeltaPct,
  doctorProductivityToday, labProductivityToday, outstanding, compliance, inventory, hasActiveAlerts, margin,
  waitByStage = [], waitByDoctor = [],
}: ExecutiveDashboardProps) {
  const lang = useLang()
  const METHOD_LABELS: Record<string, string> = {
    cash: lang === 'fr' ? 'Comptant' : 'Cash',
    momo: 'MTN MoMo',
    orange_money: 'Orange Money',
    mixed: lang === 'fr' ? 'Mixte' : 'Mixed',
  }
  const maxRevenue = Math.max(...revenueTrend.map((d) => d.value), 1)
  const maxVisits = Math.max(...visitTrend.map((d) => d.value), 1)
  const todayTotal = todayRevenueByMethod.reduce((sum, m) => sum + m.total, 0)

  const hasComplianceAlerts = compliance.pendingPrescriptionReviews + compliance.pendingShiftVarianceReviews + compliance.pendingDiscountApprovals > 0
  const hasInventoryAlerts = inventory.expiringSoonCount + inventory.lowStockProductCount > 0
  const hasOverdue = outstanding.overdueChargeCount > 0

  const alertCards = (
    <>
      <Card title={lang==='fr'?'Conformité':'Compliance'}>
        {!hasComplianceAlerts && <p style={{ fontSize: '13px', color: 'var(--color-success-text)' }}>{lang==='fr'?'Rien en attente':'Nothing pending'}</p>}
        {compliance.pendingPrescriptionReviews > 0 && (
          <p style={{ fontSize: '13px', margin: '4px 0' }}>{compliance.pendingPrescriptionReviews} {lang==='fr'?'ordonnance(s) en attente de révision':'prescription(s) awaiting review'}</p>
        )}
        {compliance.pendingShiftVarianceReviews > 0 && (
          <p style={{ fontSize: '13px', margin: '4px 0' }}>{compliance.pendingShiftVarianceReviews} {lang==='fr'?'écart(s) de caisse à examiner':'cash variance(s) to review'}</p>
        )}
        {compliance.pendingDiscountApprovals > 0 && (
          <p style={{ fontSize: '13px', margin: '4px 0' }}>{compliance.pendingDiscountApprovals} {lang==='fr'?"remise(s) en attente d'approbation":'discount(s) awaiting approval'}</p>
        )}
      </Card>

      <Card title={lang==='fr'?'Stock':'Inventory'}>
        {!hasInventoryAlerts && <p style={{ fontSize: '13px', color: 'var(--color-success-text)' }}>{lang==='fr'?'Rien à signaler':'Nothing to report'}</p>}
        {inventory.expiringSoonCount > 0 && (
          <p style={{ fontSize: '13px', margin: '4px 0' }}>{inventory.expiringSoonCount} {lang==='fr'?'lot(s) expirant sous 30 jours':'batch(es) expiring within 30 days'}</p>
        )}
        {inventory.lowStockProductCount > 0 && (
          <p style={{ fontSize: '13px', margin: '4px 0' }}>{inventory.lowStockProductCount} {lang==='fr'?'produit(s) sous le seuil de réapprovisionnement':'product(s) below reorder threshold'}</p>
        )}
      </Card>

      <Card title={lang==='fr'?'Argent en attente':'Outstanding balance'}>
        <p style={{
          fontSize: '20px', fontWeight: 500, margin: '0 0 4px', fontFamily: 'var(--font-mono)',
          color: hasOverdue ? 'var(--color-warning-text)' : 'var(--color-text-primary)',
        }}>
          {outstanding.totalOutstandingXaf.toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
          {outstanding.unpaidChargeCount} {lang==='fr'?'frais en cours — normal pour des paiements récents/partiels':'charge(s) in progress — normal for recent/partial payments'}
        </p>
        {hasOverdue && (
          <p style={{ fontSize: '12px', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', margin: '0 0 6px' }}>
            {outstanding.overdueChargeCount} {lang==='fr'?'frais impayé(s) depuis plus de 3 jours —':'overdue charges —'} {outstanding.overdueOutstandingXaf.toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA
          </p>
        )}
        {outstanding.emergencyUnpaidCount > 0 && (
          <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
            ⚠ {outstanding.emergencyUnpaidCount} {lang==='fr'?"visite(s) d'urgence encore impayée(s)":'unpaid emergency visit(s)'}
          </p>
        )}
      </Card>
    </>
  )

  return (
    <div>
      {hasActiveAlerts && (
        <div style={{
          background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '13px', fontWeight: 500,
        }}>
          ⚠ {lang==='fr'?'Des éléments ci-dessous nécessitent votre attention':'Some items below need your attention'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: hasActiveAlerts ? '12px' : 0 }}>
        {hasActiveAlerts && alertCards}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: hasActiveAlerts ? '12px' : 0 }}>
        <Card title={lang==='fr'?'Recettes — 7 derniers jours':'Revenue — last 7 days'}>
          <p style={{ fontSize: '20px', fontWeight: 500, margin: '0 0 4px', fontFamily: 'var(--font-mono)' }}>
            {todayTotal.toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-ui)' }}>{lang==='fr'?"aujourd'hui":'today'}</span>
          </p>
          <div style={{ marginBottom: '10px' }}><DeltaBadge pct={revenueDeltaPct} lang={lang} /></div>
          {revenueTrend.map((d) => (
            <Bar key={d.date} label={d.date.slice(5)} value={d.value} max={maxRevenue} lang={lang} />
          ))}
          {todayRevenueByMethod.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {todayRevenueByMethod.map((m) => (
                <span key={m.method} style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  {METHOD_LABELS[m.method] ?? m.method}: <strong style={{ color: 'var(--color-text-primary)' }}>{m.total.toLocaleString(lang==='fr'?'fr-FR':'en-US')}</strong>
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card title={lang==='fr'?'Volume de patients — 7 derniers jours':'Patient volume — last 7 days'}>
          <div style={{ marginBottom: '10px' }}><DeltaBadge pct={visitDeltaPct} lang={lang} /></div>
          {visitTrend.map((d) => (
            <Bar key={d.date} label={d.date.slice(5)} value={d.value} max={maxVisits} lang={lang} />
          ))}
        </Card>

        <Card title={lang==='fr'?"Productivité — aujourd'hui":"Productivity — today"}>
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 6px' }}>{lang==='fr'?'Consultations par médecin':'Consultations by doctor'}</p>
          {doctorProductivityToday.length === 0 && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?"Aucune consultation terminée aujourd'hui.":'No consultations completed today.'}</p>}
          {doctorProductivityToday.map((d) => (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
              <span>{d.name}</span><span style={{ fontFamily: 'var(--font-mono)' }}>{d.count}</span>
            </div>
          ))}
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '10px 0 6px' }}>{lang==='fr'?'Résultats saisis par technicien':'Results entered by technician'}</p>
          {labProductivityToday.length === 0 && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?"Aucun résultat saisi aujourd'hui.":'No results recorded today.'}</p>}
          {labProductivityToday.map((d) => (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
              <span>{d.name}</span><span style={{ fontFamily: 'var(--font-mono)' }}>{d.count}</span>
            </div>
          ))}
        </Card>

        <Card title={lang==='fr'?'Marge bénéficiaire — 30 jours':'Profit margin — 30 days'}>
          {margin.totalRevenueXaf === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucune vente sur cette période.':'No sales in this period.'}</p>
          ) : margin.marginPct === null ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {lang==='fr'?'Aucun coût de revient renseigné sur les produits vendus — impossible de calculer la marge.':'No cost data entered for sold products — cannot calculate margin.'}
            </p>
          ) : (
            <>
              <p style={{ fontSize: '20px', fontWeight: 500, margin: '0 0 4px', fontFamily: 'var(--font-mono)' }}>
                {margin.marginPct}%
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-ui)', marginLeft: '8px' }}>
                  marge
                </span>
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
                {lang==='fr'?'Profit':'Profit'} : {margin.totalProfitXaf.toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA
                {' · '}{lang==='fr'?'Coût':'Cost'} : {margin.totalCostXaf.toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA
              </p>
              {margin.dataCoveragePct !== null && margin.dataCoveragePct < 100 && (
                <p style={{ fontSize: '11px', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: '5px 8px', borderRadius: 'var(--radius-sm)' }}>
                  Calculé sur {margin.dataCoveragePct}% des ventes — coût de revient manquant pour le reste
                </p>
              )}
            </>
          )}
        </Card>

        {!hasActiveAlerts && alertCards}
      </div>

      {/* Wait-time analytics — the number patients complain about */}
      {(waitByStage.length > 0 || waitByDoctor.length > 0) && (
        <div style={{ marginTop: '20px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }}>
            {lang === 'fr' ? "Temps d'attente (7 derniers jours)" : 'Wait times (last 7 days)'}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
            {lang === 'fr'
              ? "Temps moyen passé à chaque étape avant de passer à la suivante."
              : 'Average time spent at each stage before moving to the next.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {/* By stage */}
            {waitByStage.length > 0 && (
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {lang === 'fr' ? 'Par étape' : 'By stage'}
                </p>
                {waitByStage.map((w) => {
                  const label = STAGE_LABELS[w.stage]?.[lang] ?? w.stage
                  // Flag stages averaging over 30 min as slow
                  const slow = w.avgMinutes > 30
                  return (
                    <div key={w.stage} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <span style={{ fontSize: '13px' }}>{label}</span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: slow ? 'var(--color-warning-text)' : 'var(--color-text-primary)' }}>
                          {formatMinutes(w.avgMinutes, lang)}
                        </span>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                          {lang === 'fr' ? 'médian' : 'median'} {formatMinutes(w.medianMinutes, lang)} · max {formatMinutes(w.maxMinutes, lang)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* By doctor */}
            {waitByDoctor.length > 0 && (
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {lang === 'fr' ? 'Par médecin' : 'By doctor'}
                </p>
                {waitByDoctor.map((w) => (
                  <div key={w.doctorName} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{w.doctorName}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {w.patientsSeen} {lang === 'fr' ? 'patient(s)' : 'patient(s)'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {lang === 'fr' ? "Attente avant médecin" : 'Wait before doctor'}: <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatMinutes(w.avgWaitToDoctorMin, lang)}</strong>
                      {' · '}
                      {lang === 'fr' ? 'Durée consultation' : 'Consult length'}: <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatMinutes(w.avgConsultMin, lang)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
