# Feedback, Settings Reactivity, Genres Wrap & Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add toast feedback for all async operations, fix TMDB key reactivity in media cards, allow genres to wrap to multiple rows, and add a token-based password reset flow.

**Architecture:** Toast system is a React context wrapping the app root; feedback fires at call sites (components/hooks). `useMediaMeta` gains a `tmdbApiKey` param so key changes trigger re-fetches. Password reset uses a new DB table + two API routes + two frontend pages.

**Tech Stack:** Next.js 14 App Router, React context, Fastify, postgres.js, TypeScript

---

## File Map

### New files
- `apps/web/src/components/Toast.tsx` — ToastProvider, ToastItem, ToastContainer
- `apps/web/src/app/auth/forgot-password/page.tsx` — email input → shows reset link
- `apps/web/src/app/auth/reset-password/page.tsx` — token from query param → new password form
- `apps/api/src/db/migrations/004_password_reset.sql` — password_reset_tokens table

### Modified files
- `apps/web/src/app/layout.tsx` — wrap children in ToastProvider
- `apps/web/src/hooks/useSync.ts` — fire toasts on success/fail
- `apps/web/src/hooks/useMediaMeta.ts` — accept tmdbApiKey param, add to effect deps
- `apps/web/src/components/WatchlistItemCard.tsx` — pass tmdbApiKey, remove genres slice
- `apps/web/src/components/GridItemCard.tsx` — pass tmdbApiKey
- `apps/web/src/app/media/[type]/[id]/page.tsx` — pass tmdbApiKey
- `apps/web/src/app/profile/page.tsx` — fire toasts, remove tmdbKeySaved state
- `apps/web/src/app/auth/login/page.tsx` — add "Forgot password?" link
- `apps/web/src/lib/api-client.ts` — add forgotPassword + resetPassword
- `apps/api/src/routes/auth.ts` — add forgot-password + reset-password routes
- `apps/api/src/repos/user-repo.ts` — add createResetToken, findResetToken, updatePassword, markResetTokenUsed

---

## Task 1: Toast Component

**Files:**
- Create: `apps/web/src/components/Toast.tsx`

- [ ] **Step 1: Create the Toast component file**

```tsx
// apps/web/src/components/Toast.tsx
'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

type ToastCtx = {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void
}

const Ctx = createContext<ToastCtx>({ toast: () => {} })

export function useToast() {
  return useContext(Ctx)
}

const VARIANT_STYLES: Record<ToastVariant, { background: string; color: string }> = {
  success: { background: 'var(--green)', color: '#fff' },
  error: { background: 'var(--red)', color: '#fff' },
  info: { background: 'var(--surface2)', color: 'var(--fg)' },
}

function ToastBubble({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    if (item.duration === 0) return
    const t = setTimeout(() => onDismiss(item.id), item.duration)
    return () => clearTimeout(t)
  }, [item.id, item.duration, onDismiss])

  return (
    <div
      style={{
        ...VARIANT_STYLES[item.variant],
        padding: '8px 14px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,.4)',
        pointerEvents: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {item.message}
      {item.duration === 0 && (
        <button
          onClick={() => onDismiss(item.id)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'success', duration?: number) => {
      const id = Math.random().toString(36).slice(2)
      const defaultDuration = variant === 'error' ? 0 : 3000
      setToasts((prev) => [...prev.slice(-2), { id, message, variant, duration: duration ?? defaultDuration }])
    },
    [],
  )

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => (
            <ToastBubble key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </Ctx.Provider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/Toast.tsx
git commit -m "feat: add ToastProvider and useToast hook"
```

---

## Task 2: Wire ToastProvider into Layout

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Add ToastProvider import and wrap children**

Replace the entire file content:

```tsx
// apps/web/src/app/layout.tsx
import type { Metadata } from 'next'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import { SettingsProvider } from '@/hooks/useSettings'
import { ToastProvider } from '@/components/Toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'myWatch',
  description: 'Your media watchlist',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
        <SessionProvider session={session}>
          <SettingsProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </SettingsProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat: add ToastProvider to root layout"
```

---

## Task 3: Wire Toast to Sync Hook

**Files:**
- Modify: `apps/web/src/hooks/useSync.ts`

- [ ] **Step 1: Update useSync to fire toasts**

