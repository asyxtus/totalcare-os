'use client'

// components/LaboratoryQueueTabs.tsx

import { useState } from 'react'
import Link from 'next/link'
import { TabBar, type TabDef } from '@/components/ui'
import { ListTodo, CheckCircle2 } from 'lucide-react'

interface CatalogItem { id: string; name_fr: string; name_en?: string | null }

const STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  pending: { fr: 'En attente de prélèvement', en: 'Awaiting sample' },
  sample_collected: { fr: 'Prélevé — en cours', en: 'Sample collected' },
}

type Tab = 'queue' | 'completed'

export default function LaboratoryQueueTabs({
  lang, pendingItems, unverifiedItems, completedItems, panels, tests,
}: {
  lang: 'fr' | 'en'
  pendingItems: any[]
  unverifiedItems: any[]
  completedItems: any[]
  panels: CatalogItem[]
  tests: CatalogItem[]
}) {
  const [tab, setTab] = useState<Tab>('queue')
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'

  const tabs: TabDef<Tab>[] = [
    { id: 'queue', label: lang === 'fr' ? 'File active' : 'Active Queue', icon: ListTodo },
    { id: 'completed', label: lang === 'fr' ? 'Terminés' : 'Completed', icon: CheckCircle2 },
  ]

  const panelName = (id: string | null) => {
    const p = panels.find((x) => x.id === id)
    return (lang === 'en' && p?.name_en) ? p.name_en : (p?.name_fr ?? '—')
  }
  const testName = (id: string | null) => {
    const t = tests.find((x) => x.id === id)
    return (lang === 'en' && t?.name_en) ? t.name_en : (t?.name_fr ?? '—')
  }
  function itemLabel(item: any): string {
    if (item.item_type === 'panel') return panelName(item.lab_panel_id)
    if (item.item_type === 'individual_test') return testName(item.lab_test_catalog_id)
    return `${item.external_test_name} (${lang === 'fr' ? 'externe' : 'external'})`
  }

  // Tests ordered together (same lab_order_id) grouped under one card —
  // a patient with 3 tests from one visit shouldn't repeat their name 3
  // times. Used for all three lists (pending, unverified, completed) so
  // the same visual grouping applies everywhere, not just the pending
  // queue as before.
  function groupByOrder(list: any[]) {
    const groups = new Map<string, { order: any; patient: any; items: any[] }>()
    for (const item of list) {
      const orderId = item.lab_order_id
      if (!groups.has(orderId)) {
        groups.set(orderId, { order: item.lab_orders, patient: item.lab_orders?.visits?.patients, items: [] })
      }
      groups.get(orderId)!.items.push(item)
    }
    return Array.from(groups.values())
  }

  function firstResultOf(item: any) {
    const r = item.lab_results
    if (!r) return null
    return Array.isArray(r) ? (r[0] ?? null) : r
  }

  // Date AND time — previously only the date showed, which doesn't
  // distinguish two orders placed hours apart on the same day.
  function fmtOrderedAt(iso: string | null | undefined) {
    if (!iso) return null
    return new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const pendingGroups = groupByOrder(pendingItems)
  const unverifiedGroups = groupByOrder(unverifiedItems)
  const completedGroups = groupByOrder(completedItems)

  return (
    <div>
      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      <div style={{ marginTop: '1rem' }}>
        {tab === 'queue' && (
          <>
            {pendingItems.length === 0 && unverifiedItems.length === 0 && (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                {lang === 'fr' ? 'Aucun examen en attente.' : 'No tests pending.'}
              </p>
            )}

            {pendingGroups.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: unverifiedGroups.length > 0 ? '1.25rem' : 0 }}>
                {pendingGroups.map((group) => {
                  const patient = group.patient
                  const orderedAt = fmtOrderedAt(group.order?.ordered_at)
                  return (
                    <div key={group.order?.id ?? group.items[0].id} style={{
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        padding: '10px 16px', borderBottom: '1px solid var(--color-border-subtle)',
                        background: 'var(--color-bg)',
                      }}>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{patient?.full_name ?? '—'}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                            {patient?.patient_code}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {group.items.length > 1 && (
                            <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '999px', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)' }}>
                              {group.items.length} {lang === 'fr' ? 'examens' : 'tests'}
                            </span>
                          )}
                          {orderedAt && (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                              {lang === 'fr' ? 'Prescrit' : 'Ordered'} {orderedAt}
                            </span>
                          )}
                        </div>
                      </div>

                      {group.items.map((item: any, i: number) => {
                        const isExternal = item.item_type === 'external'
                        return (
                          <div key={item.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 16px',
                            borderBottom: i < group.items.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                          }}>
                            <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                              {itemLabel(item)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                                background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)',
                              }}>
                                {STATUS_LABELS[item.status]?.[lang] ?? item.status}
                              </span>
                              {isExternal ? (
                                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                  {lang === 'fr' ? "Envoyé à l'extérieur — pas de résultat à saisir ici" : 'Sent externally — no result to enter here'}
                                </span>
                              ) : (
                                <Link href={`/laboratory/${item.id}`} style={{
                                  fontSize: '12px', color: 'var(--color-accent)', textDecoration: 'none',
                                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px',
                                }}>
                                  {lang === 'fr' ? 'Ouvrir →' : 'Open →'}
                                </Link>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}

            {unverifiedGroups.length > 0 && (
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 8px', color: 'var(--color-warning-text)' }}>
                  ⚠ {lang === 'fr' ? 'Résultats saisis en attente de validation' : 'Results entered, awaiting verification'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {unverifiedGroups.map((group) => {
                    const patient = group.patient
                    const orderedAt = fmtOrderedAt(group.order?.ordered_at)
                    return (
                      <div key={group.order?.id ?? group.items[0].id} style={{
                        background: 'var(--color-surface)', border: '1px solid var(--color-warning-text)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                      }}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                          padding: '10px 16px', borderBottom: '1px solid var(--color-border-subtle)',
                          background: 'var(--color-bg)',
                        }}>
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{patient?.full_name ?? '—'}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                              {patient?.patient_code}
                            </span>
                          </div>
                          {orderedAt && (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                              {lang === 'fr' ? 'Prescrit' : 'Ordered'} {orderedAt}
                            </span>
                          )}
                        </div>
                        {group.items.map((item: any, i: number) => (
                          <div key={item.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 16px',
                            borderBottom: i < group.items.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                          }}>
                            <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>{itemLabel(item)}</span>
                            <Link href={`/laboratory/${item.id}`} style={{
                              fontSize: '12px', color: 'var(--color-accent)', textDecoration: 'none',
                              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px',
                            }}>
                              {lang === 'fr' ? 'Valider →' : 'Verify →'}
                            </Link>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'completed' && (
          <>
            {completedGroups.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                {lang === 'fr' ? 'Aucun examen terminé récemment.' : 'No tests completed recently.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {completedGroups.map((group) => {
                  const patient = group.patient
                  const orderedAt = fmtOrderedAt(group.order?.ordered_at)
                  return (
                    <div key={group.order?.id ?? group.items[0].id} style={{
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        padding: '10px 16px', borderBottom: '1px solid var(--color-border-subtle)',
                        background: 'var(--color-bg)',
                      }}>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{patient?.full_name ?? '—'}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                            {patient?.patient_code}
                          </span>
                        </div>
                        {orderedAt && (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            {lang === 'fr' ? 'Prescrit' : 'Ordered'} {orderedAt}
                          </span>
                        )}
                      </div>
                      {group.items.map((item: any, i: number) => {
                        const result = firstResultOf(item)
                        const hasValue = !!result
                        const value = result?.numeric_value != null ? String(result.numeric_value) : (result?.qualitative_value ?? null)
                        const flagged = result?.is_critical || result?.is_abnormal
                        return (
                          <div key={item.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 16px',
                            borderBottom: i < group.items.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                            color: result?.is_critical ? 'var(--color-critical-text)' : result?.is_abnormal ? 'var(--color-warning-text)' : 'var(--color-text-primary)',
                          }}>
                            <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                              {itemLabel(item)}
                              {result?.is_critical && (lang === 'fr' ? ' ⚠ CRITIQUE' : ' ⚠ CRITICAL')}
                              {result?.is_abnormal && !result?.is_critical && (lang === 'fr' ? ' (anormal)' : ' (abnormal)')}
                            </span>
                            {hasValue ? (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: flagged ? 600 : 400 }}>{value ?? '—'}</span>
                            ) : (
                              <Link href={`/laboratory/${item.id}`} style={{ fontSize: '12px', color: 'var(--color-accent)', textDecoration: 'none' }}>
                                {lang === 'fr' ? 'Voir la pièce jointe →' : 'View attachment →'}
                              </Link>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}