'use client'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/Toast'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type SyncFn = (options?: { silent?: boolean; since?: string }) => Promise<{ count?: number } | void>

export function useSyncEvents(
  token: string | undefined,
  lastSyncedAt: string | null,
  sync: SyncFn,
): { connId: string | null } {
  const [connId, setConnId] = useState<string | null>(null)
  const { toast } = useToast()
  const lastSyncedAtRef = useRef(lastSyncedAt)
  useEffect(() => { lastSyncedAtRef.current = lastSyncedAt }, [lastSyncedAt])

  useEffect(() => {
    if (!token) return

    const es = new EventSource(`${API_URL}/sync/events?token=${encodeURIComponent(token)}`)

    es.addEventListener('connected', (e) => {
      try {
        const { connId: id } = JSON.parse((e as MessageEvent).data) as { connId: string }
        setConnId(id)
      } catch { /* malformed */ }
    })

    es.addEventListener('error', () => { setConnId(null) })

    es.addEventListener('sync', () => {
      const since = lastSyncedAtRef.current ?? new Date(0).toISOString()
      sync({ silent: true, since }).then((result) => {
        const count = (result as { count?: number } | void)?.count ?? 0
        const msg = count > 0
          ? `${count} item${count === 1 ? '' : 's'} updated from another device`
          : 'Synced from another device'
        toast(msg, 'info')
      })
    })

    return () => { es.close(); setConnId(null) }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return { connId }
}
