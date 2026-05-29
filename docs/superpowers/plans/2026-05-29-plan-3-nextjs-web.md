# Plan 3: Next.js Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `apps/web` Next.js 14 App Router frontend with Auth.js auth, Dexie.js local-first storage, sync, and all five main screens (My List, Search, Media Detail, Discover, Profile/Settings).

**Architecture:** Next.js 14 App Router in `apps/web/`. Dexie.js (IndexedDB) is the client-side source of truth; the sync engine pushes dirty items and pulls from the Fastify API. Auth.js v5 manages sessions (Credentials + Google + Apple). TMDB data flows through `@mywatch/tmdb` with local `mediaCache` in Dexie for offline fallback. All data pages are Client Components (local-first design — no server-side user data rendering).

**Tech Stack:** Next.js 14.2, React 18, Auth.js v5 (`next-auth@5-beta`), Dexie 4, dexie-react-hooks, Tailwind CSS 3, uuid 9, @mywatch/core, @mywatch/tmdb, @mywatch/sync, Vitest 2, fake-indexeddb 6, TypeScript 5.5, pnpm workspaces

---

## Context

Plan 1 scaffolded the monorepo packages:
- `@mywatch/core` — `User`, `WatchlistItem`, `MediaCache` types, Zod schemas, status machine
- `@mywatch/tmdb` — `TmdbClient({ apiKey, baseUrl? })`, `normalizeMovie`, `normalizeTv`, `isStale`
- `@mywatch/sync` — `mergeItems`, `resolveConflict`, `getOrCreateDeviceId`, `SyncPushPayload`, `SyncPullResponse`

Plan 2 built `apps/api` (Fastify) with these endpoints:
- `POST /auth/register` body: `{ email, password, displayName }` → `{ token, user }`
- `POST /auth/login` body: `{ email, password }` → `{ token, user }`
- `GET /auth/me` header: `Authorization: Bearer <token>` → `{ user }`
- `POST /auth/oauth/google` body: `{ idToken }` → `{ token, user }`
- `POST /auth/oauth/apple` body: `{ identityToken }` → `{ token, user }`
- `POST /sync/push` header: Bearer token, body: `{ items: WatchlistItem[] }` → `{ pushedAt }`
- `GET /sync/pull?since=<ISO>` header: Bearer token → `{ items: WatchlistItem[], pulledAt }`

**Important:** The push endpoint validates that every item's `userId` matches the JWT subject. Items with wrong `userId` return 403.

**Key `TmdbClient` note:** Constructor takes `{ apiKey: string, baseUrl?: string }` — not a bare string.

**Key `db.mediaCache.get` note:** Compound key query: `db.mediaCache.get([tmdbId, mediaType])`.

---

## File Structure

```
apps/web/
  src/
    auth.ts                         — Auth.js config (handlers, signIn, signOut, auth)
    middleware.ts                   — protect /profile; redirect unauthenticated to /auth/login
    types/
      next-auth.d.ts                — Session type augmentation (apiToken, user.id)
    app/
      globals.css                   — Tailwind directives
      layout.tsx                    — root layout (SessionProvider, dark class)
      page.tsx                      — My List home screen
      auth/
        login/page.tsx              — login form + OAuth buttons
        register/page.tsx           — register form
      media/[type]/[id]/page.tsx    — Media Detail page
      search/page.tsx               — Search page
      discover/page.tsx             — Discover page
      profile/page.tsx              — Profile/Settings page
      api/auth/[...nextauth]/route.ts — Auth.js handler
    components/
      WatchlistItemCard.tsx
      StatusBadge.tsx
      MediaCard.tsx
      StatusPicker.tsx
      ProgressTracker.tsx
    lib/
      api-client.ts                 — typed fetch wrappers for Fastify API
      db.ts                         — Dexie schema: watchlistItems, pendingPushes, mediaCache
      sync.ts                       — pushPendingItems, pullItems
    hooks/
      useWatchlist.ts               — liveQuery items + upsert/soft-delete + getLocalDeviceId
      useSync.ts                    — trigger sync, expose { syncing, lastSyncedAt, error }
      useMediaMeta.ts               — fetch + cache TMDB metadata via Dexie
  tests/
    setup.ts
    api-client.test.ts
    db.test.ts
    sync.test.ts
  package.json
  tsconfig.json
  next.config.ts
  tailwind.config.ts
  postcss.config.js
  vitest.config.ts
  .env.local.example
```

---

## Task 1: Next.js 14 Scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/tests/setup.ts`
- Create: `apps/web/.env.local.example`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@mywatch/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "14.2.29",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "next-auth": "^5.0.0-beta.25",
    "dexie": "^4.0.10",
    "dexie-react-hooks": "^1.1.7",
    "uuid": "^9.0.0",
    "@mywatch/core": "workspace:*",
    "@mywatch/tmdb": "workspace:*",
    "@mywatch/sync": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@types/node": "^22.0.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "vitest": "^2.1.9",
    "@vitejs/plugin-react": "^4.3.0",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@mywatch/core', '@mywatch/tmdb', '@mywatch/sync'],
}

export default config
```

- [ ] **Step 4: Create `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
}

export default config
```

- [ ] **Step 5: Create `apps/web/postcss.config.js`**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Create `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 7: Create `apps/web/tests/setup.ts`**

```typescript
import 'fake-indexeddb/auto'
```

- [ ] **Step 8: Create `apps/web/.env.local.example`**

```
# Fastify API base URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# TMDB API key (from https://www.themoviedb.org/settings/api)
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key_here

# Auth.js — generate with: openssl rand -base64 32
AUTH_SECRET=your_auth_secret_here

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Apple Sign-In (from Apple Developer portal)
# APPLE_ID = Services ID (e.g. com.mywatch.web)
# APPLE_SECRET = JWT signed with Apple private key; see Auth.js docs
APPLE_ID=com.mywatch.web
APPLE_SECRET=your_apple_jwt_secret
```

- [ ] **Step 9: Create `apps/web/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: Create `apps/web/src/app/layout.tsx`** (placeholder — replaced in Task 4)

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'myWatch',
  description: 'Your media watchlist',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-900 text-zinc-100 min-h-screen">{children}</body>
    </html>
  )
}
```

- [ ] **Step 11: Create `apps/web/src/app/page.tsx`** (placeholder — replaced in Task 6)

```tsx
export default function HomePage() {
  return <div className="p-4 text-zinc-400">Loading…</div>
}
```

- [ ] **Step 12: Install dependencies from `apps/web/`**

```bash
pnpm install
```

- [ ] **Step 13: Verify TypeScript compiles**

```bash
pnpm type-check
```

Expected: no errors (or only `next-env.d.ts` not found — run `next dev` once to generate it).

- [ ] **Step 14: Commit**

```bash
git add apps/web/
git commit -m "feat(web): scaffold Next.js 14 app with Tailwind and Vitest"
```

