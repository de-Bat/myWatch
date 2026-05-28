import type { MediaCache } from '@mywatch/core'

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export function isStale(cache: MediaCache, now = new Date()): boolean {
  const cachedAt = new Date(cache.cachedAt)
  return now.getTime() - cachedAt.getTime() > STALE_AFTER_MS
}