Replace the entire file:

```ts
// apps/web/src/hooks/useSync.ts
'use client'
import { useState, useCallback } from 'react'
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
        toast('Synced', 'success')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed'
        setState((s) => ({ ...s, syncing: false, error: message }))
        toast(message, 'error')
      }
    },
    [session?.apiToken, toast],
  )

  return { ...state, sync }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useSync.ts
git commit -m "feat: toast feedback on sync success and failure"
```

---

## Task 4: Wire Toast to Profile Page Operations

**Files:**
- Modify: `apps/web/src/app/profile/page.tsx`

- [ ] **Step 1: Update profile page**

Replace the entire file:

```tsx
// apps/web/src/app/profile/page.tsx
'use client'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSync } from '@/hooks/useSync'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/components/Toast'
import type { CardMetaSettings } from '@/hooks/useSettings'
import { db } from '@/lib/db'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-[10px] overflow-hidden"
      style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}
    >
      <div
        className="px-4 py-2"
        style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}
      >
        <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
          {title}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border2)' }}>
        {children}
      </div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <span className="text-[13px]" style={{ color: 'var(--fg2)' }}>{label}</span>
      {children}
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label="toggle"
      className="flex-shrink-0 relative transition-colors duration-150"
      style={{
        width: 40,
        height: 22,
        borderRadius: 'var(--pill)',
        background: on ? 'var(--accent)' : 'var(--border)',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <span
        className="absolute top-[2px] transition-transform duration-150"
        style={{
          left: 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          display: 'block',
          transform: on ? 'translateX(18px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        }}
      />
    </button>
  )
}

const CARD_META_LABELS: Record<keyof CardMetaSettings, string> = {
  showGenres: 'Genres',
  showTmdbRating: 'TMDB Rating',
  showRuntime: 'Runtime',
  showProviders: 'Streaming Providers',
  showOverview: 'Plot Overview',
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { syncing, lastSyncedAt, error, sync } = useSync()
  const { settings, update, updateCardMeta } = useSettings()
  const { toast } = useToast()
  const [tmdbKeyInput, setTmdbKeyInput] = useState('')

  const pendingCount = useLiveQuery(() => db.pendingPushes.count())
  const itemCount = useLiveQuery(() =>
    db.watchlistItems.filter((i) => i.deletedAt === null).count(),
  )

  useEffect(() => {
    setTmdbKeyInput(settings.tmdbApiKey)
  }, [settings.tmdbApiKey])

  function saveTmdbKey() {
    update({ tmdbApiKey: tmdbKeyInput.trim() })
    toast('API key saved', 'success')
  }

  async function handleClearCache() {
    await db.mediaCache.clear()
    toast('Cache cleared', 'success')
  }

  return (
    <div style={{ maxWidth: 620, width: '100%', padding: '0 0 80px', margin: '0 auto' }}>
      {/* Header */}
      <header
        className="flex items-center gap-[10px]"
        style={{ padding: '18px 20px 14px', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 20 }}
      >
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          Settings
        </h1>
      </header>

      <div className="flex flex-col gap-4 px-5">
        {/* Account */}
        <Section title="Account">
          {session ? (
            <>
              <Row label={session.user?.name ?? 'User'}>
                <span className="text-[12px]" style={{ color: 'var(--muted2)' }}>{session.user?.email}</span>
              </Row>
              <div className="px-4 py-3">
                <button
                  onClick={() => signOut({ callbackUrl: '/auth/login' })}
                  className="w-full py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none transition-all duration-100"
                  style={{ background: 'rgba(248,113,113,.12)', color: 'var(--red)' }}
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <div className="px-4 py-3">
              <button
                onClick={() => router.push('/auth/login')}
                className="w-full py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Sign In to Sync
              </button>
            </div>
          )}
        </Section>

        {/* Sync */}
        <Section title="Sync">
          <Row label="Items in list">
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--muted2)' }}>{itemCount ?? '–'}</span>
          </Row>
          <Row label="Pending changes">
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--muted2)' }}>{pendingCount ?? '–'}</span>
          </Row>
          {lastSyncedAt && (
            <Row label="Last synced">
              <span className="text-[12px]" style={{ color: 'var(--muted2)' }}>
                {new Date(lastSyncedAt).toLocaleString()}
              </span>
            </Row>
          )}
          {error && (
            <div className="px-4 py-2 text-[12px]" style={{ color: 'var(--red)' }}>{error}</div>
          )}
          <div className="px-4 py-3">
            {session ? (
              <button
                onClick={() => sync()}
                disabled={syncing}
                className="w-full py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none disabled:opacity-50 transition-all duration-100"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            ) : (
              <p className="text-[12px]" style={{ color: 'var(--muted2)' }}>Sign in to enable sync.</p>
            )}
          </div>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <Row label="Theme">
            <div
              className="flex"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
            >
              {(['dark', 'light'] as const).map((t) => {
                const active = settings.theme === t
                return (
                  <button
                    key={t}
                    onClick={() => update({ theme: t })}
                    className="px-3 py-[4px] text-[12px] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none capitalize"
                    style={{
                      background: active ? 'var(--surface2)' : 'transparent',
                      color: active ? 'var(--fg)' : 'var(--muted)',
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </Row>
        </Section>

        {/* TMDB */}
        <Section title="TMDB API">
          <div className="px-4 py-3 space-y-2">
            <p className="text-[12px]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
              Override the server TMDB key. Stored locally, never sent to the server.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tmdbKeyInput}
                onChange={(e) => setTmdbKeyInput(e.target.value)}
                placeholder="Enter API key…"
                className="flex-1 px-3 py-2 rounded-[6px] text-[13px] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTmdbKey() }}
              />
              <button
                onClick={saveTmdbKey}
                className="px-3 py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none flex-shrink-0 transition-all duration-100"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Save
              </button>
            </div>
          </div>
        </Section>

        {/* Card Display */}
        <Section title="Card Display">
          {(Object.keys(CARD_META_LABELS) as Array<keyof CardMetaSettings>).map((key) => (
            <Row key={key} label={CARD_META_LABELS[key]}>
              <Toggle
                on={settings.cardMeta[key]}
                onToggle={() => {
                  updateCardMeta({ [key]: !settings.cardMeta[key] })
                  toast('Saved', 'success', 1500)
                }}
              />
            </Row>
          ))}
        </Section>

        {/* Data */}
        <Section title="Data">
          <div className="px-4 py-3">
            <button
              onClick={handleClearCache}
              className="w-full py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none transition-all duration-100"
              style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
            >
              Clear Media Cache
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/profile/page.tsx
git commit -m "feat: toast feedback for clear cache, card meta toggles, TMDB key save"
```

