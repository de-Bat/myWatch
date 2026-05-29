'use client'
import { useLiveQuery } from 'dexie-react-hooks'
import type { WatchlistItem, WatchStatus, MediaType } from '@mywatch/core'
import { getOrCreateDeviceId } from '@mywatch/sync'
import { db } from '@/lib/db'

const deviceStorage = {
  get: () => (typeof window !== 'undefined' ? localStorage.getItem('mywatch-device-id') : null),
  set: (id: string) => localStorage.setItem('mywatch-device-id', id),
}

export function getLocalDeviceId(): string {
  return getOrCreateDeviceId(deviceStorage)
}

export interface WatchlistFilters {
  status?: WatchStatus | 'all'
  mediaType?: MediaType | 'all'
}

export function useWatchlistItems(filters?: WatchlistFilters) {
  return useLiveQuery(async () => {
    let items = await db.watchlistItems.filter((i) => i.deletedAt === null).toArray()
    if (filters?.status && filters.status !== 'all') {
      items = items.filter((i) => i.status === filters.status)
    }
    if (filters?.mediaType && filters.mediaType !== 'all') {
      items = items.filter((i) => i.mediaType === filters.mediaType)
    }
    return items
  }, [filters?.status, filters?.mediaType])
}

export function useWatchlistItem(tmdbId: number, mediaType: MediaType) {
  return useLiveQuery(
    () =>
      db.watchlistItems
        .filter((i) => i.tmdbId === tmdbId && i.mediaType === mediaType && i.deletedAt === null)
        .first(),
    [tmdbId, mediaType],
  )
}

export function useUpsertItem() {
  return async (item: Omit<WatchlistItem, 'updatedAt' | 'deviceId'>) => {
    const now = new Date().toISOString()
    const full: WatchlistItem = { ...item, updatedAt: now, deviceId: getLocalDeviceId() }
    await db.watchlistItems.put(full)
    await db.pendingPushes.add({ itemId: item.id, queuedAt: now })
  }
}

export function useSoftDeleteItem() {
  return async (id: string) => {
    const now = new Date().toISOString()
    await db.watchlistItems.where('id').equals(id).modify({
      deletedAt: now,
      updatedAt: now,
      deviceId: getLocalDeviceId(),
    })
    await db.pendingPushes.add({ itemId: id, queuedAt: now })
  }
}
