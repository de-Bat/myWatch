import Dexie, { type Table } from 'dexie'
import type { WatchlistItem, MediaCache, Playlist, PlaylistItem } from '@mywatch/core'

export interface PendingPush {
  id?: number
  itemId: string
  queuedAt: string
}

class WatchDB extends Dexie {
  watchlistItems!: Table<WatchlistItem, string>
  pendingPushes!: Table<PendingPush, number>
  mediaCache!: Table<MediaCache, [number, string]>
  playlists!: Table<Playlist, string>
  playlistItems!: Table<PlaylistItem, string>

  constructor() {
    super('mywatch')
    this.version(1).stores({
      watchlistItems: 'id, userId, status, mediaType, updatedAt',
      pendingPushes: '++id, itemId, queuedAt',
      mediaCache: '[tmdbId+mediaType], cachedAt',
    })
    // v2: adds customPlatforms to watchlistItems + watch provider fields to mediaCache (schema-less columns, no index changes)
    this.version(2).stores({
      watchlistItems: 'id, userId, status, mediaType, updatedAt',
      pendingPushes: '++id, itemId, queuedAt',
      mediaCache: '[tmdbId+mediaType], cachedAt',
    })
    // v3: adds playlists and playlistItems tables
    this.version(3).stores({
      watchlistItems: 'id, userId, status, mediaType, updatedAt',
      pendingPushes: '++id, itemId, queuedAt',
      mediaCache: '[tmdbId+mediaType], cachedAt',
      playlists: 'id, userId, updatedAt',
      playlistItems: 'id, playlistId, [tmdbId+mediaType]',
    })
  }
}

export const db = new WatchDB()
