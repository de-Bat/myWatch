# Server Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When one client pushes watchlist changes, all other connected clients for the same user auto-pull and show a toast with the item count.

**Architecture:** SSE endpoint `GET /sync/events` streams events per authenticated user (token via query param). On `POST /sync/push`, the API emits a `sync` SSE event to all other connections for that userId via an in-memory bus. The web client connects via `useSyncEvents`, receives the event, auto-pulls, and toasts the diff count.

**Tech Stack:** Fastify 5 (SSE via raw reply), Next.js 14 / React 18, Vitest, existing `useSync` / `useToast` hooks, `crypto.randomUUID` for connection IDs.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `apps/api/src/utils/sse-bus.ts` | Create | In-memory fan-out: subscribe/unsubscribe/emit per userId |
| `apps/api/src/routes/sync.ts` | Modify | Add `GET /sync/events`; emit on `POST /sync/push` |
| `apps/api/tests/sync.test.ts` | Modify | Add SSE event and bus emit tests |
| `apps/web/src/lib/sync.ts` | Modify | `pullItems` returns `{ pulledAt, count }` |
| `apps/web/src/lib/api-client.ts` | Modify | `sync.push` accepts optional `connId`, sends `X-Conn-Id` header |
| `apps/web/src/hooks/useSyncEvents.ts` | Create | Opens EventSource, handles `connected`/`sync` events |
| `apps/web/src/components/AutoSync.tsx` | Modify | Mount `useSyncEvents` |
| `apps/web/tests/sync.test.ts` | Modify | Update `pullItems` tests for new return shape |

---

## Task 1: SSE Bus (API)

**Files:**
- Create: `apps/api/src/utils/sse-bus.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/tests/sync.test.ts` a new top-level describe block (before the existing `POST /sync/push` block):

```ts
import { SseBus } from '../src/utils/sse-bus.js'

describe('SseBus', () => {
  it('emits to all connections for a userId except excludeConnId', () => {
    const bus = new SseBus()
    const sent: string[] = []
    const fakeReply = (data: string) => { sent.push(data) }
    bus.subscribe('u1', 'conn-a', fakeReply)
    bus.subscribe('u1', 'conn-b', fakeReply)
    bus.subscribe('u2', 'conn-c', fakeReply)

    bus.emit('u1', 'conn-a', { pushedAt: '2024-01-01T00:00:00Z' })

    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain('event: sync')
    expect(sent[0]).toContain('"pushedAt"')
  })

  it('does nothing when no connections for userId', () => {
    const bus = new SseBus()
    expect(() => bus.emit('u1', 'conn-x', { pushedAt: '2024-01-01T00:00:00Z' })).not.toThrow()
  })

  it('unsubscribe removes connection', () => {
    const bus = new SseBus()
    const sent: string[] = []
    bus.subscribe('u1', 'conn-a', (data) => { sent.push(data) })
    bus.unsubscribe('u1', 'conn-a')
    bus.emit('u1', 'conn-b', { pushedAt: '2024-01-01T00:00:00Z' })
    expect(sent).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @mywatch/api test
```
Expected: FAIL — `Cannot find module '../src/utils/sse-bus.js'`

- [ ] **Step 3: Create `apps/api/src/utils/sse-bus.ts`**

