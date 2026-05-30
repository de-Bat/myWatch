'use client'
import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useSync } from '@/hooks/useSync'
import { useSettings } from '@/hooks/useSettings'
import { useSyncEvents } from '@/hooks/useSyncEvents'

const MIN_GAP_MS = 30 * 1000

export function AutoSync() {
  const { data: session } = useSession()
  const { settings } = useSettings()
  const { sync, lastSyncedAt, syncing, setConnId } = useSync()
  const lastSyncedAtRef = useRef<string | null>(lastSyncedAt)
  const syncingRef = useRef(syncing)

  useEffect(() => { lastSyncedAtRef.current = lastSyncedAt }, [lastSyncedAt])
  useEffect(() => { syncingRef.current = syncing }, [syncing])

  const { connId } = useSyncEvents(session?.apiToken ?? undefined, lastSyncedAt, sync)

  useEffect(() => { setConnId(connId) }, [connId, setConnId])

  useEffect(() => {
    if (!session?.apiToken || settings.syncInterval === 0) return

    function trySync() {
      if (syncingRef.current) return
      const last = lastSyncedAtRef.current ? new Date(lastSyncedAtRef.current).getTime() : 0
      if (Date.now() - last < MIN_GAP_MS) return
      sync({ silent: true })
    }

    function onVisible() {
      if (document.visibilityState === 'visible') trySync()
    }

    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') trySync()
    }, settings.syncInterval * 60 * 1000)

    trySync()

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [session?.apiToken, settings.syncInterval]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
