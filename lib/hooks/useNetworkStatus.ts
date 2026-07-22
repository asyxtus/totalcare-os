// lib/hooks/useNetworkStatus.ts
// Tracks browser connectivity. This is deliberately simple for now — real
// offline resilience (queuing writes locally and syncing on reconnect,
// per the backlog) is a bigger feature not yet built. This hook is the
// foundation it will plug into: the UI already knows how to show online/
// offline state, so wiring in a real pending-sync count later doesn't
// require touching the app shell again.

import { useEffect, useState } from 'react'

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

// STUB: pending sync count. Real implementation belongs to the offline
// outbox feature (backlog item) — this returns 0 always until that's
// built, so the badge component works today and just needs this function
// swapped out later, not rebuilt.
export function usePendingSyncCount(): number {
  return 0
}
