# Jellyfin Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only Jellyfin progress overlay to watchlist cards — fetch watch state (planned/watching/watched) and progress (% for movies, S·E·% for TV) from a user-configured Jellyfin server and display it on each card.

**Architecture:** Pure mapping functions in `lib/jellyfin.ts` transform raw Jellyfin API responses to a typed `JellyfinProgress` model; a `useJellyfinProgress` hook fetches on mount and returns a keyed Map; `WatchlistItemCard` consumes an optional `jellyfinProgress` prop and renders badges; settings UI in profile page handles credentials.

**Tech Stack:** TypeScript, React hooks, vitest (jsdom), Next.js App Router, Tailwind/CSS vars (matching existing card styles)

---

## File Map

| Action   | Path                                                      | Responsibility                                        |
|----------|-----------------------------------------------------------|-------------------------------------------------------|
| Create   | `apps/web/src/lib/jellyfin.ts`                           | Types + pure mapping fns + `fetchJellyfinProgress`    |
| Create   | `apps/web/src/hooks/useJellyfinProgress.ts`              | React hook wrapping the fetcher                       |
| Create   | `apps/web/tests/jellyfin.test.ts`                        | Unit tests for all pure functions                     |
| Modify   | `apps/web/src/hooks/useSettings.ts`                      | Add jellyfin fields to `AppSettings`                  |
| Modify   | `apps/web/src/app/profile/page.tsx`                      | Add Jellyfin config section                           |
| Modify   | `apps/web/src/components/WatchlistItemCard.tsx`          | Accept + render `jellyfinProgress` prop               |
| Modify   | `apps/web/src/app/page.tsx`                              | Call hook, pass progress to each card                 |

---

## Task 1: Create `jellyfin.ts` with types and pure mapping functions

**Files:**
- Create: `apps/web/src/lib/jellyfin.ts`

- [ ] **Step 1: Create the file with all types and pure functions**

