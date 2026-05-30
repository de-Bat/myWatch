'use client'
import { useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { pushPendingItems, pullItems } from '@/lib/sync'
import { useToast } from '@/components/Toast'

export interface SyncState {
  syncing: boolean
  lastSyncedAt: string | null
  error: string | null
}

export function useSync() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const syncingRef = useRef(false)
  const [state, setState] = useState<SyncState>({
    syncing: false,
    lastSyncedAt: null,
    error: null,
  })

  const sync = useCallback(
    async (options?: { silent?: boolean; since?: string }) => {
      if (!session?.apiToken) return
      if (syncingRef.current) return
      syncingRef.current = true
      setState((s) => ({ ...s, syncing: true, error: null }))
      try {
        await pushPendingItems(session.apiToken, session.user?.id ?? '')
        const { pulledAt } = await pullItems(
          options?.since ?? new Date(0).toISOString(),
          session.apiToken,
        )
        setState({ syncing: false, lastSyncedAt: pulledAt, error: null })
        if (!options?.silent) toast('Synced', 'success')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed'
        setState((s) => ({ ...s, syncing: false, error: message }))
        if (!options?.silent) toast(message, 'error')
      } finally {
        syncingRef.current = false
      }
    },
    [session?.apiToken, toast],
  )

  return { ...state, sync }
}
