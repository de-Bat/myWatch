import Fuse from 'fuse.js'
import type { WatchlistItem } from '@mywatch/core'

export function fuzzyFilterItems(
  items: WatchlistItem[],
  titleMap: Map<string, string>,
  query: string,
): WatchlistItem[] {
  if (!query.trim()) return items

  const indexed = items.map((item) => ({
    item,
    title: titleMap.get(`${item.tmdbId}-${item.mediaType}`) ?? '',
  }))

  const fuse = new Fuse(indexed, {
    keys: ['title'],
    threshold: 0.35,
    ignoreLocation: true,
  })

  return fuse.search(query).map((r) => r.item.item)
}
