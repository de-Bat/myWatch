'use client'
import { useLiveQuery } from 'dexie-react-hooks'
import type { PluginItem } from '@mywatch/core'
import { db } from '@/lib/db'

export function usePluginItems(playlistId: string | undefined): PluginItem[] | undefined {
  return useLiveQuery(async () => {
    if (!playlistId) return []
    return db.pluginItems
      .where('playlistId').equals(playlistId)
      .filter((i) => i.deletedAt === null)
      .toArray()
  }, [playlistId])
}

export function useUpsertPluginItem() {
  return async (item: Omit<PluginItem, 'id'> & { id?: string }): Promise<PluginItem> => {
    const full: PluginItem = {
      ...item,
      id: item.id ?? crypto.randomUUID(),
    }
    await db.pluginItems.put(full)
    return full
  }
}