```typescript
// apps/web/src/lib/jellyfin.ts

export interface JellyfinProgress {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  jellyfinStatus: 'planned' | 'watching' | 'watched'
  moviePercent?: number      // movie only, 0–100
  season?: number            // tv in-progress only
  episode?: number           // tv in-progress only
  episodePercent?: number    // tv in-progress only, 0–100
}

interface JellyfinUserData {
  Played: boolean
  PlaybackPositionTicks: number
  UnplayedItemCount?: number
}

export interface JellyfinItem {
  Id: string
  ProviderIds?: { Tmdb?: string }
  UserData: JellyfinUserData
  RunTimeTicks?: number
  RecursiveItemCount?: number
}

export interface JellyfinEpisode {
  UserData: JellyfinUserData
  RunTimeTicks?: number
  ParentIndexNumber?: number
  IndexNumber?: number
}

export function mapMovie(item: JellyfinItem): JellyfinProgress | null {
  const tmdbIdStr = item.ProviderIds?.Tmdb
  if (!tmdbIdStr) return null
  const tmdbId = parseInt(tmdbIdStr, 10)
  if (isNaN(tmdbId)) return null

  if (item.UserData.Played) {
    return { tmdbId, mediaType: 'movie', jellyfinStatus: 'watched', moviePercent: 100 }
  }
  if (item.UserData.PlaybackPositionTicks > 0 && item.RunTimeTicks) {
    const moviePercent = Math.min(
      100,
      Math.round((item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100),
    )
    return { tmdbId, mediaType: 'movie', jellyfinStatus: 'watching', moviePercent }
  }
  return { tmdbId, mediaType: 'movie', jellyfinStatus: 'planned' }
}

export function mapSeries(
  item: JellyfinItem,
): { progress: JellyfinProgress; jellyfinId: string } | null {
  const tmdbIdStr = item.ProviderIds?.Tmdb
  if (!tmdbIdStr) return null
  const tmdbId = parseInt(tmdbIdStr, 10)
  if (isNaN(tmdbId)) return null

  const { UnplayedItemCount, PlaybackPositionTicks } = item.UserData
  const total = item.RecursiveItemCount ?? 0
  const played = total - (UnplayedItemCount ?? total)

  let jellyfinStatus: 'planned' | 'watching' | 'watched'
  if (UnplayedItemCount === 0 && total > 0) {
    jellyfinStatus = 'watched'
  } else if (played > 0 || PlaybackPositionTicks > 0) {
    jellyfinStatus = 'watching'
  } else {
    jellyfinStatus = 'planned'
  }

  return {
    progress: { tmdbId, mediaType: 'tv', jellyfinStatus },
    jellyfinId: item.Id,
  }
}

export function findCurrentEpisode(
  episodes: JellyfinEpisode[],
): { season: number; episode: number; episodePercent: number } | null {
  // Prefer episode actively in progress (has seek position)
  const inProgress = episodes.find((e) => e.UserData.PlaybackPositionTicks > 0)
  if (inProgress) {
    const episodePercent =
      inProgress.RunTimeTicks && inProgress.RunTimeTicks > 0
        ? Math.min(
            100,
            Math.round((inProgress.UserData.PlaybackPositionTicks / inProgress.RunTimeTicks) * 100),
          )
        : 0
    return {
      season: inProgress.ParentIndexNumber ?? 1,
      episode: inProgress.IndexNumber ?? 1,
      episodePercent,
    }
  }

  // Fall back to last fully-played episode
  const playedEpisodes = episodes.filter((e) => e.UserData.Played)
  if (playedEpisodes.length > 0) {
    const last = playedEpisodes[playedEpisodes.length - 1]
    return {
      season: last.ParentIndexNumber ?? 1,
      episode: last.IndexNumber ?? 1,
      episodePercent: 100,
    }
  }

  return null
}

export async function fetchJellyfinProgress(
  url: string,
  apiKey: string,
  userId: string,
): Promise<Map<string, JellyfinProgress>> {
  const headers = { 'X-Emby-Token': apiKey }
  const base = url.replace(/\/$/, '')
  const result = new Map<string, JellyfinProgress>()

  // Movies
  const moviesRes = await fetch(
    `${base}/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Fields=ProviderIds,UserData,RunTimeTicks`,
    { headers },
  )
  if (!moviesRes.ok) throw new Error(`Jellyfin movies fetch failed: ${moviesRes.status}`)
  const moviesData: { Items?: JellyfinItem[] } = await moviesRes.json()
  for (const item of moviesData.Items ?? []) {
    const progress = mapMovie(item)
    if (progress) result.set(`${progress.tmdbId}-movie`, progress)
  }

  // TV series
  const seriesRes = await fetch(
    `${base}/Users/${userId}/Items?IncludeItemTypes=Series&Recursive=true&Fields=ProviderIds,UserData,RecursiveItemCount`,
    { headers },
  )
  if (!seriesRes.ok) throw new Error(`Jellyfin series fetch failed: ${seriesRes.status}`)
  const seriesData: { Items?: JellyfinItem[] } = await seriesRes.json()

  const watchingSeries: Array<{ progress: JellyfinProgress; jellyfinId: string }> = []
  for (const item of seriesData.Items ?? []) {
    const mapped = mapSeries(item)
    if (!mapped) continue
    result.set(`${mapped.progress.tmdbId}-tv`, mapped.progress)
    if (mapped.progress.jellyfinStatus === 'watching') {
      watchingSeries.push(mapped)
    }
  }

  // Episodes for in-progress series only
  await Promise.all(
    watchingSeries.map(async ({ progress, jellyfinId }) => {
      const epRes = await fetch(
        `${base}/Users/${userId}/Items?ParentId=${jellyfinId}&IncludeItemTypes=Episode&Recursive=true&Fields=UserData,ParentIndexNumber,IndexNumber,RunTimeTicks&SortBy=SortName`,
        { headers },
      )
      if (!epRes.ok) return
      const epData: { Items?: JellyfinEpisode[] } = await epRes.json()
      const currentEp = findCurrentEpisode(epData.Items ?? [])
      if (currentEp) {
        const key = `${progress.tmdbId}-tv`
        const existing = result.get(key)
        if (existing) result.set(key, { ...existing, ...currentEp })
      }
    }),
  )

  return result
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from repo root:
```
pnpm --filter @mywatch/web type-check
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/jellyfin.ts
git commit -m "feat: Jellyfin API client — types, mapping fns, fetcher"
```

---

## Task 2: Unit tests for pure functions

**Files:**
- Create: `apps/web/tests/jellyfin.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/tests/jellyfin.test.ts
import { describe, it, expect } from 'vitest'
import { mapMovie, mapSeries, findCurrentEpisode } from '../src/lib/jellyfin'
import type { JellyfinItem, JellyfinEpisode } from '../src/lib/jellyfin'

