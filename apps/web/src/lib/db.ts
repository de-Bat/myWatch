import Dexie, { type Table } from 'dexie'
import type { WatchlistItem, MediaCache, Playlist, PlaylistItem, JellyfinProgress, ProgressRecap, PluginItem } from '@mywatch/core'

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
  jellyfinProgress!: Table<JellyfinProgress, [number, string]>
  progressRecaps!: Table<ProgressRecap, [number, string]>
  pluginItems!: Table<PluginItem, string>

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
    // v4: adds jellyfinProgress table
    this.version(4).stores({
      watchlistItems: 'id, userId, status, mediaType, updatedAt',
      pendingPushes: '++id, itemId, queuedAt',
      mediaCache: '[tmdbId+mediaType], cachedAt',
      playlists: 'id, userId, updatedAt',
      playlistItems: 'id, playlistId, [tmdbId+mediaType]',
      jellyfinProgress: '[tmdbId+mediaType], updatedAt',
    })
    // v5: adds progressRecaps table
    this.version(5).stores({
      watchlistItems: 'id, userId, status, mediaType, updatedAt',
      pendingPushes: '++id, itemId, queuedAt',
      mediaCache: '[tmdbId+mediaType], cachedAt',
      playlists: 'id, userId, updatedAt',
      playlistItems: 'id, playlistId, [tmdbId+mediaType]',
      jellyfinProgress: '[tmdbId+mediaType], updatedAt',
      progressRecaps: '[tmdbId+mediaType], updatedAt',
    })
    // v6: adds pluginItems table for plugin-managed content
    this.version(6).stores({
      watchlistItems: 'id, userId, status, mediaType, updatedAt',
      pendingPushes: '++id, itemId, queuedAt',
      mediaCache: '[tmdbId+mediaType], cachedAt',
      playlists: 'id, userId, updatedAt',
      playlistItems: 'id, playlistId, [tmdbId+mediaType]',
      jellyfinProgress: '[tmdbId+mediaType], updatedAt',
      progressRecaps: '[tmdbId+mediaType], updatedAt',
      pluginItems: 'id, pluginId, playlistId, updatedAt',
    })
  }
}

export const db = new WatchDB()