---

## Task 5: Fix useMediaMeta Reactivity

**Files:**
- Modify: `apps/web/src/hooks/useMediaMeta.ts`

- [ ] **Step 1: Update useMediaMeta to accept tmdbApiKey param**

Replace the entire file:

```ts
// apps/web/src/hooks/useMediaMeta.ts
'use client'
import { useEffect, useState } from 'react'
import type { MediaCache, MediaType, WatchProvider } from '@mywatch/core'
import { TmdbClient, normalizeMovie, normalizeTv, isStale } from '@mywatch/tmdb'
import type { TmdbMovieDetail, TmdbTvDetail } from '@mywatch/tmdb'
import { db } from '@/lib/db'

const PROVIDERS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function getClient(tmdbApiKey: string) {
  const key = tmdbApiKey || (process.env.NEXT_PUBLIC_TMDB_API_KEY ?? '')
  return new TmdbClient({ apiKey: key })
}

function isProviderStale(cachedAt: string | null): boolean {
  if (!cachedAt) return true
  return Date.now() - new Date(cachedAt).getTime() > PROVIDERS_MAX_AGE_MS
}

async function fetchAndStoreProviders(
  client: TmdbClient,
  tmdbId: number,
  mediaType: MediaType,
  region: string,
): Promise<WatchProvider[]> {
  try {
    const data = await client.getWatchProviders(tmdbId, mediaType, region)
    const regionData = data.results[region]
    const flatrate = regionData?.flatrate ?? []
    const providers: WatchProvider[] = flatrate.map((p) => ({
      providerId: p.provider_id,
      providerName: p.provider_name,
      logoPath: p.logo_path,
      displayPriority: p.display_priority,
    }))
    providers.sort((a, b) => a.displayPriority - b.displayPriority)
    const now = new Date().toISOString()
    await db.mediaCache.where('[tmdbId+mediaType]').equals([tmdbId, mediaType]).modify({
      watchProviders: providers,
      watchProvidersRegion: region,
      watchProvidersCachedAt: now,
    })
    return providers
  } catch {
    return []
  }
}

export function useMediaMeta(tmdbId: number, mediaType: MediaType, tmdbApiKey: string) {
  const [meta, setMeta] = useState<MediaCache | null>(null)

  useEffect(() => {
    let cancelled = false
    const region = navigator.language?.split('-')[1] ?? 'US'
    const client = getClient(tmdbApiKey)

    ;(async () => {
      try {
        const cached = await db.mediaCache.get([tmdbId, mediaType])
        if (cached && !isStale(cached)) {
          if (!cancelled) setMeta(cached)
          if (isProviderStale(cached.watchProvidersCachedAt ?? null)) {
            fetchAndStoreProviders(client, tmdbId, mediaType, region).then((providers) => {
              if (!cancelled) setMeta((prev) => prev ? { ...prev, watchProviders: providers } : prev)
            })
          }
          return
        }
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
        fetchAndStoreProviders(client, tmdbId, mediaType, region).then((providers) => {
          if (!cancelled) setMeta((prev) => prev ? { ...prev, watchProviders: providers } : prev)
        })
      } catch {
        const cached = await db.mediaCache.get([tmdbId, mediaType]).catch(() => undefined)
        if (cached && !cancelled) setMeta(cached)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tmdbId, mediaType, tmdbApiKey])

  return meta
}
```