---

## Task 2: API Client

**Files:**
- Create: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/tests/api-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { apiClient } from '../src/lib/api-client'

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  isGuest: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

beforeEach(() => mockFetch.mockReset())

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
}

function mockError(status: number, body = 'Error') {
  mockFetch.mockResolvedValueOnce({ ok: false, status, text: () => Promise.resolve(body) })
}

describe('apiClient.auth', () => {
  it('login returns token and user', async () => {
    mockOk({ token: 'tok', user: mockUser })
    const result = await apiClient.auth.login({ email: 'test@example.com', password: 'pass' })
    expect(result.token).toBe('tok')
    expect(result.user.id).toBe('user-1')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/auth/login',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('login throws on 401', async () => {
    mockError(401, 'Invalid credentials')
    await expect(apiClient.auth.login({ email: 'x@x.com', password: 'wrong' })).rejects.toThrow('401')
  })

  it('register returns token and user', async () => {
    mockOk({ token: 'tok', user: mockUser })
    const result = await apiClient.auth.register({
      email: 'new@example.com',
      password: 'pass',
      displayName: 'New',
    })
    expect(result.token).toBe('tok')
  })

  it('me returns user with bearer token', async () => {
    mockOk({ user: mockUser })
    const result = await apiClient.auth.me('tok')
    expect(result.user.id).toBe('user-1')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    )
  })

  it('oauthGoogle returns token and user', async () => {
    mockOk({ token: 'tok', user: mockUser })
    const result = await apiClient.auth.oauthGoogle('google-id-token')
    expect(result.token).toBe('tok')
  })

  it('oauthApple returns token and user', async () => {
    mockOk({ token: 'tok', user: mockUser })
    const result = await apiClient.auth.oauthApple('apple-identity-token')
    expect(result.token).toBe('tok')
  })
})

describe('apiClient.sync', () => {
  it('push sends items with bearer token', async () => {
    mockOk({ pushedAt: '2024-01-01T01:00:00Z' })
    await apiClient.sync.push([] as any, 'tok')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/sync/push',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    )
  })

  it('pull fetches items since timestamp', async () => {
    mockOk({ items: [], pulledAt: '2024-01-01T01:00:00Z' })
    const result = await apiClient.sync.pull('2024-01-01T00:00:00Z', 'tok')
    expect(result.items).toEqual([])
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/sync/pull?since='),
      expect.any(Object),
    )
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run from `apps/web/`:
```bash
pnpm test -- tests/api-client.test.ts
```

Expected: FAIL — module `../src/lib/api-client` not found.

- [ ] **Step 3: Implement `src/lib/api-client.ts`**

```typescript
import type { User, WatchlistItem } from '@mywatch/core'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string },
): Promise<T> {
  const { token, headers: extraHeaders, ...rest } = options ?? {}
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extraHeaders as Record<string, string> | undefined),
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

export const apiClient = {
  auth: {
    register(body: { email: string; password: string; displayName: string }) {
      return apiFetch<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    login(body: { email: string; password: string }) {
      return apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    me(token: string) {
      return apiFetch<{ user: User }>('/auth/me', { token })
    },
    oauthGoogle(idToken: string) {
      return apiFetch<{ token: string; user: User }>('/auth/oauth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      })
    },
    oauthApple(identityToken: string) {
      return apiFetch<{ token: string; user: User }>('/auth/oauth/apple', {
        method: 'POST',
        body: JSON.stringify({ identityToken }),
      })
    },
  },
  sync: {
    push(items: WatchlistItem[], token: string) {
      return apiFetch<{ pushedAt: string }>('/sync/push', {
        method: 'POST',
        body: JSON.stringify({ items }),
        token,
      })
    },
    pull(since: string, token: string) {
      return apiFetch<{ items: WatchlistItem[]; pulledAt: string }>(
        `/sync/pull?since=${encodeURIComponent(since)}`,
        { token },
      )
    },
  },
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
pnpm test -- tests/api-client.test.ts
```

Expected: 8/8 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api-client.ts apps/web/tests/api-client.test.ts
git commit -m "feat(web): add typed API client for Fastify endpoints"
```

---

## Task 3: Dexie Local Store

**Files:**
- Create: `apps/web/src/lib/db.ts`
- Create: `apps/web/tests/db.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/db.test.ts
import { beforeEach, describe, it, expect } from 'vitest'
import { db } from '../src/lib/db'
import type { WatchlistItem } from '@mywatch/core'

const baseItem: WatchlistItem = {
  id: 'item-1',
  userId: 'user-1',
  tmdbId: 550,
  mediaType: 'movie',
  status: 'planned',
  progressEpisode: null,
  progressSeason: null,
  rating: null,
  notes: null,
  addedAt: '2024-01-01T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  quitAt: null,
  updatedAt: '2024-01-01T00:00:00Z',
  deviceId: 'dev-1',
  deletedAt: null,
}

beforeEach(async () => {
  await db.watchlistItems.clear()
  await db.pendingPushes.clear()
  await db.mediaCache.clear()
})

describe('watchlistItems', () => {
  it('stores and retrieves item by id', async () => {
    await db.watchlistItems.put(baseItem)
    const found = await db.watchlistItems.get('item-1')
    expect(found).toEqual(baseItem)
  })

  it('returns undefined for missing item', async () => {
    expect(await db.watchlistItems.get('nonexistent')).toBeUndefined()
  })

  it('bulkPut and query all', async () => {
    await db.watchlistItems.bulkPut([
      baseItem,
      { ...baseItem, id: 'item-2', status: 'watched' },
    ])
    expect(await db.watchlistItems.count()).toBe(2)
  })

  it('filters by status index', async () => {
    await db.watchlistItems.bulkPut([
      baseItem,
      { ...baseItem, id: 'item-2', status: 'watched' },
    ])
    const planned = await db.watchlistItems.where('status').equals('planned').toArray()
    expect(planned).toHaveLength(1)
    expect(planned[0].id).toBe('item-1')
  })
})

describe('pendingPushes', () => {
  it('auto-increments id and stores entries', async () => {
    const id = await db.pendingPushes.add({ itemId: 'item-1', queuedAt: '2024-01-01T00:00:00Z' })
    expect(id).toBeTypeOf('number')
    const all = await db.pendingPushes.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].itemId).toBe('item-1')
  })

  it('deletes entries by itemId', async () => {
    await db.pendingPushes.add({ itemId: 'item-1', queuedAt: '2024-01-01T00:00:00Z' })
    await db.pendingPushes.where('itemId').equals('item-1').delete()
    expect(await db.pendingPushes.count()).toBe(0)
  })
})

describe('mediaCache', () => {
  it('stores and retrieves by compound key [tmdbId, mediaType]', async () => {
    const entry = {
      tmdbId: 550,
      mediaType: 'movie' as const,
      title: 'Fight Club',
      overview: 'A man forms an underground fight club.',
      posterPath: '/poster.jpg',
      backdropPath: null,
      releaseDate: '1999-10-15',
      genres: [{ id: 18, name: 'Drama' }],
      voteAverage: 8.4,
      voteCount: 24000,
      runtime: 139,
      seasonsCount: null,
      showStatus: 'Released',
      cachedAt: '2024-01-01T00:00:00Z',
    }
    await db.mediaCache.put(entry)
    const found = await db.mediaCache.get([550, 'movie'])
    expect(found?.title).toBe('Fight Club')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test -- tests/db.test.ts
```

Expected: FAIL — `../src/lib/db` not found.

- [ ] **Step 3: Implement `src/lib/db.ts`**

```typescript
import Dexie, { type Table } from 'dexie'
import type { WatchlistItem, MediaCache, MediaType } from '@mywatch/core'

export interface PendingPush {
  id?: number
  itemId: string
  queuedAt: string
}

class WatchDB extends Dexie {
  watchlistItems!: Table<WatchlistItem, string>
  pendingPushes!: Table<PendingPush, number>
  mediaCache!: Table<MediaCache, [number, MediaType]>

  constructor() {
    super('mywatch')
    this.version(1).stores({
      watchlistItems: 'id, userId, status, mediaType, updatedAt',
      pendingPushes: '++id, itemId',
      mediaCache: '[tmdbId+mediaType], cachedAt',
    })
  }
}

export const db = new WatchDB()
```

- [ ] **Step 4: Run tests and verify pass**

```bash
pnpm test -- tests/db.test.ts
```

Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/db.ts apps/web/tests/db.test.ts
git commit -m "feat(web): add Dexie local store with watchlistItems, pendingPushes, mediaCache"
```

---

## Task 4: Auth.js Setup

**Files:**
- Create: `apps/web/src/types/next-auth.d.ts`
- Create: `apps/web/src/auth.ts`
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/src/app/auth/login/page.tsx`
- Create: `apps/web/src/app/auth/register/page.tsx`
- Modify: `apps/web/src/app/layout.tsx`

No unit tests — auth config is integration-only. Verify TypeScript compiles.

- [ ] **Step 1: Create `src/types/next-auth.d.ts`**

```typescript
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    apiToken: string
    user: {
      id: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    apiToken?: string
    userId?: string
  }
}
```

- [ ] **Step 2: Create `src/auth.ts`**

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import Apple from 'next-auth/providers/apple'
import { apiClient } from './lib/api-client'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const { token, user } = await apiClient.auth.login({
            email: credentials.email as string,
            password: credentials.password as string,
          })
          return {
            id: user.id,
            email: user.email,
            name: user.displayName,
            image: user.avatarUrl,
            apiToken: token,
          }
        } catch {
          return null
        }
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Apple({
      clientId: process.env.APPLE_ID!,
      clientSecret: process.env.APPLE_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user && account?.provider === 'credentials') {
        token.apiToken = (user as any).apiToken as string
        token.userId = user.id!
      }
      if (account?.provider === 'google' && account.id_token) {
        const { token: apiToken, user: apiUser } = await apiClient.auth.oauthGoogle(
          account.id_token,
        )
        token.apiToken = apiToken
        token.userId = apiUser.id
      }
      if (account?.provider === 'apple' && account.id_token) {
        const { token: apiToken, user: apiUser } = await apiClient.auth.oauthApple(
          account.id_token as string,
        )
        token.apiToken = apiToken
        token.userId = apiUser.id
      }
      return token
    },
    async session({ session, token }) {
      session.apiToken = token.apiToken as string
      session.user.id = (token.userId ?? token.sub) as string
      return session
    },
  },
  pages: {
    signIn: '/auth/login',
  },
})
```

- [ ] **Step 3: Create `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 4: Create `src/middleware.ts`**

```typescript
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/profile') && !isLoggedIn) {
    return NextResponse.redirect(new URL('/auth/login', req.nextUrl))
  }
  if (pathname.startsWith('/auth') && isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.nextUrl))
  }
})

