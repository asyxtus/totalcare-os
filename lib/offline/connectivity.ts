'use client'

let lastSuccessfulRequestAt: number | null = null
let lastFailedRequestAt: number | null = null

export function recordOfflineRequestSuccess(): void {
  lastSuccessfulRequestAt = Date.now()
}

export function recordOfflineRequestFailure(): void {
  lastFailedRequestAt = Date.now()
}

export function getConnectivitySnapshot() {
  return {
    browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    lastSuccessfulRequestAt,
    lastFailedRequestAt,
  }
}

export async function hasWorkingConnection(timeoutMs = 5000): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false

  try {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
    window.clearTimeout(timer)
    if (!response.ok) throw new Error(`Health check failed: ${response.status}`)
    recordOfflineRequestSuccess()
    return true
  } catch {
    recordOfflineRequestFailure()
    return false
  }
}