- [ ] **Step 2: Update WatchlistItemCard call site**

In `apps/web/src/components/WatchlistItemCard.tsx`:

Change line 32 from:
```ts
  const meta = useMediaMeta(item.tmdbId, item.mediaType)
```
to:
```ts
  const { settings } = useSettings()
  const meta = useMediaMeta(item.tmdbId, item.mediaType, settings.tmdbApiKey)
```

Also remove the duplicate `useSettings` call on line 36 — the hook is now called once above. Line 36-37 becomes:
```ts
  const { cardMeta } = settings
```

Also change line 53 from:
```ts
  const genres = meta?.genres?.slice(0, 2) ?? []
```
to:
```ts
  const genres = meta?.genres ?? []
```

- [ ] **Step 3: Update GridItemCard call site**

In `apps/web/src/components/GridItemCard.tsx`:

Add import after existing imports:
```ts
import { useSettings } from '@/hooks/useSettings'
```

Change line 21 from:
```ts
  const meta = useMediaMeta(item.tmdbId, item.mediaType)
```
to:
```ts
  const { settings } = useSettings()
  const meta = useMediaMeta(item.tmdbId, item.mediaType, settings.tmdbApiKey)
```

- [ ] **Step 4: Update media detail page call site**

In `apps/web/src/app/media/[type]/[id]/page.tsx`:

Add import after existing imports:
```ts
import { useSettings } from '@/hooks/useSettings'
```

Add hook call after the `const tmdbId = ...` line (around line 45):
```ts
  const { settings } = useSettings()
```

Change line 46 from:
```ts
  const meta = useMediaMeta(tmdbId, mediaType)
```
to:
```ts
  const meta = useMediaMeta(tmdbId, mediaType, settings.tmdbApiKey)
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useMediaMeta.ts \
        apps/web/src/components/WatchlistItemCard.tsx \
        apps/web/src/components/GridItemCard.tsx \
        "apps/web/src/app/media/[type]/[id]/page.tsx"
git commit -m "fix: useMediaMeta re-fetches when TMDB API key changes; genres wrap to multiple rows"
```

---

## Task 6: DB Migration — Password Reset Tokens

**Files:**
- Create: `apps/api/src/db/migrations/004_password_reset.sql`

- [ ] **Step 1: Create migration file**

```sql
-- apps/api/src/db/migrations/004_password_reset.sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/db/migrations/004_password_reset.sql
git commit -m "feat: add password_reset_tokens migration"
```

---

## Task 7: UserRepo — Password Reset Methods

**Files:**
- Modify: `apps/api/src/repos/user-repo.ts`

- [ ] **Step 1: Add methods to UserRepo interface**

