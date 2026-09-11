// lib/offline/db.ts
// Minimal IndexedDB persistence for the offline-first foundation.
// This layer stores only client-side working data/outbox entries that
// callers explicitly put here. It never caches Supabase responses implicitly.

export const OFFLINE_DB_NAME = 'totalcare-offline'
export const OFFLINE_DB_VERSION = 1

export type OutboxStatus = 'pending' | 'processing' | 'failed'

export interface OutboxEntry<T = unknown> {
  id: string
  operation: string
  clinicId: string
  staffId: string
  payload: T
  createdAt: string
  updatedAt: string
  attempts: number
  status: OutboxStatus
  lastError?: string
}

export interface CachedRecord<T = unknown> {
  key: string
  clinicId: string
  entity: string
  data: T
  updatedAt: string
  expiresAt?: string
}

type StoreName = 'outbox' | 'cache'

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB is not available in this browser'))
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)

    request.onerror = () => reject(request.error ?? new Error('Unable to open offline database'))
    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains('outbox')) {
        const outbox = db.createObjectStore('outbox', { keyPath: 'id' })
        outbox.createIndex('status', 'status', { unique: false })
        outbox.createIndex('clinicId', 'clinicId', { unique: false })
        outbox.createIndex('createdAt', 'createdAt', { unique: false })
      }

      if (!db.objectStoreNames.contains('cache')) {
        const cache = db.createObjectStore('cache', { keyPath: 'key' })
        cache.createIndex('clinicId', 'clinicId', { unique: false })
        cache.createIndex('entity', 'entity', { unique: false })
        cache.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
  })
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export async function putRecord<T>(storeName: StoreName, value: T): Promise<void> {
  const db = await openDatabase()
  try {
    const transaction = db.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(value)
    await waitForTransaction(transaction)
  } finally {
    db.close()
  }
}

export async function getRecord<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDatabase()
  try {
    return await requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(key)) as T | undefined
  } finally {
    db.close()
  }
}

export async function deleteRecord(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDatabase()
  try {
    const transaction = db.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).delete(key)
    await waitForTransaction(transaction)
  } finally {
    db.close()
  }
}

export async function getAllRecords<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase()
  try {
    return await requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll()) as T[]
  } finally {
    db.close()
  }
}

export async function countByIndex(storeName: StoreName, indexName: string, value: IDBValidKey): Promise<number> {
  const db = await openDatabase()
  try {
    return await requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).index(indexName).count(value))
  } finally {
    db.close()
  }
}

export function isOfflineStorageAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window
}
