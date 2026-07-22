// lib/utils/age.ts
// One calculation, used everywhere age needs to be shown. An estimated
// age now ages forward correctly: it's converted into a "virtual date of
// birth" using estimated_age_recorded_at, then calculated the exact same
// way a real date_of_birth would be. A patient estimated at 45 two years
// ago correctly shows 47 today, not a frozen 45.

export function calculateAge(
  dateOfBirth: string | null,
  estimatedAge: number | null,
  estimatedAgeRecordedAt: string | null
): number | null {
  let referenceDate: Date | null = null

  if (dateOfBirth) {
    referenceDate = new Date(dateOfBirth)
  } else if (estimatedAge !== null && estimatedAge !== undefined && estimatedAgeRecordedAt) {
    // Build a virtual date of birth: the date the estimate was recorded,
    // shifted back by the estimated age at that time. From here on, aging
    // forward works identically to a real date of birth.
    const recorded = new Date(estimatedAgeRecordedAt)
    referenceDate = new Date(recorded)
    referenceDate.setFullYear(recorded.getFullYear() - estimatedAge)
  } else if (estimatedAge !== null && estimatedAge !== undefined) {
    // Fallback for any record missing the recorded-at date (shouldn't
    // happen after the schema patch, but don't crash if it does).
    return estimatedAge
  }

  if (!referenceDate) return null

  const today = new Date()
  let age = today.getFullYear() - referenceDate.getFullYear()
  const monthDiff = today.getMonth() - referenceDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < referenceDate.getDate())) {
    age--
  }
  return age
}

export function formatAgeDisplay(
  dateOfBirth: string | null,
  estimatedAge: number | null,
  estimatedAgeRecordedAt: string | null,
  lang: 'fr' | 'en' = 'fr'
): string {
  const age = calculateAge(dateOfBirth, estimatedAge, estimatedAgeRecordedAt)
  if (age === null) return '—'

  const isEstimate = !dateOfBirth && estimatedAge !== null
  const suffix = isEstimate ? (lang === 'fr' ? ' (estimé)' : ' (estimated)') : ''
  const unit = lang === 'fr' ? 'ans' : 'yo'

  return `${age} ${unit}${suffix}`
}