```ts
type Sender = (data: string) => void

export class SseBus {
  private connections = new Map<string, Map<string, Sender>>()

  subscribe(userId: string, connId: string, send: Sender): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Map())
    }
    this.connections.get(userId)!.set(connId, send)
  }

  unsubscribe(userId: string, connId: string): void {
    this.connections.get(userId)?.delete(connId)
  }

  emit(userId: string, excludeConnId: string, data: { pushedAt: string }): void {
    const userConns = this.connections.get(userId)
    if (!userConns) return
    const payload = `event: sync\ndata: ${JSON.stringify(data)}\n\n`
    for (const [connId, send] of userConns) {
      if (connId !== excludeConnId) {
        try { send(payload) } catch { /* connection gone */ }
      }
    }
  }
}

export const sseBus = new SseBus()
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm --filter @mywatch/api test
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```
git add apps/api/src/utils/sse-bus.ts apps/api/tests/sync.test.ts
git commit -m "feat: SSE bus for per-user connection fan-out"
```

---

## Task 2: `GET /sync/events` endpoint

**Files:**
- Modify: `apps/api/src/routes/sync.ts`
- Modify: `apps/api/tests/sync.test.ts`

The `authenticate` middleware calls `req.jwtVerify()` which reads the `Authorization` header. EventSource cannot set headers, so this route uses a custom `authenticateQuery` that reads `?token=` instead.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/tests/sync.test.ts`:

```ts
describe('GET /sync/events', () => {
  it('returns 401 without token', async () => {
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo: makeWatchlistRepo(), playlistRepo: makePlaylistRepo() })
    const res = await app.inject({ method: 'GET', url: '/sync/events' })
    expect(res.statusCode).toBe(401)
  })

  it('returns SSE connected event with connId', async () => {
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo: makeWatchlistRepo(), playlistRepo: makePlaylistRepo() })
    const token = getAuthToken(app)

    const res = await app.inject({
      method: 'GET',
      url: `/sync/events?token=${encodeURIComponent(token)}`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.body).toContain('event: connected')
    expect(res.body).toContain('"connId"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @mywatch/api test
```
Expected: FAIL — 404 for `/sync/events`

- [ ] **Step 3: Add `authenticateQuery` and `GET /sync/events` to `apps/api/src/routes/sync.ts`**

Add the import at the top of the file:

```ts
import { sseBus } from '../utils/sse-bus.js'
```

Add `authenticateQuery` helper after the imports (before `registerSyncRoutes`):

```ts
async function authenticateQuery(req: FastifyRequest, reply: FastifyReply) {
  const { token } = req.query as { token?: string }
  if (!token) return reply.status(401).send({ error: 'Unauthorized' })
  try {
    const decoded = await req.server.jwt.verify<{ sub: string; email: string; isGuest: boolean }>(token)
    req.user = decoded
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}
```

Add route inside `registerSyncRoutes`, after the existing `GET /sync/pull` route:

```ts
app.get(
  '/sync/events',
  { preHandler: [authenticateQuery] },
  async (req, reply) => {
    const userId = req.user.sub
    const connId = crypto.randomUUID()

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()

    const send = (data: string) => reply.raw.write(data)

    send(`event: connected\ndata: ${JSON.stringify({ connId })}\n\n`)
    sseBus.subscribe(userId, connId, send)

    const keepalive = setInterval(() => {
      try { reply.raw.write(': keepalive\n\n') } catch { clearInterval(keepalive) }
    }, 30_000)

    req.raw.on('close', () => {
      clearInterval(keepalive)
      sseBus.unsubscribe(userId, connId)
    })

    await new Promise<void>((resolve) => req.raw.on('close', resolve))
  },
)
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm --filter @mywatch/api test
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```
git add apps/api/src/routes/sync.ts apps/api/tests/sync.test.ts
git commit -m "feat: GET /sync/events SSE endpoint with connId"
```

---

## Task 3: Emit SSE on push

**Files:**
- Modify: `apps/api/src/routes/sync.ts`
- Modify: `apps/api/tests/sync.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the existing `describe('POST /sync/push')` block in `apps/api/tests/sync.test.ts`:

```ts
it('emits SSE event to other connections after push', async () => {
  const watchlistRepo = makeWatchlistRepo()
  const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo, playlistRepo: makePlaylistRepo() })
  const token = getAuthToken(app)

  const sent: string[] = []
  const { sseBus } = await import('../src/utils/sse-bus.js')
  sseBus.subscribe(mockUser.id, 'other-conn', (data) => { sent.push(data) })

  const res = await app.inject({
    method: 'POST',
    url: '/sync/push',
    headers: { authorization: `Bearer ${token}`, 'x-conn-id': 'my-conn' },
    payload: { items: [mockItem] },
  })

  expect(res.statusCode).toBe(200)
  expect(sent).toHaveLength(1)
  expect(sent[0]).toContain('event: sync')

  sseBus.unsubscribe(mockUser.id, 'other-conn')
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @mywatch/api test
```
Expected: FAIL — `sent` is empty (emit not called yet)

