'use client'

import { deleteRecord, getAllRecords, getRecord, putRecord, type CacheEntry } from '@/lib/offline/db'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function setOfflineCache<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): Promise<void> {
  const now = Date.now()
  const entry: CacheEntry<T> = {
    key,
    data,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  }
  await putRecord('cache', entry)
}

export async function getOfflineCache<T>(key: string): Promise<T | null> {
  const entry = await getRecord<CacheEntry<T>>('cache', key)
  if (!entry) return null
  if (Date.parse(entry.expiresAt) <= Date.now()) {
    await deleteRecord('cache', key)
    return null
  }
  return entry.data
}

export async function removeOfflineCache(key: string): Promise<void> {
  await deleteRecord('cache', key)
}

export async function clearOfflineCache(): Promise<void> {
  const entries = await getAllRecords<CacheEntry>('cache')
  await Promise.all(entries.map((entry) => deleteRecord('cache', entry.key)))
}
