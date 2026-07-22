// lib/utils/doualaTime.ts
// Douala is WAT, UTC+1, fixed year-round — no DST to account for. Used
// anywhere "today" or "this day's range" needs to mean the calendar
// date in Douala, not whatever timezone the server process runs in.
// Same fact already relied on by the nightly billing cron's schedule.

export function todayInDouala(): string {
  const now = new Date()
  const doualaMs = now.getTime() + 60 * 60 * 1000
  return new Date(doualaMs).toISOString().slice(0, 10)
}

export function dayRangeUtc(dateStr: string): { start: string; end: string } {
  const start = new Date(`${dateStr}T00:00:00+01:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}
