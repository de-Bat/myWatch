'use client'
import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from './useSettings'
import { fetchJellyfinProgress, type JellyfinProgress } from '@/lib/jellyfin'

export function useJellyfinProgress(settings: AppSettings): {
  progressMap: Map<string, JellyfinProgress> | null
  refresh: () => void
  loading: boolean
} {
  const [progressMap, setProgressMap] = useState<Map<string, JellyfinProgress> | null>(null)
  const [loading, setLoading] = useState(false)
  const { jellyfinUrl, jellyfinApiKey, jellyfinUserId } = settings

  const run = useCallback(async () => {
    if (!jellyfinUrl || !jellyfinApiKey || !jellyfinUserId) return
    setLoading(true)
    try {
      const map = await fetchJellyfinProgress(jellyfinUrl, jellyfinApiKey, jellyfinUserId)
      setProgressMap(map)
    } catch (err) {
      console.error('Jellyfin fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [jellyfinUrl, jellyfinApiKey, jellyfinUserId])

  useEffect(() => {
    run()
  }, [run])

  return { progressMap, refresh: run, loading }
}
