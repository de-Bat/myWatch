# Server Push Notifications — Design Spec

**Date:** 2026-05-30

## Overview

When one client pushes watchlist changes to the server, all other connected clients for the same user receive a real-time notification via SSE, auto-pull the changes, and display a toast showing how many items were updated.

## Scope

- Watchlist changes only (items added/updated/deleted)
- Single API instance (no horizontal scaling requirement)
- No new infrastructure dependencies

---

## Architecture

```
[Client A]  POST /sync/push  →  API  →  upsert DB
                                  ↓
                            sseBus.emit(userId, excludeConnId)
                                  ↓
[Client B]  ← SSE stream ←  API  receives {pushedAt}
                ↓
           sync({ silent: true, since: lastSyncedAt })
                ↓
           resolveConflict (existing LWW logic)
                ↓
           toast "3 items updated from another device"
```

---

## Server Changes

### `apps/api/src/utils/sse-bus.ts` (new)

In-memory store: `Map<userId, Map<connId, SSEConnection>>`.

```ts
interface SSEConnection {
  reply: FastifyReply
  connId: string
}

class SseBus {
  subscribe(userId, connId, reply): void
  unsubscribe(userId, connId): void
  emit(userId, excludeConnId, data): void  // sends to all except excludeConnId
}

export const sseBus = new SseBus()
```

### `GET /sync/events` (new route in `routes/sync.ts`)

- Auth: `?token=<jwt>` query param (EventSource cannot set headers)
- Sets SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Generates `connId` (crypto.randomUUID), registers with `sseBus`
- Sends first event immediately:
  ```
  event: connected
  data: {"connId":"<uuid>"}
  ```
- Sends keepalive comment every 30s:
  ```
  : keepalive
  ```
- On request close: `sseBus.unsubscribe(userId, connId)`

### `POST /sync/push` (modified)

After upsert, reads `X-Conn-Id` header from request. Calls:
```ts
sseBus.emit(userId, req.headers['x-conn-id'], { pushedAt })
```

Emits:
```
event: sync
data: {"pushedAt":"2026-05-30T12:00:00Z"}
```

---

## Client Changes

### `apps/web/src/lib/sync.ts` — `pullItems` return type

Change from returning `string` (pulledAt) to `{ pulledAt: string; count: number }`.
Count = number of items actually written to local DB after conflict resolution.

### `apps/web/src/hooks/useSync.ts`

Update to handle new `pullItems` return shape. No behavioral change.

### `apps/web/src/hooks/useSyncEvents.ts` (new)

```ts
function useSyncEvents(token: string | undefined, lastSyncedAt: string | null, sync: SyncFn): void
```

- Opens `EventSource` to `${API_URL}/sync/events?token=<jwt>` when token present
- On `connected` event: stores `connId` in ref, sets `X-Conn-Id` header on future pushes
- On `sync` event: calls `sync({ silent: true, since: lastSyncedAt ?? new Date(0).toISOString() })`
- On sync completion: toasts `"N items updated from another device"` (or `"Synced from another device"` if count is 0 or unavailable)
- Browser handles reconnection automatically on `error`
- `eventSource.close()` on unmount / token change

### `apps/web/src/lib/api-client.ts`

Add `X-Conn-Id` header to `sync.push` calls when a connId is available. Pass via argument:
```ts
push(items, token, connId?: string)
```

### `apps/web/src/components/AutoSync.tsx`

Mount `useSyncEvents` alongside existing interval/visibility logic. Passes `session.apiToken`, `lastSyncedAt`, and `sync` from `useSync`.

---

## Data Flow Summary

1. Client B connects → `GET /sync/events?token=...` → receives `connId`
2. Client A pushes → `POST /sync/push` with `X-Conn-Id: <A's connId>`
3. API upserts, emits SSE to all connections for userId except A's connId
4. Client B receives `sync` event → calls `sync({ silent: true, since: lastSyncedAt })`
5. `pullItems` fetches, resolves conflicts, returns `{ pulledAt, count }`
6. Toast: `"${count} items updated from another device"`

---

## Error Handling

- SSE connection drop: browser `EventSource` auto-reconnects with exponential backoff
- Token expiry: server closes SSE with 401; client should detect and not retry (close EventSource when session expires)
- Push with no active SSE connections: no-op, normal push succeeds
- Bus emit failure: non-fatal, logged but does not fail the push response

---

## Out of Scope

- Playlist/settings push notifications
- Multi-instance fan-out (Redis pub/sub)
- Notification for the pushing client itself
