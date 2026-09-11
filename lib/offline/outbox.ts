// lib/offline/outbox.ts
// Durable client-side write queue. Operations are intentionally generic:
// clinical/business modules will register their own idempotent server actions
// in a later phase. Nothing is sent automatically by this file.

import {
  deleteRecord,
  getAllRecords,
  putRecord,
  type OutboxEntry,
} from '@/lib/offline/db'

const OUTBOX_EVENT = 'totalcare:outbox-changed'

function notifyOutboxChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OUTBOX_EVENT))
}

function createOperationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
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
  const entries = await getAllRecords<OutboxEntry>('outbox')
  return entries
    .filter((entry) => entry.status === 'pending' || entry.status === 'failed')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function countPendingOfflineOperations(): Promise<number> {
  return (await listPendingOfflineOperations()).length
}

export async function markOfflineOperationProcessing(id: string): Promise<void> {
  const entries = await getAllRecords<OutboxEntry>('outbox')
  const entry = entries.find((item) => item.id === id)
  if (!entry) return

  await putRecord('outbox', {
    ...entry,
    status: 'processing',
    attempts: entry.attempts + 1,
    updatedAt: new Date().toISOString(),
  })
  notifyOutboxChanged()
}

export async function markOfflineOperationFailed(id: string, error: unknown): Promise<void> {
  const entries = await getAllRecords<OutboxEntry>('outbox')
  const entry = entries.find((item) => item.id === id)
  if (!entry) return

  await putRecord('outbox', {
    ...entry,
    status: 'failed',
    lastError: error instanceof Error ? error.message : String(error),
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