- [ ] **Step 3: Add emit call to `POST /sync/push` in `apps/api/src/routes/sync.ts`**

In the `POST /sync/push` handler, after the `await watchlistRepo.upsertItems(...)` and `await playlistRepo.upsertPlaylists(...)` lines and before `return reply.send(...)`, add:

```ts
const connId = (req.headers['x-conn-id'] as string | undefined) ?? ''
const pushedAt = new Date().toISOString()
sseBus.emit(userId, connId, { pushedAt })
return reply.send({ pushedAt })
```

Remove the existing `return reply.send({ pushedAt: new Date().toISOString() })` line — it's replaced by the above.

- [ ] **Step 4: Run test to verify it passes**

```
pnpm --filter @mywatch/api test
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```
git add apps/api/src/routes/sync.ts apps/api/tests/sync.test.ts
git commit -m "feat: emit SSE sync event to other clients on push"
```

---

## Task 4: `pullItems` returns count (web)

**Files:**
- Modify: `apps/web/src/lib/sync.ts`
- Modify: `apps/web/tests/sync.test.ts`
- Modify: `apps/web/src/hooks/useSync.ts`

- [ ] **Step 1: Update existing `pullItems` tests in `apps/web/tests/sync.test.ts`**

Change every `const pulledAt = await pullItems(...)` line to `const result = await pullItems(...)`.

Change every `expect(pulledAt).toBe(...)` to `expect(result.pulledAt).toBe(...)`.

Add a count assertion to the first `pullItems` test ("stores incoming remote items and returns pulledAt"):

```ts
const result = await pullItems('2024-01-01T00:00:00Z', 'token123')
expect(result.pulledAt).toBe('2024-01-01T01:00:00Z')
expect(result.count).toBe(1)
expect((await db.watchlistItems.get('i2'))?.status).toBe('watched')
```

Add `count` assertions to the LWW tests:

```ts
// "last-write-wins: remote newer" — add after existing assertions:
const result = await pullItems('2024-01-01T00:00:00Z', 'token123')
expect(result.count).toBe(1)

