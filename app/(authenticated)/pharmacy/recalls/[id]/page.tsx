// app/(authenticated)/pharmacy/recalls/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import ResolveRecallForm from '@/components/ResolveRecallForm'

export default async function RecallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: recall, error } = await supabase
    .from('batch_recalls')
    .select('id, reason, status, initiated_at, resolution_notes, resolved_at, batch_id, initiated_by, batches(batch_number, expiry_date, products(name))')
    .eq('id', id)
    .maybeSingle()

  if (error || !recall) notFound()

  const batch = recall.batches as any
  // batch_recalls has TWO FKs to staff (initiated_by, resolved_by) — a
  // bare staff(full_name) nested join is ambiguous and errors, which
  // notFound() above would silently render as a 404. Same pattern as
  // prescriptions/discounts/cashier_shifts before it: resolve the name
  // in a separate query instead.
  let initiator: { full_name: string } | null = null
  if (recall.initiated_by) {
    const { data: staffRow } = await supabase.from('staff').select('full_name').eq('id', recall.initiated_by).maybeSingle()
    initiator = staffRow
  }

  const { data: impact, error: impactError } = await supabase.rpc('get_recall_patient_impact', { p_batch_id: recall.batch_id })
  const { data: unidentifiedCount, error: unidentifiedError } = await supabase.rpc('get_recall_unidentified_pos_count', { p_batch_id: recall.batch_id })

  return (
    <div style={{ maxWidth: '650px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <Link href="/pharmacy/recalls" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}>←</Link>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>
            {batch?.products?.name} — lot {batch?.batch_number}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {lang==='fr'?'Lancé le':'Initiated'} {new Date(recall.initiated_at).toLocaleDateString(locale)} {lang==='fr'?'par':'by'} {initiator?.full_name}
          </p>
        </div>
      </div>

      <div style={{
        background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
        padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '13px',
      }}>
        <strong>Motif :</strong> {recall.reason}
      </div>

      {(impactError || unidentifiedError) && (
        <div style={{
          background: 'var(--color-critical-bg)', color: 'var(--color-critical-text)',
          padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '13px', fontWeight: 500,
        }}>
          {lang === 'fr'
            ? '⚠ LE CALCUL DE TRAÇABILITÉ A ÉCHOUÉ — ceci n\'est PAS la même chose que « aucun patient concerné ». La liste ci-dessous peut être incomplète ou vide à cause d\'une erreur technique, pas parce qu\'il n\'y a réellement personne à contacter. Ne pas considérer ce rappel comme sans risque tant que l\'erreur suivante n\'est pas corrigée :'
            : '⚠ TRACEABILITY CALCULATION FAILED — this is NOT the same as "no patient concerned". The list below may be incomplete or empty due to a technical error, not because there is truly no one to contact. Do not consider this recall safe until the following error is fixed:'}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginTop: '6px' }}>
            {impactError?.message}{unidentifiedError?.message}
          </div>
        </div>
      )}

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
        {lang === 'fr' ? 'Patients concernés' : 'Affected patients'} ({(impact ?? []).length})
      </p>

      {(!impact || impact.length === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          {lang === 'fr' ? 'Aucun patient identifié pour ce lot.' : 'No patients identified for this batch.'}
        </p>
      )}

      {impact && impact.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
          {impact.map((row: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
              borderBottom: i < impact.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: '13px' }}>{row.patient_name}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {row.patient_phone ?? (lang==='fr'?'Pas de téléphone enregistré':'No phone on record')} · {new Date(row.dispensed_at).toLocaleDateString(locale)}
                </div>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{row.quantity} {lang === 'fr' ? 'unité(s)' : 'unit(s)'}</span>
            </div>
          ))}
        </div>
      )}

      {(unidentifiedCount ?? 0) > 0 && (
        <div style={{
          background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '13px',
        }}>
          ⚠ {unidentifiedCount} {lang === 'fr' ? "vente(s) au comptoir (POS) de ce lot n'ont pas pu être tracées — aucun" : 'POS sale(s) from this batch could not be traced — no'}
          {lang === 'fr' ? "patient n'était lié à ces ventes anonymes. Ces clients ne peuvent pas être contactés directement." : 'patient was linked to these anonymous sales. These customers cannot be contacted directly.'}
        </div>
      )}

      {recall.status === 'active' ? (
        <ResolveRecallForm recallId={recall.id} />
      ) : (
        <div style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
          ✓ {lang==='fr'?`Résolu le ${recall.resolved_at ? new Date(recall.resolved_at).toLocaleDateString(locale) : ''}`:`Resolved ${recall.resolved_at ? new Date(recall.resolved_at).toLocaleDateString(locale) : ''}`}{recall.resolved_at ? new Date(recall.resolved_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US') : ''} — {recall.resolution_notes}
        </div>
      )}
    </div>
  )
}
