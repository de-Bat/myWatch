'use client'
import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { pushPendingItems, pullItems } from '@/lib/sync'

export interface SyncState {
  syncing: boolean
  lastSyncedAt: string | null
  error: string | null
}

export function useSync() {
  const { data: session } = useSession()
  const [state, setState] = useState<SyncState>({
    syncing: false,
    lastSyncedAt: null,
    error: null,
  })

  const sync = useCallback(
    async (since?: string) => {
      if (!session?.apiToken) return
      setState((s) => ({ ...s, syncing: true, error: null }))
      try {
        await pushPendingItems(session.apiToken, session.user?.id ?? '')
        const pulledAt = await pullItems(
          since ?? new Date(0).toISOString(),
          session.apiToken,
        )
        setState({ syncing: false, lastSyncedAt: pulledAt, error: null })
      } catch (err) {
        setState((s) => ({
          ...s,
          syncing: false,
          error: err instanceof Error ? err.message : 'Sync failed',
        }))
      }
    },
    [session?.apiToken],
  )

  return { ...state, sync }
}