// "last-write-wins: local newer" — add after existing assertions:
const result = await pullItems('2024-01-01T00:00:00Z', 'token123')
expect(result.count).toBe(0)  // local wins; nothing written from remote
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @mywatch/web test
```
Expected: FAIL — `result.pulledAt` undefined (pullItems still returns string)

- [ ] **Step 3: Update `pullItems` in `apps/web/src/lib/sync.ts`**

Change the function signature and return from:

```ts
export async function pullItems(since: string, token: string): Promise<string> {
```

to:

```ts
export async function pullItems(since: string, token: string): Promise<{ pulledAt: string; count: number }> {
```

Replace the final `return pulledAt` with:

```ts
return { pulledAt, count: resolved.length }
```

Where `resolved` is the array built in the conflict-resolution block. If `remoteItems.length === 0` (early path), return:

```ts
return { pulledAt, count: 0 }
```

The full updated function body:

```ts
export async function pullItems(since: string, token: string): Promise<{ pulledAt: string; count: number }> {
  const { items: remoteItems, pulledAt } = await apiClient.sync.pull(since, token)
  if (remoteItems.length === 0) return { pulledAt, count: 0 }

  const ids = remoteItems.map((i) => i.id)
  const localItems = await db.watchlistItems.where('id').anyOf(ids).toArray()
  const localMap = new Map(localItems.map((i) => [i.id, i]))
  const resolved = remoteItems.map((remote) => {
    const local = localMap.get(remote.id)
    return local === undefined ? remote : resolveConflict(local, remote)
  })
  // Only count items that differ from local (new or actually updated)
  const changed = resolved.filter((item) => {
    const local = localMap.get(item.id)
    return local === undefined || local.updatedAt !== item.updatedAt
  })
  await db.watchlistItems.bulkPut(resolved)
  return { pulledAt, count: changed.length }
}
```

- [ ] **Step 4: Fix `useSync.ts` — update `pullItems` call**

In `apps/web/src/hooks/useSync.ts`, the `sync` function calls `pullItems` and assigns to `pulledAt`. Update:

```ts
const { pulledAt } = await pullItems(
  options?.since ?? new Date(0).toISOString(),
  session.apiToken,
)
setState({ syncing: false, lastSyncedAt: pulledAt, error: null })
```

- [ ] **Step 5: Run tests to verify they pass**

```
pnpm --filter @mywatch/web test
```
Expected: all tests PASS

- [ ] **Step 6: Commit**

```
git add apps/web/src/lib/sync.ts apps/web/src/hooks/useSync.ts apps/web/tests/sync.test.ts
git commit -m "feat: pullItems returns {pulledAt, count} for toast messaging"
```

---

## Task 5: `api-client` connId support

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`

No test needed — this is a thin wrapper change; covered by existing integration path.

- [ ] **Step 1: Update `sync.push` in `apps/web/src/lib/api-client.ts`**

Change the `push` method signature and implementation from:

```ts
push(items: WatchlistItem[], token: string) {
  return apiFetch<{ pushedAt: string }>('/sync/push', {
    method: 'POST',
    body: JSON.stringify({ items }),
    token,
  })
},
```

to:

```ts
push(items: WatchlistItem[], token: string, connId?: string) {
  return apiFetch<{ pushedAt: string }>('/sync/push', {
    method: 'POST',
    body: JSON.stringify({ items }),
    token,
    headers: connId ? { 'X-Conn-Id': connId } : undefined,
  })
},
```

- [ ] **Step 2: Update `pushPendingItems` in `apps/web/src/lib/sync.ts` to accept and forward connId**

Change signature from:

```ts
export async function pushPendingItems(token: string, userId: string): Promise<void> {
```

to:

```ts
export async function pushPendingItems(token: string, userId: string, connId?: string): Promise<void> {
```

Change the `apiClient.sync.push` call from:

```ts
await apiClient.sync.push(claimed, token)
```

to:

```ts
await apiClient.sync.push(claimed, token, connId)
```

- [ ] **Step 3: Run tests**

```
pnpm --filter @mywatch/web test
```
Expected: all tests PASS (existing push tests use no connId, still valid)

- [ ] **Step 4: Commit**

```
git add apps/web/src/lib/api-client.ts apps/web/src/lib/sync.ts
git commit -m "feat: forward connId as X-Conn-Id header on push to suppress self-notification"
```

---

## Task 6: `useSyncEvents` hook

**Files:**
- Create: `apps/web/src/hooks/useSyncEvents.ts`

- [ ] **Step 1: Create `apps/web/src/hooks/useSyncEvents.ts`**

```ts
'use client'
import { useEffect, useRef } from 'react'
import { useToast } from '@/components/Toast'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type SyncFn = (options?: { silent?: boolean; since?: string }) => Promise<{ count?: number } | void>

export function useSyncEvents(
  token: string | undefined,
  lastSyncedAt: string | null,
  sync: SyncFn,
): { connId: string | null } {
  const connIdRef = useRef<string | null>(null)
  const { toast } = useToast()
  const lastSyncedAtRef = useRef(lastSyncedAt)
  useEffect(() => { lastSyncedAtRef.current = lastSyncedAt }, [lastSyncedAt])

  useEffect(() => {
    if (!token) return

    const es = new EventSource(`${API_URL}/sync/events?token=${encodeURIComponent(token)}`)

    es.addEventListener('connected', (e) => {
      try {
        const { connId } = JSON.parse((e as MessageEvent).data) as { connId: string }
        connIdRef.current = connId
      } catch { /* malformed */ }
    })

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

    return () => { es.close(); connIdRef.current = null }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return { connId: connIdRef.current }
}
```

- [ ] **Step 2: Run type-check**

```
pnpm --filter @mywatch/web type-check
```
Expected: no errors

- [ ] **Step 3: Commit**

```
git add apps/web/src/hooks/useSyncEvents.ts
git commit -m "feat: useSyncEvents hook — SSE listener with auto-pull and toast"
```

---

## Task 7: Wire up in `AutoSync`

**Files:**
- Modify: `apps/web/src/components/AutoSync.tsx`
- Modify: `apps/web/src/hooks/useSync.ts`

`useSync.sync` currently returns `void`. The `useSyncEvents` callback needs the `count` from `pullItems`. Update `useSync` to return it, then update `AutoSync` to pass `sync` to `useSyncEvents`.

- [ ] **Step 1: Update `useSync` to expose count via sync return**

In `apps/web/src/hooks/useSync.ts`, change the `sync` callback return type and the resolved path:

```ts
// Change function signature — sync now returns the count (or undefined on error)
const sync = useCallback(
  async (options?: { silent?: boolean; since?: string }): Promise<{ count: number } | void> => {
    if (!session?.apiToken) return
    if (syncingRef.current) return
    syncingRef.current = true
    setState((s) => ({ ...s, syncing: true, error: null }))
    try {
      await pushPendingItems(session.apiToken, session.user?.id ?? '', connId ?? undefined)
      const { pulledAt, count } = await pullItems(
        options?.since ?? new Date(0).toISOString(),
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
    }
  },
  [session?.apiToken, toast], // eslint-disable-line react-hooks/exhaustive-deps
)
```

Also add `connId` param to `useSync` so `pushPendingItems` can forward it. Add a `connIdRef` inside `useSync`:

```ts
const connIdRef = useRef<string | null>(null)
```

Expose a setter:

```ts
const setConnId = useCallback((id: string | null) => { connIdRef.current = id }, [])
```

Update `pushPendingItems` call inside sync:

```ts
await pushPendingItems(session.apiToken, session.user?.id ?? '', connIdRef.current ?? undefined)
```

Return `{ ...state, sync, setConnId }` from `useSync`.

- [ ] **Step 2: Update `AutoSync.tsx` to mount `useSyncEvents`**

Full updated file:

```tsx
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
```

- [ ] **Step 3: Run type-check and tests**

```
pnpm --filter @mywatch/web type-check
pnpm --filter @mywatch/web test
```
Expected: no type errors, all tests PASS

- [ ] **Step 4: Commit**

```
git add apps/web/src/hooks/useSync.ts apps/web/src/components/AutoSync.tsx
git commit -m "feat: wire useSyncEvents into AutoSync, forward connId to push"
```

---

## Task 8: Manual smoke test

- [ ] **Step 1: Start the stack**

```
docker-compose up -d
pnpm --filter @mywatch/api dev &
pnpm --filter @mywatch/web dev
```

- [ ] **Step 2: Open two browser tabs on `http://localhost:3000`, sign in on both**

- [ ] **Step 3: In Tab A, add or update a watchlist item**

- [ ] **Step 4: Verify Tab B shows toast within ~1 second**

Expected toast: `"1 item updated from another device"` (or `"N items..."` for multiple)

- [ ] **Step 5: Verify Tab A does NOT show the notification (self-push excluded)**

- [ ] **Step 6: Disconnect Tab B (close network / go offline), make a change in Tab A, reconnect Tab B**

Expected: EventSource auto-reconnects and next push triggers toast again.

- [ ] **Step 7: Final commit if any fixups were needed**

```
git add -p
git commit -m "fix: smoke test fixups"
```