const BASE_ITEM: JellyfinItem = {
  Id: 'jf-1',
  ProviderIds: { Tmdb: '550' },
  UserData: { Played: false, PlaybackPositionTicks: 0 },
}

describe('mapMovie', () => {
  it('returns null when ProviderIds.Tmdb is missing', () => {
    expect(mapMovie({ ...BASE_ITEM, ProviderIds: {} })).toBeNull()
  })

  it('returns null when Tmdb id is not a number', () => {
    expect(mapMovie({ ...BASE_ITEM, ProviderIds: { Tmdb: 'abc' } })).toBeNull()
  })

  it('returns planned when not played and no ticks', () => {
    const result = mapMovie(BASE_ITEM)
    expect(result).toEqual({ tmdbId: 550, mediaType: 'movie', jellyfinStatus: 'planned' })
  })

  it('returns watched with moviePercent 100 when Played=true', () => {
    const result = mapMovie({ ...BASE_ITEM, UserData: { Played: true, PlaybackPositionTicks: 0 } })
    expect(result).toEqual({ tmdbId: 550, mediaType: 'movie', jellyfinStatus: 'watched', moviePercent: 100 })
  })

  it('returns watching with correct percent when in progress', () => {
    const result = mapMovie({
      ...BASE_ITEM,
      RunTimeTicks: 10_000_000,
      UserData: { Played: false, PlaybackPositionTicks: 5_000_000 },
    })
    expect(result).toEqual({ tmdbId: 550, mediaType: 'movie', jellyfinStatus: 'watching', moviePercent: 50 })
  })

  it('clamps percent to 100', () => {
    const result = mapMovie({
      ...BASE_ITEM,
      RunTimeTicks: 100,
      UserData: { Played: false, PlaybackPositionTicks: 200 },
    })
    expect(result?.moviePercent).toBe(100)
  })

  it('returns planned (not watching) when ticks > 0 but no RunTimeTicks', () => {
    const result = mapMovie({
      ...BASE_ITEM,
      UserData: { Played: false, PlaybackPositionTicks: 5_000_000 },
    })
    expect(result?.jellyfinStatus).toBe('planned')
  })
})

