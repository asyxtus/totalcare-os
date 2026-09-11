'use client'

// lib/hooks/useNetworkStatus.ts
// Browser connectivity plus durable offline outbox counters.

import { useEffect, useState } from 'react'
import { countBlockedOfflineOperations, countPendingOfflineOperations, subscribeToOutboxChanges } from '@/lib/offline/outbox'

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
      }
    }

    void refresh()
    const unsubscribe = subscribeToOutboxChanges(() => { void refresh() })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return count
}

export function useBlockedSyncCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const next = await countBlockedOfflineOperations()
        if (!cancelled) setCount(next)
      } catch {
        // IndexedDB can be unavailable; there is simply no local count to show.
      }
    }

    void refresh()
    const unsubscribe = subscribeToOutboxChanges(() => { void refresh() })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return count
}