In `apps/api/src/repos/user-repo.ts`, update the `UserRepo` interface (after `findOrCreateOAuth`):

```ts
export interface UserRepo {
  findByEmail(email: string): Promise<UserRecord | null>
  findById(id: string): Promise<UserRecord | null>
  create(data: {
    email: string
    displayName: string
    passwordHash: string
  }): Promise<UserRecord>
  findOrCreateOAuth(data: {
    provider: string
    providerAccountId: string
    email: string | null
    displayName: string
    avatarUrl: string | null
  }): Promise<UserRecord>
  createResetToken(userId: string): Promise<string>
  findResetToken(token: string): Promise<{ token: string; userId: string; expiresAt: string; usedAt: string | null } | null>
  updatePassword(userId: string, passwordHash: string): Promise<void>
  markResetTokenUsed(token: string): Promise<void>
}
```

- [ ] **Step 2: Add method implementations**

In `createUserRepo`, add these four methods inside the returned object (after `findOrCreateOAuth`):

```ts
    async createResetToken(userId) {
      const rows = await sql<{ token: string }[]>`
        INSERT INTO password_reset_tokens (user_id, expires_at)
        VALUES (${userId}, NOW() + INTERVAL '1 hour')
        RETURNING token::text
      `
      return rows[0].token
    },

    async findResetToken(token) {
      const rows = await sql<{
        token: string
        user_id: string
        expires_at: Date
        used_at: Date | null
      }[]>`
        SELECT token::text, user_id, expires_at, used_at
        FROM password_reset_tokens
        WHERE token = ${token}::uuid
        LIMIT 1
      `
      if (!rows[0]) return null
      return {
        token: rows[0].token,
        userId: rows[0].user_id,
        expiresAt: rows[0].expires_at.toISOString(),
        usedAt: rows[0].used_at?.toISOString() ?? null,
      }
    },

    async updatePassword(userId, passwordHash) {
      await sql`
        UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW()
        WHERE id = ${userId}
      `
    },

    async markResetTokenUsed(token) {
      await sql`
        UPDATE password_reset_tokens SET used_at = NOW()
        WHERE token = ${token}::uuid
      `
    },
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/repos/user-repo.ts
git commit -m "feat: add password reset methods to UserRepo"
```

---

## Task 8: API Routes — Forgot Password & Reset Password

**Files:**
- Modify: `apps/api/src/routes/auth.ts`

- [ ] **Step 1: Add forgot-password and reset-password routes**

Add the following two routes inside `registerAuthRoutes`, after the existing `/auth/me` route:

```ts
  interface ForgotPasswordBody { email: string }
  interface ResetPasswordBody { token: string; newPassword: string }

  app.post<{ Body: ForgotPasswordBody }>(
    '/auth/forgot-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        },
      },
    },
    async (req, reply) => {
      const { email } = req.body
      const user = await userRepo.findByEmail(email)
      if (!user || !user.passwordHash) {
        return reply.send({ resetUrl: null })
      }
      const token = await userRepo.createResetToken(user.id)
      return reply.send({ resetUrl: `/auth/reset-password?token=${token}` })
    },
  )

  app.post<{ Body: ResetPasswordBody }>(
    '/auth/reset-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (req, reply) => {
      const { token, newPassword } = req.body
      const record = await userRepo.findResetToken(token)
      if (!record || record.usedAt || new Date(record.expiresAt) < new Date()) {
        return reply.status(400).send({ error: 'Invalid or expired reset token' })
      }
      const passwordHash = await hashPassword(newPassword)
      await userRepo.updatePassword(record.userId, passwordHash)
      await userRepo.markResetTokenUsed(token)
      return reply.send({ ok: true })
    },
  )
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/auth.ts
git commit -m "feat: add forgot-password and reset-password API routes"
```

---