describe('mapSeries', () => {
  const BASE_SERIES: JellyfinItem = {
    Id: 'jf-s1',
    ProviderIds: { Tmdb: '1396' },
    UserData: { Played: false, PlaybackPositionTicks: 0, UnplayedItemCount: 62 },
    RecursiveItemCount: 62,
  }

  it('returns null when Tmdb id is missing', () => {
    expect(mapSeries({ ...BASE_SERIES, ProviderIds: {} })).toBeNull()
  })

  it('returns planned when nothing played', () => {
    const result = mapSeries(BASE_SERIES)
    expect(result?.progress.jellyfinStatus).toBe('planned')
    expect(result?.jellyfinId).toBe('jf-s1')
  })

  it('returns watched when UnplayedItemCount is 0', () => {
    const result = mapSeries({
      ...BASE_SERIES,
      UserData: { Played: false, PlaybackPositionTicks: 0, UnplayedItemCount: 0 },
    })
    expect(result?.progress.jellyfinStatus).toBe('watched')
  })

  it('returns watching when some episodes played', () => {
    const result = mapSeries({
      ...BASE_SERIES,
      UserData: { Played: false, PlaybackPositionTicks: 0, UnplayedItemCount: 55 },
      RecursiveItemCount: 62,
    })
    expect(result?.progress.jellyfinStatus).toBe('watching')
  })

  it('returns watching when PlaybackPositionTicks > 0', () => {
    const result = mapSeries({
      ...BASE_SERIES,
      UserData: { Played: false, PlaybackPositionTicks: 9_000_000, UnplayedItemCount: 62 },
    })
    expect(result?.progress.jellyfinStatus).toBe('watching')
  })

  it('maps tmdbId correctly', () => {
    expect(mapSeries(BASE_SERIES)?.progress.tmdbId).toBe(1396)
    expect(mapSeries(BASE_SERIES)?.progress.mediaType).toBe('tv')
  })
})

describe('findCurrentEpisode', () => {
  const makeEpisode = (opts: {
    played?: boolean
    ticks?: number
    runtime?: number
    season?: number
    ep?: number
  }): JellyfinEpisode => ({
    UserData: { Played: opts.played ?? false, PlaybackPositionTicks: opts.ticks ?? 0 },
    RunTimeTicks: opts.runtime,
    ParentIndexNumber: opts.season ?? 1,
    IndexNumber: opts.ep ?? 1,
  })

  it('returns null for empty episode list', () => {
    expect(findCurrentEpisode([])).toBeNull()
  })

  it('returns null when no episodes played or in-progress', () => {
    expect(findCurrentEpisode([makeEpisode({}), makeEpisode({ ep: 2 })])).toBeNull()
  })

  it('returns in-progress episode with percent', () => {
    const episodes = [
      makeEpisode({ played: true, ep: 1 }),
      makeEpisode({ ticks: 4_000_000, runtime: 10_000_000, season: 1, ep: 2 }),
      makeEpisode({ ep: 3 }),
    ]
    expect(findCurrentEpisode(episodes)).toEqual({ season: 1, episode: 2, episodePercent: 40 })
  })

  it('returns last played episode with episodePercent 100 when none in-progress', () => {
    const episodes = [
      makeEpisode({ played: true, season: 1, ep: 1 }),
      makeEpisode({ played: true, season: 1, ep: 2 }),
      makeEpisode({ season: 1, ep: 3 }),
    ]
    expect(findCurrentEpisode(episodes)).toEqual({ season: 1, episode: 2, episodePercent: 100 })
  })

  it('prefers in-progress over last-played', () => {
    const episodes = [
      makeEpisode({ played: true, season: 1, ep: 1 }),
      makeEpisode({ ticks: 2_000_000, runtime: 10_000_000, season: 1, ep: 2 }),
    ]
    const result = findCurrentEpisode(episodes)
    expect(result?.episode).toBe(2)
    expect(result?.episodePercent).toBe(20)
  })

  it('uses episodePercent 0 when runtime is 0 or missing', () => {
    const episodes = [makeEpisode({ ticks: 5_000_000, season: 2, ep: 3 })]
    expect(findCurrentEpisode(episodes)).toEqual({ season: 2, episode: 3, episodePercent: 0 })
  })

  it('clamps episodePercent to 100', () => {
    const episodes = [makeEpisode({ ticks: 20_000_000, runtime: 10_000_000, season: 1, ep: 1 })]
    expect(findCurrentEpisode(episodes)?.episodePercent).toBe(100)
  })
})
```

- [ ] **Step 2: Run tests — expect all to pass**

```
pnpm --filter @mywatch/web test -- --reporter=verbose jellyfin
```
Expected: all tests pass (functions already implemented in Task 1)

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/jellyfin.test.ts
git commit -m "test: unit tests for Jellyfin mapping functions"
```

