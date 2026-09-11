'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getAllRecords, putRecord, type OutboxEntry } from '@/lib/offline/db'
import {
  acknowledgeOfflineOperation,
  listPendingOfflineOperations,
  markOfflineOperationFailed,
  markOfflineOperationProcessing,
} from '@/lib/offline/outbox'
import { registerPatientIdempotent } from '@/lib/actions/patientRegistrationOffline'
import type { OfflinePatientRegistrationPayload } from '@/lib/actions/patientRegistrationOffline'
import { bookAppointmentIdempotent } from '@/lib/actions/appointmentOffline'
import type { OfflineAppointmentPayload } from '@/lib/actions/appointmentOffline'
import { hasWorkingConnection, recordOfflineRequestFailure, recordOfflineRequestSuccess } from '@/lib/offline/connectivity'

const DUPLICATE_REVIEW = '[DUPLICATE_REVIEW]'
const SYNC_LOCK = 'totalcare:offline-sync'

export default function OfflineSyncManager() {
  const running = useRef(false)
  const router = useRouter()

  const sync = useCallback(async () => {
    if (running.current || typeof navigator === 'undefined' || !navigator.onLine) return

    const run = async () => {
      if (running.current) return
      running.current = true
      let changed = false

      try {
        if (!(await hasWorkingConnection(4000))) return

        // Failed operations are retried on a later reconnect, except duplicate
        // conflicts which require a human decision and must never auto-repeat.
        const all = await getAllRecords<OutboxEntry>('outbox')
        for (const entry of all) {
          if (entry.status !== 'failed' || entry.lastError?.startsWith(DUPLICATE_REVIEW)) continue
          await putRecord('outbox', { ...entry, status: 'pending', updatedAt: new Date().toISOString() })
        }

        const pending = await listPendingOfflineOperations()
        for (const entry of pending) {
          if (entry.operation !== 'patient-registration' && entry.operation !== 'appointment-booking') continue

          await markOfflineOperationProcessing(entry.id)
          try {
            if (entry.operation === 'patient-registration') {
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
            } else {
              const result = await bookAppointmentIdempotent(
                entry.id,
                entry.payload as OfflineAppointmentPayload,
              )

              if (result.error || !result.appointmentId) {
                await markOfflineOperationFailed(entry.id, result.error ?? 'Appointment booking returned no appointment ID')
                await recordOfflineRequestFailure()
                continue
              }
            }

            await acknowledgeOfflineOperation(entry.id)
            await recordOfflineRequestSuccess()
            changed = true
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
        if (changed) router.refresh()
      }
    }

    // Multiple browser tabs can mount AppShell. Web Locks prevents two tabs
    // from sending the same outbox operation concurrently when supported.
    if ('locks' in navigator && navigator.locks) {
      await navigator.locks.request(SYNC_LOCK, { ifAvailable: true }, async (lock) => {
        if (lock) await run()
      })
    } else {
      await run()
    }
  }, [router])

  useEffect(() => {
    void sync()
    const handleOnline = () => { void sync() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [sync])

  return null
}
