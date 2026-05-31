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
  const connIdRef = useRef<string | null>(null)
  const [state, setState] = useState<SyncState>({
    syncing: false,
    lastSyncedAt: null,
    error: null,
  })

  const setConnId = useCallback((id: string | null) => {
    connIdRef.current = id
  }, [])

  const pendingSinceRef = useRef<string | null>(null)

  const sync = useCallback(
    async (options?: { silent?: boolean; since?: string }): Promise<{ count: number } | void> => {
      if (!session?.apiToken) return
      if (syncingRef.current) {
        // Another sync in progress — remember the since so we re-sync after it finishes
        if (options?.since !== undefined) {
          pendingSinceRef.current = options.since
        }
        return
      }
      const pendingSince = pendingSinceRef.current
      pendingSinceRef.current = null
      syncingRef.current = true
      setState((s) => ({ ...s, syncing: true, error: null }))
      try {
        await pushPendingItems(session.apiToken, session.user?.id ?? '', connIdRef.current ?? undefined)
        const { pulledAt, count } = await pullItems(
          options?.since ?? pendingSince ?? new Date(0).toISOString(),
          session.apiToken,
        )
        setState({ syncing: false, lastSyncedAt: pulledAt, error: null })
        if (!options?.silent) toast('Synced', 'success')
        return { count }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed'
        setState((s) => ({ ...s, syncing: false, error: message }))
        if (!options?.silent) toast(message, 'error')
      } finally {
        syncingRef.current = false
        // If an SSE arrived while we were syncing, do a follow-up pull
        if (pendingSinceRef.current !== null) {
          const since = pendingSinceRef.current
          pendingSinceRef.current = null
          void pullItems(since, session.apiToken)
            .then(({ pulledAt }) => setState((s) => ({ ...s, lastSyncedAt: pulledAt })))
            .catch(() => {})
        }
      }
    },
    [session?.apiToken, toast], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return { ...state, sync, setConnId }
}
