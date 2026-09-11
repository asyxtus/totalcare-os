'use client'

import { deleteRecord, getAllRecords, getRecord, putRecord, type CachedRecord } from '@/lib/offline/db'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function setOfflineCache<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): Promise<void> {
  const now = Date.now()
  const entry: CachedRecord<T> = {
    key,
    // Generic cache entries are not tied to a clinic here. Sensitive,
    // clinic-scoped caches should include clinic identity in their key.
    clinicId: 'global',
    entity: 'generic',
    data,
    updatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  }
  await putRecord('cache', entry)
}

export async function getOfflineCache<T>(key: string): Promise<T | null> {
  const entry = await getRecord<CachedRecord<T>>('cache', key)
  if (!entry) return null
  if (entry.expiresAt && Date.parse(entry.expiresAt) <= Date.now()) {
    await deleteRecord('cache', key)
    return null
  }
  return entry.data
}

export async function removeOfflineCache(key: string): Promise<void> {
  await deleteRecord('cache', key)
}

export async function clearOfflineCache(): Promise<void> {
  const entries = await getAllRecords<CachedRecord>('cache')
  await Promise.all(entries.map((entry) => deleteRecord('cache', entry.key)))
}
