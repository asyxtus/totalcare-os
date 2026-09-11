'use client'

import { useCallback, useEffect, useRef } from 'react'
import { getAllRecords, putRecord, type OutboxEntry } from '@/lib/offline/db'
import {
  acknowledgeOfflineOperation,
  listPendingOfflineOperations,
  markOfflineOperationFailed,
  markOfflineOperationProcessing,
} from '@/lib/offline/outbox'
import { registerPatientIdempotent } from '@/lib/actions/patientRegistrationOffline'
import type { OfflinePatientRegistrationPayload } from '@/lib/actions/patientRegistrationOffline'
import { recordOfflineRequestFailure, recordOfflineRequestSuccess } from '@/lib/offline/connectivity'

const DUPLICATE_REVIEW = '[DUPLICATE_REVIEW]'

export default function OfflineSyncManager() {
  const running = useRef(false)

  const sync = useCallback(async () => {
    if (running.current || typeof navigator === 'undefined' || !navigator.onLine) return
    running.current = true

    try {
      // Failed operations are retried on a later reconnect, except duplicate
      // conflicts which require a human decision and must never auto-repeat.
      const all = await getAllRecords<OutboxEntry>('outbox')
      for (const entry of all) {
        if (entry.status !== 'failed' || entry.lastError?.startsWith(DUPLICATE_REVIEW)) continue
        await putRecord('outbox', { ...entry, status: 'pending', updatedAt: new Date().toISOString() })
      }

      const pending = await listPendingOfflineOperations()
      for (const entry of pending) {
        if (entry.operation !== 'patient-registration') continue

        await markOfflineOperationProcessing(entry.id)
        try {
          const result = await registerPatientIdempotent(
            entry.id,
            entry.payload as OfflinePatientRegistrationPayload,
          )

          if (result.duplicateWarning) {
            const patient = result.existingPatient
            await markOfflineOperationFailed(
              entry.id,
              `${DUPLICATE_REVIEW} ${patient?.fullName ?? 'Existing patient'} (${patient?.patientCode ?? 'unknown code'}). Review before retrying.`,
            )
            continue
          }

          if (result.error || !result.newPatientId) {
            await markOfflineOperationFailed(entry.id, result.error ?? 'Patient registration returned no patient ID')
            await recordOfflineRequestFailure()
            continue
          }

          await acknowledgeOfflineOperation(entry.id)
          await recordOfflineRequestSuccess()
        } catch (error) {
          await markOfflineOperationFailed(entry.id, error)
          await recordOfflineRequestFailure()
          // Stop this batch on the first transport failure; the next reconnect
          // will resume in creation order instead of hammering the server.
          break
        }
      }
    } finally {
      running.current = false
    }
  }, [])

  useEffect(() => {
    void sync()
    const handleOnline = () => { void sync() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [sync])

  return null
}
