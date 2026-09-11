'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { setOfflineCache } from '@/lib/offline/cache'
import { getOfflineConsultationContext } from '@/lib/actions/consultationOfflineContext'

export default function OfflineConsultationContextSync() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    const match = pathname.match(/^\/visits\/([^/]+)\/consultation$/)
    if (!match || typeof navigator === 'undefined' || !navigator.onLine) return

    const visitId = match[1]
    void getOfflineConsultationContext(visitId).then(async (context) => {
      if (!context) return
      await setOfflineCache(`consultation:${context.clinicId}:${context.visitId}`, context, 12 * 60 * 60 * 1000)
    }).catch(() => {})
  }, [pathname])

  return null
}