---

## Task 3: Add Jellyfin fields to AppSettings

**Files:**
- Modify: `apps/web/src/hooks/useSettings.ts`

- [ ] **Step 1: Add three fields to the `AppSettings` interface** (after `cardMeta`)

In `apps/web/src/hooks/useSettings.ts`, find the `AppSettings` interface and add:
```typescript
  jellyfinUrl: string
  jellyfinApiKey: string
  jellyfinUserId: string
```

- [ ] **Step 2: Add defaults in `DEFAULT_SETTINGS`** (after `cardMeta`)

```typescript
  jellyfinUrl: '',
  jellyfinApiKey: '',
  jellyfinUserId: '',
```

- [ ] **Step 3: Verify type-check passes**

```
pnpm --filter @mywatch/web type-check
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useSettings.ts
git commit -m "feat: add Jellyfin credential fields to AppSettings"
```

---

## Task 4: Create `useJellyfinProgress` hook

**Files:**
- Create: `apps/web/src/hooks/useJellyfinProgress.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/web/src/hooks/useJellyfinProgress.ts
'use client'
import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from './useSettings'
import { fetchJellyfinProgress, type JellyfinProgress } from '@/lib/jellyfin'

export function useJellyfinProgress(settings: AppSettings): {
  progressMap: Map<string, JellyfinProgress> | null
  refresh: () => void
  loading: boolean
} {
  const [progressMap, setProgressMap] = useState<Map<string, JellyfinProgress> | null>(null)
  const [loading, setLoading] = useState(false)
  const { jellyfinUrl, jellyfinApiKey, jellyfinUserId } = settings

  const run = useCallback(async () => {
    if (!jellyfinUrl || !jellyfinApiKey || !jellyfinUserId) return
    setLoading(true)
    try {
      const map = await fetchJellyfinProgress(jellyfinUrl, jellyfinApiKey, jellyfinUserId)
      setProgressMap(map)
    } catch (err) {
      console.error('Jellyfin fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [jellyfinUrl, jellyfinApiKey, jellyfinUserId])

  useEffect(() => {
    run()
  }, [run])

  return { progressMap, refresh: run, loading }
}
```

- [ ] **Step 2: Type-check**

```
pnpm --filter @mywatch/web type-check
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useJellyfinProgress.ts
git commit -m "feat: useJellyfinProgress hook — fetches and caches Jellyfin progress"
```

---

## Task 5: Add Jellyfin indicator to `WatchlistItemCard`

**Files:**
- Modify: `apps/web/src/components/WatchlistItemCard.tsx`

- [ ] **Step 1: Add the import and update the props interface**

At the top of the file, after existing imports, add:
```typescript
import type { JellyfinProgress } from '@/lib/jellyfin'
```

Change the component signature from:
```typescript
export function WatchlistItemCard({ item, onSelect }: { item: WatchlistItem; onSelect?: () => void }) {
```
to:
```typescript
export function WatchlistItemCard({
  item,
  onSelect,
  jellyfinProgress,
}: {
  item: WatchlistItem
  onSelect?: () => void
  jellyfinProgress?: JellyfinProgress
}) {
```

- [ ] **Step 2: Add Jellyfin badge and progress pill in Row 2**

In Row 2 of the card body, find the line rendering `<StatusBadge status={item.status} />` and add Jellyfin display **immediately after** it:

