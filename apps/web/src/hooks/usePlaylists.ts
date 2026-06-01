'use client'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Playlist, PlaylistItem, SmartRules, WatchlistItem, MediaCache } from '@mywatch/core'
import { db } from '@/lib/db'
import { getLocalDeviceId } from './useWatchlist'

export const ALL_LIST_UUID = '00000000-0000-0000-0000-000000000001'
export const MAIN_LIST_UUID = '00000000-0000-0000-0000-000000000002'

export async function seedDefaultPlaylists() {
  const now = new Date().toISOString()
  const deviceId = getLocalDeviceId()
  
  const allList: Playlist = {
    id: ALL_LIST_UUID,
    userId: '',
    name: 'All',
    description: 'All watchlist items',
    type: 'smart',
    smartRules: {},
    sortOrder: 0,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
    deviceId,
    deletedAt: null,
  }
  
  const mainList: Playlist = {
    id: MAIN_LIST_UUID,
    userId: '',
    name: 'Main',
    description: 'Primary manual watchlist',
    type: 'manual',
    smartRules: null,
    sortOrder: 1,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    deviceId,
    deletedAt: null,
  }
  
  await db.playlists.bulkPut([allList, mainList])
}

export function usePlaylists() {
  useEffect(() => {
    async function checkAndSeed() {
      const count = await db.playlists.filter((p) => p.deletedAt === null).count()
      if (count === 0) {
        await seedDefaultPlaylists()
      }
    }
    checkAndSeed().catch((err) => console.error('Failed to seed default lists', err))
  }, [])

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

export function useSetDefaultPlaylist() {
  return useCallback(async (id: string) => {
    await db.transaction('rw', db.playlists, async () => {
      const playlists = await db.playlists.toArray()
      for (const p of playlists) {
        const isTarget = p.id === id
        if (p.isDefault !== isTarget) {
          await db.playlists.update(p.id, {
            isDefault: isTarget,
            updatedAt: new Date().toISOString(),
            deviceId: getLocalDeviceId()
          })
        }
      }
    })
  }, [])
}

export function useUpdatePlaylist() {
  const setDefault = useSetDefaultPlaylist()
  return useCallback(async (id: string, updates: Partial<Omit<Playlist, 'id' | 'createdAt' | 'updatedAt' | 'deviceId' | 'deletedAt'>>) => {
    const now = new Date().toISOString()
    const deviceId = getLocalDeviceId()
    
    await db.playlists.update(id, {
      ...updates,
      updatedAt: now,
      deviceId,
    })
    
    if (updates.isDefault) {
      await setDefault(id)
    }
  }, [setDefault])
}

export function usePlaylistContentsEditor(playlistId: string) {
  return useCallback(async (selectedTmdbIds: Set<string>) => {
    await db.transaction('rw', db.playlistItems, async () => {
      const existingItems = await db.playlistItems.where('playlistId').equals(playlistId).toArray()
      const existingKeys = new Set(existingItems.map(i => `${i.tmdbId}-${i.mediaType}`))
      
      const toAdd: PlaylistItem[] = []
      let position = existingItems.length
      
      for (const itemKey of selectedTmdbIds) {
        if (!existingKeys.has(itemKey)) {
          const [tmdbIdStr, mediaType] = itemKey.split('-')
          toAdd.push({
            id: uuidv4(),
            playlistId,
            tmdbId: parseInt(tmdbIdStr),
            mediaType: mediaType as 'movie' | 'tv',
            position: position++,
            addedAt: new Date().toISOString()
          })
        }
      }
      
      const toDeleteIds: string[] = []
      for (const item of existingItems) {
        const itemKey = `${item.tmdbId}-${item.mediaType}`
        if (!selectedTmdbIds.has(itemKey)) {
          toDeleteIds.push(item.id)
        }
      }
      
      if (toAdd.length > 0) {
        await db.playlistItems.bulkAdd(toAdd)
      }
      if (toDeleteIds.length > 0) {
        await db.playlistItems.bulkDelete(toDeleteIds)
      }
    })
  }, [playlistId])
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
