'use client'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { JellyfinProgress } from '@mywatch/core'

export function useJellyfinProgress(): {
  progressMap: Map<string, JellyfinProgress> | null
  loading: boolean
} {
  const items = useLiveQuery(() => db.jellyfinProgress.toArray())

  if (items === undefined) {
    return { progressMap: null, loading: true }
  }

  const progressMap = new Map<string, JellyfinProgress>()
  for (const item of items) {
    progressMap.set(`${item.tmdbId}-${item.mediaType}`, item)
  }

  return { progressMap, loading: false }
}
