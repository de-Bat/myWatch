import type { WatchlistItem } from '@mywatch/core'

export function resolveConflict(local: WatchlistItem, remote: WatchlistItem): WatchlistItem {
  const localTime = new Date(local.updatedAt).getTime()
  const remoteTime = new Date(remote.updatedAt).getTime()
  return remoteTime > localTime ? remote : local
}

export function mergeItems(
  localItems: WatchlistItem[],
  remoteItems: WatchlistItem[],
): WatchlistItem[] {
  const map = new Map<string, WatchlistItem>()

  for (const item of localItems) {
    map.set(item.id, item)
  }

  for (const remote of remoteItems) {
    const local = map.get(remote.id)
    map.set(remote.id, local === undefined ? remote : resolveConflict(local, remote))
  }

  return Array.from(map.values()).filter((item) => item.deletedAt === null)
}
