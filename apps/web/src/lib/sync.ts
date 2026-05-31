import { resolveConflict } from '@mywatch/sync'
import { db } from './db'
import { apiClient } from './api-client'

export async function pushPendingItems(token: string, userId: string, connId?: string): Promise<void> {
  const pending = await db.pendingPushes.toArray()
  if (pending.length === 0) return

  const itemIds = [...new Set(pending.map((p) => p.itemId))]
  const items = await db.watchlistItems.where('id').anyOf(itemIds).toArray()

  // Claim items for the authenticated user (handles guest → auth migration)
  const claimed = items.map((item) => ({ ...item, userId }))
  await db.watchlistItems.bulkPut(claimed)

  await apiClient.sync.push(claimed, token, connId)
  await db.pendingPushes.where('itemId').anyOf(itemIds).delete()
}

export async function pullItems(since: string, token: string): Promise<{ pulledAt: string; count: number }> {
  const { items: remoteItems, jellyfinProgress = [], pulledAt } = await apiClient.sync.pull(since, token)
  if (remoteItems.length === 0 && jellyfinProgress.length === 0) return { pulledAt, count: 0 }

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
  
  await db.transaction('rw', db.watchlistItems, db.jellyfinProgress, async () => {
    if (resolved.length > 0) {
      await db.watchlistItems.bulkPut(resolved)
    }
    if (jellyfinProgress.length > 0) {
      await db.jellyfinProgress.bulkPut(jellyfinProgress)
    }
  })
  
  return { pulledAt, count: changed.length + jellyfinProgress.length }
}
