import { resolveConflict } from '@mywatch/sync'
import { db } from './db'
import { apiClient } from './api-client'

export async function pushPendingItems(token: string, userId: string, connId?: string): Promise<void> {
  const pending = await db.pendingPushes.toArray()

  const itemIds = [...new Set(pending.map((p) => p.itemId))]
  const items = await db.watchlistItems.where('id').anyOf(itemIds).toArray()

  // Claim items for the authenticated user (handles guest → auth migration)
  const claimed = items.map((item) => ({ ...item, userId }))
  if (claimed.length > 0) await db.watchlistItems.bulkPut(claimed)

  // Gather public playlists + their items for sync
  const allPlaylists = await db.playlists.toArray()
  const publicPlaylists = allPlaylists
    .filter((p) => p.deletedAt === null && (p.visibility ?? 'public') === 'public')
    .map((p) => ({ ...p, userId }))
  const publicPlaylistIds = new Set(publicPlaylists.map((p) => p.id))
  const allPlaylistItems = await db.playlistItems.toArray()
  const publicPlaylistItems = allPlaylistItems.filter((i) => publicPlaylistIds.has(i.playlistId))

  if (pending.length === 0 && publicPlaylists.length === 0) return

  await apiClient.sync.push(claimed, publicPlaylists, publicPlaylistItems, token, connId)
  if (itemIds.length > 0) {
    await db.pendingPushes.where('itemId').anyOf(itemIds).delete()
  }
}

export async function pullItems(since: string, token: string): Promise<{ pulledAt: string; count: number }> {
  const { items: remoteItems, playlists: remotePlaylists = [], playlistItems: remotePlaylistItems = [], jellyfinProgress = [], progressRecaps = [], pulledAt } = await apiClient.sync.pull(since, token)
  if (remoteItems.length === 0 && remotePlaylists.length === 0 && jellyfinProgress.length === 0 && progressRecaps.length === 0) {
    return { pulledAt, count: 0 }
  }

  const ids = remoteItems.map((i) => i.id)
  const localItems = await db.watchlistItems.where('id').anyOf(ids).toArray()
  const localMap = new Map(localItems.map((i) => [i.id, i]))
  // Resolve LWW per item, preserving tombstones (deletedAt is not filtered out)
  const resolved = remoteItems.map((remote) => {
    const local = localMap.get(remote.id)
    return local === undefined ? remote : resolveConflict(local, remote)
  })
  const changed = resolved.filter((item) => {
    const local = localMap.get(item.id)
    return local === undefined || local.updatedAt !== item.updatedAt
  })

  // Merge remote playlists (LWW by updatedAt)
  const remotePlaylistIds = remotePlaylists.map((p) => p.id)
  const localPlaylists = remotePlaylistIds.length > 0
    ? await db.playlists.where('id').anyOf(remotePlaylistIds).toArray()
    : []
  const localPlaylistMap = new Map(localPlaylists.map((p) => [p.id, p]))
  const resolvedPlaylists = remotePlaylists.filter((remote) => {
    const local = localPlaylistMap.get(remote.id)
    return local === undefined || remote.updatedAt > local.updatedAt
  })

  await db.transaction('rw', db.watchlistItems, db.playlists, db.playlistItems, db.jellyfinProgress, db.progressRecaps, async () => {
    if (resolved.length > 0) {
      await db.watchlistItems.bulkPut(resolved)
    }
    if (resolvedPlaylists.length > 0) {
      await db.playlists.bulkPut(resolvedPlaylists)
    }
    if (remotePlaylistItems.length > 0) {
      await db.playlistItems.bulkPut(remotePlaylistItems)
    }
    if (jellyfinProgress.length > 0) {
      await db.jellyfinProgress.bulkPut(jellyfinProgress)
    }
    if (progressRecaps.length > 0) {
      await db.progressRecaps.bulkPut(progressRecaps)
    }
  })

  return { pulledAt, count: changed.length + resolvedPlaylists.length + jellyfinProgress.length + progressRecaps.length }
}