## Task 9: API Client — Forgot Password & Reset Password

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`

- [ ] **Step 1: Add methods to apiClient.auth**

In `apps/web/src/lib/api-client.ts`, add inside `apiClient.auth` after the `oauthApple` method:

```ts
    forgotPassword(email: string) {
      return apiFetch<{ resetUrl: string | null }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
    },
    resetPassword(token: string, newPassword: string) {
      return apiFetch<{ ok: boolean }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
    },
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api-client.ts
git commit -m "feat: add forgotPassword and resetPassword to apiClient"
```

---

## Task 10: Frontend — Forgot Password Page

**Files:**
- Create: `apps/web/src/app/auth/forgot-password/page.tsx`

- [ ] **Step 1: Create forgot-password page**

```tsx
// apps/web/src/app/auth/forgot-password/page.tsx
'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [resetUrl, setResetUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { resetUrl: url } = await apiClient.auth.forgotPassword(email)
      setResetUrl(url)
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!resetUrl) return
    await navigator.clipboard.writeText(window.location.origin + resetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Reset Password</h1>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
            >
              {loading ? 'Generating…' : 'Get Reset Link'}
            </button>
          </form>
        ) : resetUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              Copy this link to reset your password. It expires in 1 hour.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={typeof window !== 'undefined' ? window.location.origin + resetUrl : resetUrl}
                className="flex-1 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded font-medium text-sm flex-shrink-0 transition-colors"
                style={{ background: copied ? 'var(--green)' : 'var(--accent)', color: '#fff' }}
              >
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-zinc-400">
            No account found for that email, or the account uses social login.
          </p>
        )}

        <p className="text-center text-sm text-zinc-400">
          <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300">
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/auth/forgot-password/page.tsx
git commit -m "feat: add forgot-password page"
```

---

## Task 11: Frontend — Reset Password Page

**Files:**
- Create: `apps/web/src/app/auth/reset-password/page.tsx`

- [ ] **Step 1: Create reset-password page**

```tsx
// apps/web/src/app/auth/reset-password/page.tsx
'use client'
import { useState, type FormEvent, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'

function ResetForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!token) {
    return <p className="text-center text-sm text-zinc-400">Invalid reset link.</p>
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-zinc-300">Password updated successfully.</p>
        <Link
          href="/auth/login"
          className="block py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-medium text-white text-center"
        >
          Sign In
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await apiClient.auth.resetPassword(token, newPassword)
      setDone(true)
    } catch {
      setError('Invalid or expired reset link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="password"
        placeholder="New password (min 8 characters)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        minLength={8}
        className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
      >
        {loading ? 'Updating…' : 'Update Password'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">New Password</h1>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
        <p className="text-center text-sm text-zinc-400">
          <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300">
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/auth/reset-password/page.tsx
git commit -m "feat: add reset-password page"
```

---

## Task 12: Login Page — Add Forgot Password Link

**Files:**
- Modify: `apps/web/src/app/auth/login/page.tsx`

- [ ] **Step 1: Add forgot password link**

In `apps/web/src/app/auth/login/page.tsx`, after the password `<input>` (around line 46, before `{error && ...}`), add:

```tsx
          <div className="text-right">
            <Link href="/auth/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-300">
              Forgot password?
            </Link>
          </div>
```

The `Link` import is already present at the top of the file.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/auth/login/page.tsx
git commit -m "feat: add forgot password link to login page"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Toast feedback for sync success/fail → Task 3
- [x] Toast feedback for clear cache → Task 4
- [x] Toast feedback for card meta toggles → Task 4
- [x] Toast feedback for TMDB key save → Task 4 (removes tmdbKeySaved green-flash)
- [x] useMediaMeta reactivity fix → Task 5
- [x] Genres wrap (remove slice) → Task 5 Step 2
- [x] DB migration → Task 6
- [x] UserRepo methods → Task 7
- [x] API routes → Task 8
- [x] API client methods → Task 9
- [x] Forgot password page → Task 10
- [x] Reset password page → Task 11
- [x] Login page link → Task 12

**Type consistency:**
- `useToast()` returns `{ toast }` — consistent across Tasks 3, 4
- `useMediaMeta(tmdbId, mediaType, tmdbApiKey)` — 3 params in definition (Task 5 Step 1) and all 3 call sites (Task 5 Steps 2–4) ✓
- `userRepo.createResetToken` / `findResetToken` / `updatePassword` / `markResetTokenUsed` — defined in interface (Task 7 Step 1) and implemented (Task 7 Step 2) and called in routes (Task 8) ✓
- `apiClient.auth.forgotPassword` / `resetPassword` — defined (Task 9) and called in pages (Tasks 10, 11) ✓
