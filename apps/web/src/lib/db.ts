import Dexie, { type Table } from 'dexie'
import type { WatchlistItem, MediaCache, MediaType } from '@mywatch/core'

export interface PendingPush {
  id?: number
  itemId: string
  queuedAt: string
}

class WatchDB extends Dexie {
  watchlistItems!: Table<WatchlistItem, string>
  pendingPushes!: Table<PendingPush, number>
  mediaCache!: Table<MediaCache, [number, string]>

  constructor() {
    super('mywatch')
    this.version(1).stores({
      watchlistItems: 'id, userId, status, mediaType, updatedAt',
      pendingPushes: '++id, itemId, queuedAt',
      mediaCache: '[tmdbId+mediaType], cachedAt',
    })
  }
}

export const db = new WatchDB()
