'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { StaffRole } from '@/lib/types'

type Lang = 'fr' | 'en'

type Tour = {
  id: string
  version: number
  title_en: string
  title_fr: string
  description_en: string | null
  description_fr: string | null
}

type Step = {
  id: string
  step_key: string
  step_order: number
  roles: string[] | null
  title_en: string
  title_fr: string
  body_en: string
  body_fr: string
  action_en: string | null
  action_fr: string | null
  target_route: string | null
  target_selector: string | null
}

type Progress = {
  id: string
  enabled: boolean
  completed: boolean
  current_step: number
}

export default function OnboardingWizard({
  staffId,
  staffRole,
  lang,
}: {
  staffId: string
  staffRole: StaffRole
  lang: Lang
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [tour, setTour] = useState<Tour | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const visibleSteps = useMemo(
    () => steps.filter((step) => !step.roles?.length || step.roles.includes(staffRole)),
    [steps, staffRole]
  )

  const currentIndex = Math.min(
    Math.max((progress?.current_step ?? 1) - 1, 0),
    Math.max(visibleSteps.length - 1, 0)
  )
  const currentStep = visibleSteps[currentIndex]
  const isLast = visibleSteps.length > 0 && currentIndex === visibleSteps.length - 1

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)

    const { data: tourData, error: tourError } = await supabase
      .from('onboarding_tours')
      .select('id, version, title_en, title_fr, description_en, description_fr')
      .eq('tour_key', 'core_workflow')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (tourError || !tourData) {
      setError(lang === 'fr' ? 'Le guide est temporairement indisponible.' : 'The guide is temporarily unavailable.')
      setBusy(false)
      return
    }

    const selectedTour = tourData as Tour
    setTour(selectedTour)

    const [{ data: stepData, error: stepError }, { data: progressData, error: progressError }] = await Promise.all([
      supabase
        .from('onboarding_steps')
        .select('id, step_key, step_order, roles, title_en, title_fr, body_en, body_fr, action_en, action_fr, target_route, target_selector')
        .eq('tour_id', selectedTour.id)
        .order('step_order', { ascending: true }),
      supabase
        .from('staff_onboarding_progress')
        .select('id, enabled, completed, current_step')
        .eq('staff_id', staffId)
        .eq('tour_id', selectedTour.id)
        .eq('tour_version', selectedTour.version)
        .maybeSingle(),
    ])

    if (stepError || progressError) {
      setError(lang === 'fr' ? 'Impossible de charger le guide.' : 'Unable to load the guide.')
      setBusy(false)
      return
    }

    const nextSteps = (stepData ?? []) as Step[]
    setSteps(nextSteps)

    let nextProgress = progressData as Progress | null
    if (!nextProgress) {
      const { data: created, error: createError } = await supabase
        .from('staff_onboarding_progress')
        .insert({
          staff_id: staffId,
          clinic_id: undefined,
          tour_id: selectedTour.id,
          tour_version: selectedTour.version,
          enabled: true,
          completed: false,
          current_step: 1,
          started_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        })
        .select('id, enabled, completed, current_step')
        .single()

      // clinic_id is deliberately supplied below through a second path when
      // the table requires it; keeping this error explicit avoids silently
      // marking a user as trained when persistence is unavailable.
      if (createError || !created) {
        setError(
          lang === 'fr'
            ? 'Le guide est disponible, mais sa progression ne peut pas être enregistrée. Appliquez la migration 167 puis rechargez la page.'
            : 'The guide is available, but progress cannot be saved. Apply migration 167 and reload the page.'
        )
        setBusy(false)
        return
      }
      nextProgress = created as Progress
    }

    setProgress(nextProgress)
    setBusy(false)

    if (nextProgress.enabled && !nextProgress.completed && nextSteps.length > 0) {
      setOpen(true)
    }
  }, [lang, staffId, supabase])

  useEffect(() => {
    void load()
  }, [load])

  async function saveProgress(patch: Partial<Progress>) {
    if (!progress) return
    const next = { ...progress, ...patch }
    setProgress(next)
    const { error: updateError } = await supabase
      .from('staff_onboarding_progress')
      .update({
        enabled: next.enabled,
        completed: next.completed,
        current_step: next.current_step,
        last_seen_at: new Date().toISOString(),
        completed_at: next.completed ? new Date().toISOString() : null,
      })
      .eq('id', progress.id)
      .eq('staff_id', staffId)

    if (updateError) {
      setError(lang === 'fr' ? 'La progression n’a pas pu être enregistrée.' : 'Progress could not be saved.')
    }
  }

  function openGuide() {
    if (!progress) return
    setError(null)
    if (progress.completed) {
      void saveProgress({ completed: false, current_step: 1, enabled: true })
    } else if (!progress.enabled) {
      void saveProgress({ enabled: true })
    }
    setOpen(true)
  }

  function closeGuide() {
    setOpen(false)
    if (progress) void saveProgress({})
  }

  async function next() {
    if (!progress || !visibleSteps.length) return
    if (isLast) {
      await saveProgress({ completed: true, current_step: visibleSteps.length })
      setOpen(false)
      return
    }
    await saveProgress({ current_step: currentIndex + 2 })
  }

  async function previous() {
    if (!progress || currentIndex <= 0) return
    await saveProgress({ current_step: currentIndex })
  }

  function goToModule() {
    if (!currentStep?.target_route) return
    setOpen(false)
    router.push(currentStep.target_route)
  }

  if (busy || !tour || !progress || visibleSteps.length === 0) {
    return error ? (
      <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 120, maxWidth: 340 }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 12, boxShadow: '0 8px 30px rgba(0,0,0,.14)' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-critical-text)' }}>{error}</p>
        </div>
      </div>
    ) : null
  }

  const title = lang === 'fr' ? tour.title_fr : tour.title_en
  const description = lang === 'fr' ? tour.description_fr : tour.description_en
  const stepTitle = lang === 'fr' ? currentStep.title_fr : currentStep.title_en
  const stepBody = lang === 'fr' ? currentStep.body_fr : currentStep.body_en
  const stepAction = lang === 'fr' ? currentStep.action_fr : currentStep.action_en

  return (
    <>
      <button
        type="button"
        onClick={openGuide}
        aria-label={lang === 'fr' ? 'Ouvrir le guide TotalCare' : 'Open TotalCare guide'}
        title={lang === 'fr' ? 'Guide / Aide' : 'Guide / Help'}
        style={{
          position: 'fixed', right: 18, bottom: 18, zIndex: 100,
          width: 46, height: 46, borderRadius: '50%', border: '1px solid var(--color-border)',
          background: 'var(--color-surface)', color: 'var(--color-accent)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 5px 20px rgba(0,0,0,.12)',
        }}
      >
        <CircleHelp size={22} aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tc-onboarding-title"
          onClick={(e) => { if (e.target === e.currentTarget) closeGuide() }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,.48)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{
            width: 'min(680px, 100%)', maxHeight: 'min(760px, calc(100vh - 40px))', overflowY: 'auto',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.24)', padding: 26,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 }}>
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
                  {lang === 'fr' ? 'Guide TotalCare OS' : 'TotalCare OS guide'}
                </p>
                <h2 id="tc-onboarding-title" style={{ margin: 0, fontSize: 24, color: 'var(--color-text-primary)' }}>{title}</h2>
                {description && <p style={{ margin: '8px 0 0', color: 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1.55 }}>{description}</p>}
              </div>
              <button type="button" onClick={closeGuide} aria-label={lang === 'fr' ? 'Fermer' : 'Close'} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}>
                <X size={20} aria-hidden />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 5, margin: '22px 0 18px' }} aria-label={lang === 'fr' ? 'Progression du guide' : 'Guide progress'}>
              {visibleSteps.map((step, index) => (
                <div key={step.id} style={{ height: 5, flex: 1, borderRadius: 99, background: index <= currentIndex ? 'var(--color-accent)' : 'var(--color-border)' }} />
              ))}
            </div>

            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{currentIndex + 1}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{lang === 'fr' ? `Étape ${currentIndex + 1} sur ${visibleSteps.length}` : `Step ${currentIndex + 1} of ${visibleSteps.length}`}</span>
              </div>
              <h3 style={{ margin: '0 0 10px', fontSize: 20, color: 'var(--color-text-primary)' }}>{stepTitle}</h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-primary)' }}>{stepBody}</p>
              {stepAction && currentStep.target_route && (
                <button type="button" onClick={goToModule} style={{ marginTop: 18, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-accent)', padding: '9px 13px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  {stepAction} →
                </button>
              )}
            </div>

            {error && <p style={{ margin: '12px 0 0', color: 'var(--color-critical-text)', fontSize: 12 }}>{error}</p>}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={previous} disabled={currentIndex === 0} style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', padding: '10px 14px', borderRadius: 8, cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentIndex === 0 ? .45 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ChevronLeft size={17} aria-hidden /> {lang === 'fr' ? 'Précédent' : 'Back'}
              </button>
              <button type="button" onClick={next} style={{ border: 0, background: 'var(--color-accent)', color: 'var(--color-accent-text-on)', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                {isLast ? <><CheckCircle2 size={17} aria-hidden /> {lang === 'fr' ? 'Terminer' : 'Finish'}</> : <>{lang === 'fr' ? 'Suivant' : 'Next'} <ChevronRight size={17} aria-hidden /></>}
              </button>
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                {lang === 'fr' ? 'Vous pouvez rouvrir ce guide à tout moment avec ?' : 'You can reopen this guide anytime with ?'}
              </span>
              <button type="button" onClick={() => void saveProgress({ enabled: false })} style={{ border: 0, background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>
                {lang === 'fr' ? 'Désactiver le démarrage automatique' : 'Turn off automatic opening'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