```tsx
          <StatusBadge status={item.status} />
          {jellyfinProgress && (
            <>
              <span
                className="text-[9.5px] font-extrabold tracking-[0.04em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
                style={{ background: 'rgba(251,191,36,.15)', color: 'var(--amber)' }}
              >
                J
              </span>
              {jellyfinProgress.jellyfinStatus === 'watching' && (
                <span
                  className="text-[10.5px] font-medium rounded-full px-[7px] py-[1.5px] border tabular-nums"
                  style={{ color: 'var(--amber)', background: 'rgba(251,191,36,.07)', borderColor: 'rgba(251,191,36,.25)' }}
                >
                  {jellyfinProgress.mediaType === 'movie'
                    ? `${jellyfinProgress.moviePercent ?? 0}%`
                    : jellyfinProgress.season != null
                    ? `S${jellyfinProgress.season}·E${jellyfinProgress.episode ?? '?'}${jellyfinProgress.episodePercent != null ? ` · ${jellyfinProgress.episodePercent}%` : ''}`
                    : null}
                </span>
              )}
              {jellyfinProgress.jellyfinStatus === 'watched' && item.status === 'planned' && (
                <span
                  className="text-[10px]"
                  style={{ color: 'var(--muted2)', fontStyle: 'italic' }}
                >
                  seen on Jellyfin
                </span>
              )}
            </>
          )}
```

- [ ] **Step 3: Type-check**

```
pnpm --filter @mywatch/web type-check
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/WatchlistItemCard.tsx
git commit -m "feat: Jellyfin progress badge and percent pill on watchlist card"
```

---

## Task 6: Wire `useJellyfinProgress` into the main watchlist page

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Import the hook**

Add to the existing imports at the top of `apps/web/src/app/page.tsx`:
```typescript
import { useJellyfinProgress } from '@/hooks/useJellyfinProgress'
```

- [ ] **Step 2: Call the hook inside `HomePage`**

After the line `const { settings, update: updateSettings } = useSettings()`, add:
```typescript
  const { progressMap } = useJellyfinProgress(settings)
```

- [ ] **Step 3: Pass `jellyfinProgress` to each `WatchlistItemCard`**

Find the `WatchlistItemCard` usage in the list render section:
```tsx
            {displayed.map((item) => (
              <WatchlistItemCard
                key={item.id}
                item={item}
                onSelect={() => setPanel({ tmdbId: item.tmdbId, mediaType: item.mediaType as MediaType })}
              />
            ))}
```

Replace with:
```tsx
            {displayed.map((item) => (
              <WatchlistItemCard
                key={item.id}
                item={item}
                jellyfinProgress={progressMap?.get(`${item.tmdbId}-${item.mediaType}`) ?? undefined}
                onSelect={() => setPanel({ tmdbId: item.tmdbId, mediaType: item.mediaType as MediaType })}
              />
            ))}
```

- [ ] **Step 4: Type-check**

```
pnpm --filter @mywatch/web type-check
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: wire Jellyfin progress into watchlist page"
```

---

## Task 7: Add Jellyfin settings section to profile page

**Files:**
- Modify: `apps/web/src/app/profile/page.tsx`

- [ ] **Step 1: Add Jellyfin state variables**

Inside `SettingsPage`, after the existing `const [tmdbKeyInput, setTmdbKeyInput] = useState('')` line, add:
```typescript
  const [jellyfinUrlInput, setJellyfinUrlInput] = useState('')
  const [jellyfinUserIdInput, setJellyfinUserIdInput] = useState('')
  const [jellyfinApiKeyInput, setJellyfinApiKeyInput] = useState('')
  const [jellyfinTestResult, setJellyfinTestResult] = useState<'ok' | 'error' | null>(null)
  const [jellyfinTesting, setJellyfinTesting] = useState(false)
```

- [ ] **Step 2: Sync inputs from settings on load**

Inside the existing `useEffect(() => { setTmdbKeyInput(settings.tmdbApiKey) }, [settings.tmdbApiKey])`, expand it **or add a new one** immediately after:
```typescript
  useEffect(() => {
    setJellyfinUrlInput(settings.jellyfinUrl)
    setJellyfinUserIdInput(settings.jellyfinUserId)
    setJellyfinApiKeyInput(settings.jellyfinApiKey)
  }, [settings.jellyfinUrl, settings.jellyfinUserId, settings.jellyfinApiKey])
```

