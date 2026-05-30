'use client'
import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useSync } from '@/hooks/useSync'

const INTERVAL_MS = 5 * 60 * 1000   // poll every 5 min while visible
const MIN_GAP_MS  = 30 * 1000       // ignore if synced < 30s ago

export function AutoSync() {
  const { data: session } = useSession()
  const { sync, lastSyncedAt, syncing } = useSync()
  const lastSyncedAtRef = useRef<string | null>(lastSyncedAt)

  useEffect(() => {
    lastSyncedAtRef.current = lastSyncedAt
  }, [lastSyncedAt])

  useEffect(() => {
    if (!session?.apiToken) return

    function trySync() {
      if (syncing) return
      const last = lastSyncedAtRef.current
        ? new Date(lastSyncedAtRef.current).getTime()
        : 0
      if (Date.now() - last < MIN_GAP_MS) return
      sync({ silent: true })
    }

    function onVisible() {
      if (document.visibilityState === 'visible') trySync()
    }

    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') trySync()
    }, INTERVAL_MS)

    // Sync once on mount (initial load)
    trySync()

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [session?.apiToken]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
