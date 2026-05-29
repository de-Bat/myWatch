import { mergeItems } from '@mywatch/sync'
import { db } from './db'
import { apiClient } from './api-client'

export async function pushPendingItems(token: string): Promise<void> {
  const pending = await db.pendingPushes.toArray()
  if (pending.length === 0) return

  const itemIds = [...new Set(pending.map((p) => p.itemId))]
  const items = await db.watchlistItems.where('id').anyOf(itemIds).toArray()

  await apiClient.sync.push(items, token)
  await db.pendingPushes.where('itemId').anyOf(itemIds).delete()
}

export async function pullItems(since: string, token: string): Promise<string> {
  const { items: remoteItems, pulledAt } = await apiClient.sync.pull(since, token)
  if (remoteItems.length > 0) {
    const ids = remoteItems.map((i) => i.id)
    const localItems = await db.watchlistItems.where('id').anyOf(ids).toArray()
    const merged = mergeItems(localItems, remoteItems)
    await db.watchlistItems.bulkPut(merged)
  }
  return pulledAt
}
