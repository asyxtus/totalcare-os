// lib/offline/outbox.ts
// Durable client-side write queue. Operations remain generic so clinical/business
// modules can register idempotent server actions without duplicating writes.

import {
  deleteRecord,
  getAllRecords,
  putRecord,
  type OutboxEntry,
} from '@/lib/offline/db'

const OUTBOX_EVENT = 'totalcare:outbox-changed'
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000

function notifyOutboxChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OUTBOX_EVENT))
}

function createOperationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function retryDelayMs(attempts: number): number {
  // 2s, 4s, 8s ... capped at 5 minutes. Attempts are incremented when
  // processing starts, so a failed first attempt waits 2 seconds before retry.
  return Math.min(2000 * 2 ** Math.max(0, attempts - 1), MAX_RETRY_DELAY_MS)
}

export async function enqueueOfflineOperation<T>(params: {
  operation: string
  clinicId: string
  staffId: string
  payload: T
  id?: string
}): Promise<string> {
  const now = new Date().toISOString()
  const entry: OutboxEntry<T> = {
    id: params.id ?? createOperationId(),
    operation: params.operation,
    clinicId: params.clinicId,
    staffId: params.staffId,
    payload: params.payload,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    status: 'pending',
  }

  await putRecord('outbox', entry)
  notifyOutboxChanged()
  return entry.id
}

export async function listPendingOfflineOperations(): Promise<OutboxEntry[]> {
  const now = Date.now()
  const entries = await getAllRecords<OutboxEntry>('outbox')
  return entries
    .filter((entry) => {
      if (entry.status === 'pending') return true
      if (entry.status !== 'failed') return false
      if (!entry.nextAttemptAt) return true
      return Date.parse(entry.nextAttemptAt) <= now
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function countPendingOfflineOperations(): Promise<number> {
  const entries = await getAllRecords<OutboxEntry>('outbox')
  return entries.filter((entry) =>
    entry.status === 'pending' || entry.status === 'processing' || entry.status === 'failed'
  ).length
}

export async function countBlockedOfflineOperations(): Promise<number> {
  const entries = await getAllRecords<OutboxEntry>('outbox')
  return entries.filter((entry) => entry.status === 'blocked').length
}

export async function markOfflineOperationProcessing(id: string): Promise<void> {
  const entries = await getAllRecords<OutboxEntry>('outbox')
  const entry = entries.find((item) => item.id === id)
  if (!entry) return

  await putRecord('outbox', {
    ...entry,
    status: 'processing',
    attempts: entry.attempts + 1,
    nextAttemptAt: undefined,
    updatedAt: new Date().toISOString(),
  })
  notifyOutboxChanged()
}

export async function markOfflineOperationFailed(id: string, error: unknown): Promise<void> {
  const entries = await getAllRecords<OutboxEntry>('outbox')
  const entry = entries.find((item) => item.id === id)
  if (!entry) return

  const delay = retryDelayMs(entry.attempts)
  await putRecord('outbox', {
    ...entry,
    status: 'failed',
    lastError: error instanceof Error ? error.message : String(error),
    nextAttemptAt: new Date(Date.now() + delay).toISOString(),
    updatedAt: new Date().toISOString(),
  })
  notifyOutboxChanged()
}

export async function markOfflineOperationBlocked(id: string, error: unknown): Promise<void> {
  const entries = await getAllRecords<OutboxEntry>('outbox')
  const entry = entries.find((item) => item.id === id)
  if (!entry) return

  await putRecord('outbox', {
    ...entry,
    status: 'blocked',
    lastError: error instanceof Error ? error.message : String(error),
    nextAttemptAt: undefined,
    updatedAt: new Date().toISOString(),
  })
  notifyOutboxChanged()
}

export async function retryOfflineOperation(id: string): Promise<void> {
  const entries = await getAllRecords<OutboxEntry>('outbox')
  const entry = entries.find((item) => item.id === id)
  if (!entry) return

  await putRecord('outbox', {
    ...entry,
    status: 'pending',
    lastError: undefined,
    nextAttemptAt: undefined,
    updatedAt: new Date().toISOString(),
  })
  notifyOutboxChanged()
}

export async function acknowledgeOfflineOperation(id: string): Promise<void> {
  await deleteRecord('outbox', id)
  notifyOutboxChanged()
}

export function subscribeToOutboxChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(OUTBOX_EVENT, listener)
  return () => window.removeEventListener(OUTBOX_EVENT, listener)
}
