'use client'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Playlist, PlaylistItem, SmartRules, WatchlistItem, MediaCache } from '@mywatch/core'
import { db } from '@/lib/db'
import { getLocalDeviceId } from './useWatchlist'

export function usePlaylists() {
  return useLiveQuery(
    () => db.playlists.filter((p) => p.deletedAt === null).toArray().then((ps) =>
      ps.sort((a, b) => a.sortOrder - b.sortOrder)
    ),
    [],
  )
}

export function usePlaylist(id: string) {
  return useLiveQuery(
    () => db.playlists.get(id),
    [id],
  )
}

export function usePlaylistItems(playlistId: string) {
  return useLiveQuery(
    async () => {
      const items = await db.playlistItems
        .where('playlistId')
        .equals(playlistId)
        .toArray()
      items.sort((a, b) => a.position - b.position)
      // Resolve to watchlist items
      const results: Array<{ playlistItem: PlaylistItem; watchlistItem: WatchlistItem | undefined }> = []
      for (const pi of items) {
        const wi = await db.watchlistItems
          .filter((w) => w.tmdbId === pi.tmdbId && w.mediaType === pi.mediaType && w.deletedAt === null)
          .first()
        results.push({ playlistItem: pi, watchlistItem: wi })
      }
      return results
    },
    [playlistId],
  )
}

export function useSmartPlaylistItems(rules: SmartRules | null) {
  return useLiveQuery(
    async () => {
      if (!rules) return []
      let items = await db.watchlistItems.filter((i) => i.deletedAt === null).toArray()

      if (rules.statuses?.length) {
        items = items.filter((i) => rules.statuses!.includes(i.status))
      }
      if (rules.mediaTypes?.length) {
        items = items.filter((i) => rules.mediaTypes!.includes(i.mediaType))
      }
      if (rules.minRating != null) {
        items = items.filter((i) => i.rating != null && i.rating >= rules.minRating!)
      }
      if (rules.maxRating != null) {
        items = items.filter((i) => i.rating != null && i.rating <= rules.maxRating!)
      }

      // Genre filter requires media cache lookup
      if (rules.genres?.length) {
        const filtered: WatchlistItem[] = []
        for (const item of items) {
          const cached: MediaCache | undefined = await db.mediaCache.get([item.tmdbId, item.mediaType])
          const itemGenres = cached?.genres?.map((g) => g.name) ?? []
          if (rules.genres!.some((g) => itemGenres.includes(g))) {
            filtered.push(item)
          }
        }
        return filtered
      }

      return items
    },
    [JSON.stringify(rules)],
  )
}

export function useUpsertPlaylist() {
  return useCallback(async (playlist: Omit<Playlist, 'id' | 'createdAt' | 'updatedAt' | 'deviceId' | 'deletedAt'> & { id?: string }) => {
    const now = new Date().toISOString()
    const full: Playlist = {
      id: playlist.id ?? uuidv4(),
      ...playlist,
      createdAt: now,
      updatedAt: now,
      deviceId: getLocalDeviceId(),
      deletedAt: null,
    }
    await db.playlists.put(full)
    return full
  }, [])
}

export function useDeletePlaylist() {
  return useCallback(async (id: string) => {
    await db.playlists.where('id').equals(id).modify({ deletedAt: new Date().toISOString() })
  }, [])
}

export function useAddToPlaylist() {
  return useCallback(async (playlistId: string, tmdbId: number, mediaType: 'movie' | 'tv') => {
    const existing = await db.playlistItems
      .filter((i) => i.playlistId === playlistId && i.tmdbId === tmdbId && i.mediaType === mediaType)
      .first()
    if (existing) return
    const count = await db.playlistItems.where('playlistId').equals(playlistId).count()
    await db.playlistItems.add({
      id: uuidv4(),
      playlistId,
      tmdbId,
      mediaType,
      position: count,
      addedAt: new Date().toISOString(),
    })
  }, [])
}

export function useRemoveFromPlaylist() {
  return useCallback(async (playlistId: string, tmdbId: number, mediaType: 'movie' | 'tv') => {
    await db.playlistItems
      .filter((i) => i.playlistId === playlistId && i.tmdbId === tmdbId && i.mediaType === mediaType)
      .delete()
  }, [])
}

export function useReorderPlaylistItem() {
  return useCallback(async (playlistId: string, itemId: string, newPosition: number) => {
    const items = await db.playlistItems.where('playlistId').equals(playlistId).toArray()
    items.sort((a, b) => a.position - b.position)
    const idx = items.findIndex((i) => i.id === itemId)
    if (idx === -1) return
    const [moved] = items.splice(idx, 1)
    items.splice(newPosition, 0, moved)
    await Promise.all(items.map((item, pos) =>
      db.playlistItems.where('id').equals(item.id).modify({ position: pos })
    ))
  }, [])
}
