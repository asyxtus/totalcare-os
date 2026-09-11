'use client'

// lib/hooks/useNetworkStatus.ts
// Browser connectivity plus the durable offline outbox count.
// navigator.onLine is a useful signal, but it is not treated as proof that
// Supabase is reachable. Actual sync success/failure will be recorded by the
// sync engine when critical workflows are wired into it.

import { useEffect, useState } from 'react'
import { countPendingOfflineOperations, subscribeToOutboxChanges } from '@/lib/offline/outbox'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

export function usePendingSyncCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const next = await countPendingOfflineOperations()
        if (!cancelled) setCount(next)
      } catch {
        // IndexedDB can be unavailable (private browsing, old browsers, etc.).
        // The application remains usable; it simply has no local outbox count.
      }
    }

    refresh()
    const unsubscribe = subscribeToOutboxChanges(refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return count
}