- [ ] **Step 3: Add save and test functions**

Inside `SettingsPage`, after `saveTmdbKey`, add:
```typescript
  function saveJellyfin() {
    update({
      jellyfinUrl: jellyfinUrlInput.trim(),
      jellyfinUserId: jellyfinUserIdInput.trim(),
      jellyfinApiKey: jellyfinApiKeyInput.trim(),
    })
    toast('Jellyfin settings saved', 'success')
  }

  async function testJellyfin() {
    const url = jellyfinUrlInput.trim().replace(/\/$/, '')
    const userId = jellyfinUserIdInput.trim()
    const apiKey = jellyfinApiKeyInput.trim()
    if (!url || !userId || !apiKey) return
    setJellyfinTesting(true)
    setJellyfinTestResult(null)
    try {
      const res = await fetch(
        `${url}/Users/${userId}/Items?Limit=1`,
        { headers: { 'X-Emby-Token': apiKey } },
      )
      setJellyfinTestResult(res.ok ? 'ok' : 'error')
    } catch {
      setJellyfinTestResult('error')
    } finally {
      setJellyfinTesting(false)
    }
  }
```

- [ ] **Step 4: Add the Jellyfin section to the JSX**

In the `return` block, add the following `<Section>` **before** the `<Section title="Card Display">` block:
```tsx
        {/* Jellyfin */}
        <Section title="Jellyfin">
          <div className="px-4 py-3 space-y-3">
            <p className="text-[12px]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
              Connect to your Jellyfin server to overlay watch progress on cards. Requires CORS enabled in Jellyfin → Networking.
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={jellyfinUrlInput}
                onChange={(e) => setJellyfinUrlInput(e.target.value)}
                placeholder="Server URL (e.g. http://jellyfin.local:8096)"
                className="w-full px-3 py-2 rounded-[6px] text-[13px] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              <input
                type="text"
                value={jellyfinUserIdInput}
                onChange={(e) => setJellyfinUserIdInput(e.target.value)}
                placeholder="User ID"
                className="w-full px-3 py-2 rounded-[6px] text-[13px] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              <input
                type="password"
                value={jellyfinApiKeyInput}
                onChange={(e) => setJellyfinApiKeyInput(e.target.value)}
                placeholder="API Key"
                className="w-full px-3 py-2 rounded-[6px] text-[13px] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={testJellyfin}
                disabled={jellyfinTesting || !jellyfinUrlInput || !jellyfinUserIdInput || !jellyfinApiKeyInput}
                className="px-3 py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none flex-shrink-0 transition-all duration-100 disabled:opacity-50"
                style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
              >
                {jellyfinTesting ? 'Testing…' : 'Test'}
              </button>
              <button
                onClick={saveJellyfin}
                className="flex-1 py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none transition-all duration-100"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Save
              </button>
            </div>
            {jellyfinTestResult === 'ok' && (
              <p className="text-[12px]" style={{ color: 'var(--green)' }}>✓ Connected successfully</p>
            )}
            {jellyfinTestResult === 'error' && (
              <p className="text-[12px]" style={{ color: 'var(--red)' }}>Connection failed — check URL, user ID, API key, and CORS settings</p>
            )}
          </div>
        </Section>
```

- [ ] **Step 5: Type-check**

```
pnpm --filter @mywatch/web type-check
```
Expected: no errors

- [ ] **Step 6: Run full test suite**

```
pnpm --filter @mywatch/web test
```
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/profile/page.tsx
git commit -m "feat: Jellyfin settings section in profile page with test-connection"
```

---

## Verification

After all tasks are complete, run:

```
pnpm --filter @mywatch/web type-check && pnpm --filter @mywatch/web test
```

Expected: 0 type errors, all tests pass.

To smoke-test the UI: configure Jellyfin credentials in the Settings page, click Test, then navigate to the watchlist — cards with matching TMDB IDs should show the amber `J` badge and progress info.