export const config = {
  matcher: ['/profile/:path*', '/auth/:path*'],
}
```

- [ ] **Step 5: Create `src/app/auth/login/page.tsx`**

```tsx
'use client'
import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Invalid email or password')
    } else {
      router.push('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Sign in to myWatch</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full py-2 rounded bg-zinc-700 hover:bg-zinc-600 font-medium"
          >
            Continue with Google
          </button>
          <button
            onClick={() => signIn('apple', { callbackUrl: '/' })}
            className="w-full py-2 rounded bg-zinc-700 hover:bg-zinc-600 font-medium"
          >
            Continue with Apple
          </button>
        </div>
        <p className="text-center text-sm text-zinc-400">
          No account?{' '}
          <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create `src/app/auth/register/page.tsx`**

```tsx
'use client'
import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await apiClient.auth.register({ email, password, displayName })
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setError('Registration succeeded but sign-in failed. Try logging in.')
      } else {
        router.push('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Create account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Replace `src/app/layout.tsx` with SessionProvider wrapper**

```tsx
import type { Metadata } from 'next'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import './globals.css'

export const metadata: Metadata = {
  title: 'myWatch',
  description: 'Your media watchlist',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-900 text-zinc-100 min-h-screen">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/auth.ts apps/web/src/types/ apps/web/src/middleware.ts \
  apps/web/src/app/api/ apps/web/src/app/auth/ apps/web/src/app/layout.tsx
git commit -m "feat(web): add Auth.js with Credentials, Google, and Apple providers"
```

---

## Task 5: Sync Engine + Hooks

**Files:**
- Create: `apps/web/src/lib/sync.ts`
- Create: `apps/web/src/hooks/useWatchlist.ts`
- Create: `apps/web/src/hooks/useSync.ts`
- Create: `apps/web/src/hooks/useMediaMeta.ts`
- Create: `apps/web/tests/sync.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/sync.test.ts
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { db } from '../src/lib/db'
import type { WatchlistItem } from '@mywatch/core'

vi.mock('../src/lib/api-client', () => ({
  apiClient: {
    sync: {
      push: vi.fn(),
      pull: vi.fn(),
    },
  },
}))

import { pushPendingItems, pullItems } from '../src/lib/sync'
import { apiClient } from '../src/lib/api-client'

const mockedPush = vi.mocked(apiClient.sync.push)
const mockedPull = vi.mocked(apiClient.sync.pull)

const baseItem: WatchlistItem = {
  id: 'i1',
  userId: 'u1',
  tmdbId: 550,
  mediaType: 'movie',
  status: 'planned',
  progressEpisode: null,
  progressSeason: null,
  rating: null,
  notes: null,
  addedAt: '2024-01-01T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  quitAt: null,
  updatedAt: '2024-01-01T00:00:00Z',
  deviceId: 'dev1',
  deletedAt: null,
}

beforeEach(async () => {
  await db.watchlistItems.clear()
  await db.pendingPushes.clear()
  vi.clearAllMocks()
})

describe('pushPendingItems', () => {
  it('pushes pending items and clears queue', async () => {
    await db.watchlistItems.put(baseItem)
    await db.pendingPushes.add({ itemId: 'i1', queuedAt: '2024-01-01T00:00:00Z' })
    mockedPush.mockResolvedValueOnce({ pushedAt: '2024-01-01T01:00:00Z' })

    await pushPendingItems('token123')

    expect(mockedPush).toHaveBeenCalledWith([baseItem], 'token123')
    expect(await db.pendingPushes.count()).toBe(0)
  })

  it('does nothing when queue is empty', async () => {
    await pushPendingItems('token123')
    expect(mockedPush).not.toHaveBeenCalled()
  })

  it('deduplicates when same itemId queued multiple times', async () => {
    await db.watchlistItems.put(baseItem)
    await db.pendingPushes.add({ itemId: 'i1', queuedAt: '2024-01-01T00:00:00Z' })
    await db.pendingPushes.add({ itemId: 'i1', queuedAt: '2024-01-01T00:01:00Z' })
    mockedPush.mockResolvedValueOnce({ pushedAt: '2024-01-01T01:00:00Z' })

    await pushPendingItems('token123')

    // Item fetched once (deduplicated), all queue entries cleared
    expect(mockedPush).toHaveBeenCalledWith([baseItem], 'token123')
    expect(await db.pendingPushes.count()).toBe(0)
  })
})

describe('pullItems', () => {
  it('stores incoming remote items and returns pulledAt', async () => {
    const remote = { ...baseItem, id: 'i2', status: 'watched' as const }
    mockedPull.mockResolvedValueOnce({ items: [remote], pulledAt: '2024-01-01T01:00:00Z' })

    const pulledAt = await pullItems('2024-01-01T00:00:00Z', 'token123')

    expect(pulledAt).toBe('2024-01-01T01:00:00Z')
    expect((await db.watchlistItems.get('i2'))?.status).toBe('watched')
  })

  it('last-write-wins: remote newer than local wins', async () => {
    await db.watchlistItems.put(baseItem) // updatedAt 2024-01-01
    const newer = { ...baseItem, status: 'watched' as const, updatedAt: '2024-01-02T00:00:00Z' }
    mockedPull.mockResolvedValueOnce({ items: [newer], pulledAt: '2024-01-02T01:00:00Z' })

    await pullItems('2024-01-01T00:00:00Z', 'token123')

    expect((await db.watchlistItems.get('i1'))?.status).toBe('watched')
  })

  it('last-write-wins: local newer than remote keeps local', async () => {
    const localNewer = { ...baseItem, status: 'in_progress' as const, updatedAt: '2024-01-03T00:00:00Z' }
    await db.watchlistItems.put(localNewer)
    const olderRemote = { ...baseItem, status: 'watched' as const, updatedAt: '2024-01-02T00:00:00Z' }
    mockedPull.mockResolvedValueOnce({ items: [olderRemote], pulledAt: '2024-01-03T01:00:00Z' })

    await pullItems('2024-01-01T00:00:00Z', 'token123')

    expect((await db.watchlistItems.get('i1'))?.status).toBe('in_progress')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test -- tests/sync.test.ts
```

Expected: FAIL — `../src/lib/sync` not found.

- [ ] **Step 3: Implement `src/lib/sync.ts`**

```typescript
import { mergeItems } from '@mywatch/sync'
import { db } from './db'
import { apiClient } from './api-client'

export async function pushPendingItems(token: string): Promise<void> {
  const pending = await db.pendingPushes.toArray()
  if (pending.length === 0) return

  const itemIds = [...new Set(pending.map((p) => p.itemId))]
  const items = await db.watchlistItems.where('id').anyOf(itemIds).toArray()

  await apiClient.sync.push(items, token)
  await db.pendingPushes.where('itemId').anyOf(itemIds).delete()
}

export async function pullItems(since: string, token: string): Promise<string> {
  const { items: remoteItems, pulledAt } = await apiClient.sync.pull(since, token)
  if (remoteItems.length > 0) {
    const ids = remoteItems.map((i) => i.id)
    const localItems = await db.watchlistItems.where('id').anyOf(ids).toArray()
    const merged = mergeItems(localItems, remoteItems)
    await db.watchlistItems.bulkPut(merged)
  }
  return pulledAt
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
pnpm test -- tests/sync.test.ts
```

Expected: 6/6 PASS.

- [ ] **Step 5: Create `src/hooks/useWatchlist.ts`**

```typescript
'use client'
import { useLiveQuery } from 'dexie-react-hooks'
import type { WatchlistItem, WatchStatus, MediaType } from '@mywatch/core'
import { getOrCreateDeviceId } from '@mywatch/sync'
import { db } from '@/lib/db'

const deviceStorage = {
  get: () => (typeof window !== 'undefined' ? localStorage.getItem('mywatch-device-id') : null),
  set: (id: string) => localStorage.setItem('mywatch-device-id', id),
}

export function getLocalDeviceId(): string {
  return getOrCreateDeviceId(deviceStorage)
}

export interface WatchlistFilters {
  status?: WatchStatus | 'all'
  mediaType?: MediaType | 'all'
}

export function useWatchlistItems(filters?: WatchlistFilters) {
  return useLiveQuery(async () => {
    let items = await db.watchlistItems.filter((i) => i.deletedAt === null).toArray()
    if (filters?.status && filters.status !== 'all') {
      items = items.filter((i) => i.status === filters.status)
    }
    if (filters?.mediaType && filters.mediaType !== 'all') {
      items = items.filter((i) => i.mediaType === filters.mediaType)
    }
    return items
  }, [filters?.status, filters?.mediaType])
}

export function useWatchlistItem(tmdbId: number, mediaType: MediaType) {
  return useLiveQuery(
    () =>
      db.watchlistItems
        .filter((i) => i.tmdbId === tmdbId && i.mediaType === mediaType && i.deletedAt === null)
        .first(),
    [tmdbId, mediaType],
  )
}

export function useUpsertItem() {
  return async (item: Omit<WatchlistItem, 'updatedAt' | 'deviceId'>) => {
    const now = new Date().toISOString()
    const full: WatchlistItem = { ...item, updatedAt: now, deviceId: getLocalDeviceId() }
    await db.watchlistItems.put(full)
    await db.pendingPushes.add({ itemId: item.id, queuedAt: now })
  }
}

export function useSoftDeleteItem() {
  return async (id: string) => {
    const now = new Date().toISOString()
    await db.watchlistItems.where('id').equals(id).modify({
      deletedAt: now,
      updatedAt: now,
      deviceId: getLocalDeviceId(),
    })
    await db.pendingPushes.add({ itemId: id, queuedAt: now })
  }
}
```

- [ ] **Step 6: Create `src/hooks/useSync.ts`**

```typescript
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
        await pushPendingItems(session.apiToken)
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
```

- [ ] **Step 7: Create `src/hooks/useMediaMeta.ts`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import type { MediaCache, MediaType } from '@mywatch/core'
import { TmdbClient, normalizeMovie, normalizeTv, isStale } from '@mywatch/tmdb'
import type { TmdbMovieDetail, TmdbTvDetail } from '@mywatch/tmdb'
import { db } from '@/lib/db'

function getClient() {
  return new TmdbClient({ apiKey: process.env.NEXT_PUBLIC_TMDB_API_KEY ?? '' })
}

export function useMediaMeta(tmdbId: number, mediaType: MediaType) {
  const [meta, setMeta] = useState<MediaCache | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await db.mediaCache.get([tmdbId, mediaType])
      if (cached && !isStale(cached)) {
        if (!cancelled) setMeta(cached)
        return
      }
      try {
        const client = getClient()
        const detail =
          mediaType === 'movie'
            ? await client.getMovie(tmdbId)
            : await client.getTv(tmdbId)
        const normalized =
          mediaType === 'movie'
            ? normalizeMovie(detail as TmdbMovieDetail)
            : normalizeTv(detail as TmdbTvDetail)
        await db.mediaCache.put(normalized)
        if (!cancelled) setMeta(normalized)
      } catch {
        if (cached && !cancelled) setMeta(cached)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tmdbId, mediaType])

  return meta
}
```

- [ ] **Step 8: Run full test suite**

```bash
pnpm test
```

Expected: all 3 suites pass (api-client, db, sync).

- [ ] **Step 9: Verify TypeScript compiles**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/sync.ts apps/web/src/hooks/ apps/web/tests/sync.test.ts
git commit -m "feat(web): add sync engine, useWatchlist, useSync, and useMediaMeta hooks"
```

---

## Task 6: My List Page

**Files:**
- Create: `apps/web/src/components/StatusBadge.tsx`
- Create: `apps/web/src/components/WatchlistItemCard.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Create `src/components/StatusBadge.tsx`**

```tsx
import type { WatchStatus } from '@mywatch/core'

const labels: Record<WatchStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  watched: 'Watched',
  quit: 'Quit',
}

const colors: Record<WatchStatus, string> = {
  planned: 'bg-blue-500/20 text-blue-300',
  in_progress: 'bg-yellow-500/20 text-yellow-300',
  watched: 'bg-green-500/20 text-green-300',
  quit: 'bg-red-500/20 text-red-300',
}

export function StatusBadge({ status }: { status: WatchStatus }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  )
}
```

- [ ] **Step 2: Create `src/components/WatchlistItemCard.tsx`**

```tsx
'use client'
import Link from 'next/link'
import type { WatchlistItem } from '@mywatch/core'
import { StatusBadge } from './StatusBadge'
import { useMediaMeta } from '@/hooks/useMediaMeta'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w92'

export function WatchlistItemCard({ item }: { item: WatchlistItem }) {
  const meta = useMediaMeta(item.tmdbId, item.mediaType)

  return (
    <Link href={`/media/${item.mediaType}/${item.tmdbId}`}>
      <div className="flex gap-3 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition cursor-pointer">
        <div className="flex-shrink-0 w-12 h-[72px] rounded overflow-hidden bg-zinc-700">
          {meta?.posterPath && (
            <img
              src={`${TMDB_IMG}${meta.posterPath}`}
              alt={meta.title}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <p className="font-medium text-sm truncate">{meta?.title ?? `#${item.tmdbId}`}</p>
          <div className="mt-1">
            <StatusBadge status={item.status} />
          </div>
          {item.mediaType === 'tv' && item.progressSeason != null && (
            <p className="text-xs text-zinc-400 mt-0.5">
              S{item.progressSeason} · E{item.progressEpisode ?? '?'}
            </p>
          )}
          {item.rating != null && (
            <p className="text-xs text-zinc-400 mt-0.5">★ {item.rating}/10</p>
          )}
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Replace `src/app/page.tsx` with My List implementation**

```tsx
'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import type { WatchStatus, MediaType } from '@mywatch/core'
import { useWatchlistItems } from '@/hooks/useWatchlist'
import { useSync } from '@/hooks/useSync'
import { WatchlistItemCard } from '@/components/WatchlistItemCard'

const STATUS_TABS: Array<WatchStatus | 'all'> = ['all', 'planned', 'in_progress', 'watched', 'quit']
const STATUS_LABELS: Record<WatchStatus | 'all', string> = {
  all: 'All',
  planned: 'Planned',
  in_progress: 'In Progress',
  watched: 'Watched',
  quit: 'Quit',
}

type SortOption = 'recently_updated' | 'rating'

export default function HomePage() {
  const { data: session } = useSession()
  const [statusFilter, setStatusFilter] = useState<WatchStatus | 'all'>('all')
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaType | 'all'>('all')
  const [sort, setSort] = useState<SortOption>('recently_updated')
  const items = useWatchlistItems({ status: statusFilter, mediaType: mediaTypeFilter })
  const { syncing, lastSyncedAt, sync } = useSync()

  const sorted = [...(items ?? [])].sort((a, b) => {
    if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    return b.updatedAt.localeCompare(a.updatedAt)
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My List</h1>
        <nav className="flex gap-3 text-sm text-zinc-400">
          <Link href="/search" className="hover:text-zinc-200">Search</Link>
          <Link href="/discover" className="hover:text-zinc-200">Discover</Link>
          <Link href="/profile" className="hover:text-zinc-200">
            {session?.user?.name ?? 'Profile'}
          </Link>
        </nav>
      </header>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition ${
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <select
          value={mediaTypeFilter}
          onChange={(e) => setMediaTypeFilter(e.target.value as MediaType | 'all')}
          className="bg-zinc-800 text-sm rounded px-2 py-1 border border-zinc-700"
        >
          <option value="all">All types</option>
          <option value="movie">Movies</option>
          <option value="tv">TV Shows</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="bg-zinc-800 text-sm rounded px-2 py-1 border border-zinc-700"
        >
          <option value="recently_updated">Recently Updated</option>
          <option value="rating">Rating</option>
        </select>
        {session && (
          <button
            onClick={() => sync()}
            disabled={syncing}
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            {syncing
              ? 'Syncing…'
              : lastSyncedAt
                ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}`
                : 'Sync'}
          </button>
        )}
      </div>

      {items === undefined ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 space-y-2">
          <p>Nothing here yet.</p>
          <Link href="/search" className="text-indigo-400 hover:text-indigo-300 text-sm block">
            Search for something to watch →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <WatchlistItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/StatusBadge.tsx apps/web/src/components/WatchlistItemCard.tsx \
  apps/web/src/app/page.tsx
git commit -m "feat(web): add My List home screen with status/type filters and sort"
```

---

## Task 7: Search Page

**Files:**
- Create: `apps/web/src/components/MediaCard.tsx`
- Create: `apps/web/src/components/StatusPicker.tsx`
- Create: `apps/web/src/app/search/page.tsx`

- [ ] **Step 1: Create `src/components/MediaCard.tsx`**

```tsx
'use client'
import Link from 'next/link'
import type { TmdbSearchResult } from '@mywatch/tmdb'
import type { WatchStatus } from '@mywatch/core'
import { StatusBadge } from './StatusBadge'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w154'

interface Props {
  result: TmdbSearchResult
  existingStatus?: WatchStatus
  onAdd: (result: TmdbSearchResult) => void
}

export function MediaCard({ result, existingStatus, onAdd }: Props) {
  const title = result.media_type === 'movie' ? result.title : result.name
  const year =
    result.media_type === 'movie'
      ? result.release_date?.slice(0, 4)
      : result.first_air_date?.slice(0, 4)

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-zinc-800">
      <Link href={`/media/${result.media_type}/${result.id}`} className="flex-shrink-0">
        <div className="w-12 h-[72px] rounded overflow-hidden bg-zinc-700">
          {result.poster_path && (
            <img
              src={`${TMDB_IMG}${result.poster_path}`}
              alt={title}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/media/${result.media_type}/${result.id}`}>
          <p className="font-medium text-sm truncate hover:text-indigo-300">{title}</p>
        </Link>
        <p className="text-xs text-zinc-400 mt-0.5">
          {year} · {result.media_type === 'movie' ? 'Movie' : 'TV'} · ★{' '}
          {result.vote_average.toFixed(1)}
        </p>
        <div className="mt-2">
          {existingStatus ? (
            <StatusBadge status={existingStatus} />
          ) : (
            <button
              onClick={() => onAdd(result)}
              className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500"
            >
              + Add
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/StatusPicker.tsx`**

```tsx
'use client'
import type { WatchStatus } from '@mywatch/core'

const STATUSES: WatchStatus[] = ['planned', 'in_progress', 'watched', 'quit']
const LABELS: Record<WatchStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  watched: 'Watched',
  quit: 'Quit',
}

interface Props {
  onSelect: (status: WatchStatus) => void
  onCancel: () => void
}

export function StatusPicker({ onSelect, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
      <div className="bg-zinc-800 rounded-xl w-full max-w-sm p-4 space-y-2">
        <p className="text-sm text-zinc-400 text-center mb-3">Add to list as…</p>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="w-full py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm font-medium"
          >
            {LABELS[s]}
          </button>
        ))}
        <button
          onClick={onCancel}
          className="w-full py-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/search/page.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import type { MediaType, WatchStatus } from '@mywatch/core'
import type { TmdbSearchResult } from '@mywatch/tmdb'
import { TmdbClient } from '@mywatch/tmdb'
import { useWatchlistItem, useUpsertItem, getLocalDeviceId } from '@/hooks/useWatchlist'
import { MediaCard } from '@/components/MediaCard'
import { StatusPicker } from '@/components/StatusPicker'

function useTmdbSearch(query: string, mediaType: MediaType | 'all') {
  const [results, setResults] = useState<TmdbSearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const client = new TmdbClient({ apiKey: process.env.NEXT_PUBLIC_TMDB_API_KEY ?? '' })
        const res = await client.search(query, mediaType === 'all' ? undefined : mediaType)
        setResults(res)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, mediaType])

  return { results, loading }
}

function SearchResult({
  result,
  onAdd,
}: {
  result: TmdbSearchResult
  onAdd: (r: TmdbSearchResult) => void
}) {
  const existing = useWatchlistItem(result.id, result.media_type)
  return <MediaCard result={result} existingStatus={existing?.status} onAdd={onAdd} />
}

export default function SearchPage() {
  const { data: session } = useSession()
  const [query, setQuery] = useState('')
  const [mediaType, setMediaType] = useState<MediaType | 'all'>('all')
  const [pending, setPending] = useState<TmdbSearchResult | null>(null)
  const { results, loading } = useTmdbSearch(query, mediaType)
  const upsert = useUpsertItem()

  async function handleAdd(result: TmdbSearchResult, status: WatchStatus) {
    const now = new Date().toISOString()
    await upsert({
      id: uuidv4(),
      userId: session?.user?.id ?? getLocalDeviceId(),
      tmdbId: result.id,
      mediaType: result.media_type,
      status,
      progressEpisode: null,
      progressSeason: null,
      rating: null,
      notes: null,
      addedAt: now,
      startedAt: status === 'in_progress' ? now : null,
      finishedAt: status === 'watched' ? now : null,
      quitAt: status === 'quit' ? now : null,
      deletedAt: null,
    })
    setPending(null)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
          ← Back
        </Link>
        <h1 className="text-xl font-bold">Search</h1>
      </header>

      <div className="flex gap-2">
        <input
          autoFocus
          type="search"
          placeholder="Search movies and TV shows…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500 text-sm"
        />
        <select
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value as MediaType | 'all')}
          className="bg-zinc-800 text-sm rounded px-2 border border-zinc-700"
        >
          <option value="all">All</option>
          <option value="movie">Movies</option>
          <option value="tv">TV</option>
        </select>
      </div>

      {loading && <p className="text-zinc-500 text-sm">Searching…</p>}

      <div className="space-y-2">
        {results.map((r) => (
          <SearchResult key={`${r.media_type}-${r.id}`} result={r} onAdd={setPending} />
        ))}
      </div>

      {pending && (
        <StatusPicker
          onSelect={(status) => handleAdd(pending, status)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/MediaCard.tsx apps/web/src/components/StatusPicker.tsx \
  apps/web/src/app/search/
git commit -m "feat(web): add Search page with TMDB search, MediaCard, and StatusPicker"
```

---

## Task 8: Media Detail Page

**Files:**
- Create: `apps/web/src/components/ProgressTracker.tsx`
- Create: `apps/web/src/app/media/[type]/[id]/page.tsx`

- [ ] **Step 1: Create `src/components/ProgressTracker.tsx`**

```tsx
'use client'

interface Props {
  season: number | null
  episode: number | null
  onChange: (season: number | null, episode: number | null) => void
}

export function ProgressTracker({ season, episode, onChange }: Props) {
  return (
    <div className="flex gap-4 items-center">
      <div className="flex items-center gap-2">
        <label className="text-sm text-zinc-400">Season</label>
        <input
          type="number"
          min={1}
          value={season ?? ''}
          onChange={(e) =>
            onChange(e.target.value ? parseInt(e.target.value, 10) : null, episode)
          }
          placeholder="–"
          className="w-16 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-sm text-center"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-zinc-400">Episode</label>
        <input
          type="number"
          min={1}
          value={episode ?? ''}
          onChange={(e) =>
            onChange(season, e.target.value ? parseInt(e.target.value, 10) : null)
          }
          placeholder="–"
          className="w-16 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-sm text-center"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/media/[type]/[id]/page.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import type { MediaType, WatchStatus } from '@mywatch/core'
import { useWatchlistItem, useUpsertItem, useSoftDeleteItem, getLocalDeviceId } from '@/hooks/useWatchlist'
import { useMediaMeta } from '@/hooks/useMediaMeta'
import { StatusBadge } from '@/components/StatusBadge'
import { ProgressTracker } from '@/components/ProgressTracker'

const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w780'
const TMDB_POSTER = 'https://image.tmdb.org/t/p/w342'
const STATUSES: WatchStatus[] = ['planned', 'in_progress', 'watched', 'quit']
const STATUS_LABELS: Record<WatchStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  watched: 'Watched',
  quit: 'Quit',
}

export default function MediaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const mediaType = params.type as MediaType
  const tmdbId = parseInt(params.id as string, 10)

  const meta = useMediaMeta(tmdbId, mediaType)
  const existingItem = useWatchlistItem(tmdbId, mediaType)
  const upsert = useUpsertItem()
  const softDelete = useSoftDeleteItem()

  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [season, setSeason] = useState<number | null>(null)
  const [episode, setEpisode] = useState<number | null>(null)

  useEffect(() => {
    if (existingItem) {
      setRating(existingItem.rating)
      setNotes(existingItem.notes ?? '')
      setSeason(existingItem.progressSeason)
      setEpisode(existingItem.progressEpisode)
    }
  }, [existingItem?.id])

  async function handleStatusChange(status: WatchStatus) {
    const now = new Date().toISOString()
    await upsert({
      id: existingItem?.id ?? uuidv4(),
      userId: existingItem?.userId ?? (session?.user?.id ?? getLocalDeviceId()),
      tmdbId,
      mediaType,
      status,
      progressSeason: season,
      progressEpisode: episode,
      rating,
      notes: notes || null,
      addedAt: existingItem?.addedAt ?? now,
      startedAt: existingItem?.startedAt ?? (status === 'in_progress' ? now : null),
      finishedAt: existingItem?.finishedAt ?? (status === 'watched' ? now : null),
      quitAt: existingItem?.quitAt ?? (status === 'quit' ? now : null),
      deletedAt: null,
    })
  }

  async function handleSave() {
    if (!existingItem) return
    await upsert({
      ...existingItem,
      rating,
      notes: notes || null,
      progressSeason: season,
      progressEpisode: episode,
    })
  }

  async function handleRemove() {
    if (!existingItem) return
    await softDelete(existingItem.id)
    router.push('/')
  }

  return (
    <div className="max-w-2xl mx-auto">
      {meta?.backdropPath && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={`${TMDB_BACKDROP}${meta.backdropPath}`}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900" />
        </div>
      )}

      <div className="px-4 py-6 space-y-5">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
          ← Back
        </Link>

        <div className="flex gap-4">
          {meta?.posterPath && (
            <img
              src={`${TMDB_POSTER}${meta.posterPath}`}
              alt=""
              className="w-24 rounded-lg flex-shrink-0 self-start"
            />
          )}
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-bold">{meta?.title ?? `#${tmdbId}`}</h1>
            <p className="text-sm text-zinc-400">
              {mediaType === 'tv' ? 'TV Show' : 'Movie'}
              {meta?.releaseDate ? ` · ${meta.releaseDate.slice(0, 4)}` : ''}
              {meta?.runtime ? ` · ${meta.runtime} min` : ''}
              {meta?.seasonsCount ? ` · ${meta.seasonsCount} seasons` : ''}
            </p>
            {meta?.genres && meta.genres.length > 0 && (
              <p className="text-xs text-zinc-500">{meta.genres.map((g) => g.name).join(', ')}</p>
            )}
            <p className="text-sm text-zinc-300">
              ★ {meta?.voteAverage.toFixed(1)} ({meta?.voteCount.toLocaleString()} votes)
            </p>
          </div>
        </div>

        {meta?.overview && (
          <p className="text-sm text-zinc-300 leading-relaxed">{meta.overview}</p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-400">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  existingItem?.status === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {mediaType === 'tv' && existingItem?.status === 'in_progress' && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-400">Progress</p>
            <ProgressTracker
              season={season}
              episode={episode}
              onChange={(s, e) => {
                setSeason(s)
                setEpisode(e)
              }}
            />
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-400">Your Rating</p>
          <div className="flex gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setRating(rating === n ? null : n)}
                className={`w-7 h-7 rounded text-sm font-medium transition ${
                  rating != null && n <= rating
                    ? 'bg-yellow-500 text-zinc-900'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-400">Notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Your thoughts…"
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500 resize-none"
          />
        </div>

        {existingItem && (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
            >
              Save
            </button>
            <button
              onClick={handleRemove}
              className="py-2 px-4 rounded bg-zinc-800 hover:bg-red-900/50 text-sm text-red-400"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ProgressTracker.tsx apps/web/src/app/media/
git commit -m "feat(web): add Media Detail page with status, progress, rating, and notes"
```

---

## Task 9: Discover Page

**Files:**
- Create: `apps/web/src/app/discover/page.tsx`

- [ ] **Step 1: Create `src/app/discover/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import type { TmdbSearchResult } from '@mywatch/tmdb'
import { TmdbClient } from '@mywatch/tmdb'
import type { WatchStatus, MediaType } from '@mywatch/core'
import { useWatchlistItem, useUpsertItem, getLocalDeviceId } from '@/hooks/useWatchlist'
import { MediaCard } from '@/components/MediaCard'
import { StatusPicker } from '@/components/StatusPicker'
import { db } from '@/lib/db'

function getClient() {
  return new TmdbClient({ apiKey: process.env.NEXT_PUBLIC_TMDB_API_KEY ?? '' })
}

function DiscoverCard({
  result,
  onAdd,
}: {
  result: TmdbSearchResult
  onAdd: (r: TmdbSearchResult) => void
}) {
  const existing = useWatchlistItem(result.id, result.media_type)
  return <MediaCard result={result} existingStatus={existing?.status} onAdd={onAdd} />
}

function Row({
  title,
  results,
  onAdd,
}: {
  title: string
  results: TmdbSearchResult[]
  onAdd: (r: TmdbSearchResult) => void
}) {
  if (results.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2">
        {results.slice(0, 5).map((r) => (
          <DiscoverCard key={`${r.media_type}-${r.id}`} result={r} onAdd={onAdd} />
        ))}
      </div>
    </section>
  )
}

export default function DiscoverPage() {
  const { data: session } = useSession()
  const [trending, setTrending] = useState<TmdbSearchResult[]>([])
  const [topRated, setTopRated] = useState<TmdbSearchResult[]>([])
  const [recommendations, setRecommendations] = useState<TmdbSearchResult[]>([])
  const [pending, setPending] = useState<TmdbSearchResult | null>(null)
  const upsert = useUpsertItem()

  const recentActive = useLiveQuery(() =>
    db.watchlistItems
      .filter(
        (i) =>
          (i.status === 'in_progress' || i.status === 'watched') && i.deletedAt === null,
      )
      .reverse()
      .limit(3)
      .toArray(),
  )

  useEffect(() => {
    const client = getClient()
    client.getTrending('week').then(setTrending).catch(() => {})
    client.getTopRated('movie').then(setTopRated).catch(() => {})
  }, [])

  useEffect(() => {
    if (!recentActive?.length) return
    const source = recentActive[0]
    const client = getClient()
    client
      .getRecommendations(source.tmdbId, source.mediaType as MediaType)
      .then(setRecommendations)
      .catch(() => {})
  }, [recentActive?.length])

  async function handleAdd(result: TmdbSearchResult, status: WatchStatus) {
    const now = new Date().toISOString()
    await upsert({
      id: uuidv4(),
      userId: session?.user?.id ?? getLocalDeviceId(),
      tmdbId: result.id,
      mediaType: result.media_type,
      status,
      progressSeason: null,
      progressEpisode: null,
      rating: null,
      notes: null,
      addedAt: now,
      startedAt: status === 'in_progress' ? now : null,
      finishedAt: status === 'watched' ? now : null,
      quitAt: status === 'quit' ? now : null,
      deletedAt: null,
    })
    setPending(null)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
          ← Back
        </Link>
        <h1 className="text-xl font-bold">Discover</h1>
      </header>

      <Row title="Trending This Week" results={trending} onAdd={setPending} />
      {recommendations.length > 0 && (
        <Row title="Because You Watched…" results={recommendations} onAdd={setPending} />
      )}
      <Row title="Top Rated Movies" results={topRated} onAdd={setPending} />

      {pending && (
        <StatusPicker
          onSelect={(status) => handleAdd(pending, status)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/discover/
git commit -m "feat(web): add Discover page with trending, personalized recs, and top rated"
```

---

## Task 10: Profile / Settings Page

**Files:**
- Create: `apps/web/src/app/profile/page.tsx`

- [ ] **Step 1: Create `src/app/profile/page.tsx`**

```tsx
'use client'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSync } from '@/hooks/useSync'
import { db } from '@/lib/db'

export default function ProfilePage() {
  const { data: session } = useSession()
  const { syncing, lastSyncedAt, error, sync } = useSync()
  const [darkMode, setDarkMode] = useState(true)

  const pendingCount = useLiveQuery(() => db.pendingPushes.count())
  const itemCount = useLiveQuery(() =>
    db.watchlistItems.filter((i) => i.deletedAt === null).count(),
  )

  useEffect(() => {
    const stored = localStorage.getItem('mywatch-dark-mode')
    if (stored !== null) setDarkMode(stored !== 'false')
  }, [])

  function toggleDarkMode() {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('mywatch-dark-mode', String(next))
    document.documentElement.classList.toggle('dark', next)
  }

  async function handleClearCache() {
    await db.mediaCache.clear()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
          ← Back
        </Link>
        <h1 className="text-xl font-bold">Profile</h1>
      </header>

      <section className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Account</h2>
        {session ? (
          <>
            <div>
              <p className="font-medium">{session.user?.name}</p>
              <p className="text-sm text-zinc-400">{session.user?.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="w-full py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-sm text-red-400"
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="block w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm text-center font-medium"
          >
            Sign In to Sync
          </Link>
        )}
      </section>

      <section className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Sync</h2>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Items in list</span>
          <span>{itemCount ?? '–'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Pending changes</span>
          <span>{pendingCount ?? '–'}</span>
        </div>
        {lastSyncedAt && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Last synced</span>
            <span>{new Date(lastSyncedAt).toLocaleString()}</span>
          </div>
        )}
        {error && <p className="text-red-400 text-xs">{error}</p>}
        {session ? (
          <button
            onClick={() => sync()}
            disabled={syncing}
            className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium"
          >
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        ) : (
          <p className="text-xs text-zinc-500">Sign in to enable sync.</p>
        )}
      </section>

      <section className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Appearance
        </h2>
        <div className="flex items-center justify-between">
          <span className="text-sm">Dark Mode</span>
          <button
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className={`w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-zinc-600'}`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${
                darkMode ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      <section className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Data</h2>
        <button
          onClick={handleClearCache}
          className="w-full py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-sm text-zinc-300"
        >
          Clear Media Cache
        </button>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Run full monorepo test suite from repo root**

```bash
pnpm test
```

Expected: all packages pass — core, tmdb, sync, api, web.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/profile/
git commit -m "feat(web): add Profile page with sync status, auth, dark mode, and cache clear"
```

---

## Self-Review Checklist

After writing this plan, checked it against the spec:

**Spec coverage:**
- ✅ My List: status filter tabs, type filter, sort (recently updated, rating), list view with poster/title/status/progress
- ✅ Search: real-time TMDB, filter All/Movies/TV, inline add → status picker, existing items show status badge
- ✅ Media Detail: backdrop, poster, title/year/runtime/seasons/genres/TMDB score, overview, status selector, TV progress (season+episode when In Progress), rating 1–10, notes, remove
- ✅ Discover: Trending This Week, personalized recommendations (from recent In Progress/Watched), Top Rated
- ✅ Profile/Settings: account info, sign out, sync status + manual trigger, dark mode toggle, clear media cache
- ✅ Auth: email/password (Credentials), Google OAuth, Apple Sign-In
- ✅ Local-first: Dexie IndexedDB as source of truth for UI
- ✅ Sync: push on every write (pendingPushes queue), pull on manual trigger / sign-in
- ✅ Soft deletes: `deletedAt` propagated via sync
- ✅ Guest mode: no forced auth on home/search/discover/media pages; userId falls back to local device ID
- ✅ TMDB metadata with local cache + 7-day staleness check
- ⚠️ Title A–Z sort: requires joining watchlist items with mediaCache. Omitted from initial sort options — can be added in a future task once mediaCache is reliably populated.
- ⚠️ Genre filter: requires denormalized genres in watchlist items or mediaCache join. Omitted — future task.
- ⚠️ Guest → account migration (local items re-assigned on login): out of scope for Plan 3.

**No placeholders** — all steps contain complete, runnable code.

**Type consistency verified:**
- `TmdbClient({ apiKey, baseUrl? })` used correctly throughout (never bare string)
- `db.mediaCache.get([tmdbId, mediaType])` compound key used correctly
- `getLocalDeviceId()` exported from `useWatchlist.ts` and imported in search/discover/detail pages
- `useWatchlistItem(tmdbId, mediaType)` signature consistent across all callers
- `normalizeMovie` / `normalizeTv` return `MediaCache` — matched by `db.mediaCache.put()`
