import { resolveConflict } from '@mywatch/sync'
import { db } from './db'
import { apiClient } from './api-client'

export async function pushPendingItems(token: string, userId: string): Promise<void> {
  const pending = await db.pendingPushes.toArray()
  if (pending.length === 0) return

  const itemIds = [...new Set(pending.map((p) => p.itemId))]
  const items = await db.watchlistItems.where('id').anyOf(itemIds).toArray()

  // Claim items for the authenticated user (handles guest → auth migration)
  const claimed = items.map((item) => ({ ...item, userId }))
  await db.watchlistItems.bulkPut(claimed)

  await apiClient.sync.push(claimed, token)
  await db.pendingPushes.where('itemId').anyOf(itemIds).delete()
}

export async function pullItems(since: string, token: string): Promise<string> {
  const { items: remoteItems, pulledAt } = await apiClient.sync.pull(since, token)
  if (remoteItems.length > 0) {
    const ids = remoteItems.map((i) => i.id)
    const localItems = await db.watchlistItems.where('id').anyOf(ids).toArray()
    const localMap = new Map(localItems.map((i) => [i.id, i]))
    // Resolve LWW per item, preserving tombstones (deletedAt is not filtered out)
    const resolved = remoteItems.map((remote) => {
      const local = localMap.get(remote.id)
      return local === undefined ? remote : resolveConflict(local, remote)
    })
    await db.watchlistItems.bulkPut(resolved)
  }
  return pulledAt
}
