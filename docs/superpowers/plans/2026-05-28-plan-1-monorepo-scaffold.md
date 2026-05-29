# Plan 1: Monorepo Scaffold + Shared Packages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a pnpm monorepo with three shared TypeScript packages (`core`, `tmdb`, `sync`) that all apps (web, mobile, API) will import.

**Architecture:** pnpm workspaces with packages under `packages/`. Each package builds with `tsup`, tests with Vitest, and exports a barrel from `src/index.ts`. No app code — shared library only. Apps scaffold in later plans.

**Tech Stack:** Node.js 20, pnpm 9, TypeScript 5.5, Zod 3.23, Vitest 2.0, tsup 8.2

---

## File Map

```
myWatch/
  package.json                          — workspace root, dev tooling
  pnpm-workspace.yaml                   — declares apps/*, packages/*
  tsconfig.base.json                    — shared TS compiler options
  vitest.config.ts                      — shared test config
  .gitignore
  .prettierrc

  packages/
    core/
      package.json
      tsconfig.json
      src/
        types.ts                        — MediaType, WatchStatus, User, WatchlistItem, MediaCache
        schemas.ts                      — Zod schemas + inferred input types
        status.ts                       — canTransition(), applyStatusChange()
        index.ts                        — barrel export
      tests/
        schemas.test.ts
        status.test.ts

    tmdb/
      package.json
      tsconfig.json
      src/
        types.ts                        — raw TMDB API response shapes
        normalize.ts                    — normalizeMovie(), normalizeTv() → MediaCache
        client.ts                       — TmdbClient class (wraps fetch)
        cache.ts                        — isStale()
        index.ts
      tests/
        normalize.test.ts
        client.test.ts
        cache.test.ts

    sync/
      package.json
      tsconfig.json
      src/
        types.ts                        — SyncPushPayload, SyncPullResponse, SyncMeta
        conflict.ts                     — resolveConflict(), mergeItems()
        device.ts                       — DeviceIdStorage interface, getOrCreateDeviceId()
        index.ts
      tests/
        conflict.test.ts
        device.test.ts
```

---

## Task 1: Monorepo Root Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.prettierrc`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "mywatch",
  "private": true,
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build:packages": "pnpm -r --filter './packages/**' build",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "eslint": "^8.57.0",
    "prettier": "^3.3.0",
    "tsup": "^8.2.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.env
.env.local
*.tsbuildinfo
.superpowers/
```

- [ ] **Step 6: Create `.prettierrc`**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 7: Install deps**

Run: `pnpm install`
Expected: lockfile created, `node_modules` at root populated.

- [ ] **Step 8: Commit**

```bash
git init
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts .gitignore .prettierrc
git commit -m "chore: monorepo root scaffold"
```

---

## Task 2: `packages/core` — Directory + Types

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types.ts`

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@mywatch/core",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run --reporter=verbose"
  },
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `packages/core/src/types.ts`**

```typescript
export type MediaType = 'movie' | 'tv'

export type WatchStatus = 'planned' | 'in_progress' | 'watched' | 'quit'

export interface User {
  id: string
  email: string | null
  displayName: string
  avatarUrl: string | null
  isGuest: boolean
  createdAt: string
  updatedAt: string
}

export interface WatchlistItem {
  id: string
  userId: string
  tmdbId: number
  mediaType: MediaType
  status: WatchStatus
  progressEpisode: number | null
  progressSeason: number | null
  rating: number | null
  notes: string | null
  addedAt: string
  startedAt: string | null
  finishedAt: string | null
  quitAt: string | null
  updatedAt: string
  deviceId: string
  deletedAt: string | null
}

export interface MediaCache {
  tmdbId: number
  mediaType: MediaType
  title: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string | null
  genres: Array<{ id: number; name: string }>
  voteAverage: number
  voteCount: number
  runtime: number | null
  seasonsCount: number | null
  showStatus: string | null
  cachedAt: string
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/core
git commit -m "feat(core): package scaffold and shared types"
```

---

## Task 3: `packages/core` — Zod Schemas (TDD)

**Files:**
- Create: `packages/core/tests/schemas.test.ts`
- Create: `packages/core/src/schemas.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/tests/schemas.test.ts
import { describe, it, expect } from 'vitest'
import { watchlistItemSchema, mediaCacheSchema, watchStatusSchema } from '../src/schemas'

const validItem = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  tmdbId: 1396,
  mediaType: 'tv',
  status: 'planned',
  progressEpisode: null,
  progressSeason: null,
  rating: null,
  notes: null,
  addedAt: '2026-01-01T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  quitAt: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
  deviceId: 'device-abc',
  deletedAt: null,
}

describe('watchlistItemSchema', () => {
  it('parses a valid planned item', () => {
    expect(() => watchlistItemSchema.parse(validItem)).not.toThrow()
  })

  it('rejects rating below 1', () => {
    expect(() => watchlistItemSchema.parse({ ...validItem, rating: 0 })).toThrow()
  })

  it('rejects rating above 10', () => {
    expect(() => watchlistItemSchema.parse({ ...validItem, rating: 11 })).toThrow()
  })

  it('rejects invalid status', () => {
    expect(() => watchlistItemSchema.parse({ ...validItem, status: 'maybe' })).toThrow()
  })

  it('rejects non-uuid id', () => {
    expect(() => watchlistItemSchema.parse({ ...validItem, id: 'not-a-uuid' })).toThrow()
  })
})

describe('watchStatusSchema', () => {
  it('accepts all four statuses', () => {
    for (const s of ['planned', 'in_progress', 'watched', 'quit']) {
      expect(() => watchStatusSchema.parse(s)).not.toThrow()
    }
  })
})

describe('mediaCacheSchema', () => {
  it('parses a valid movie cache entry', () => {
    const entry = {
      tmdbId: 603,
      mediaType: 'movie',
      title: 'The Matrix',
      overview: 'A hacker discovers reality.',
      posterPath: '/poster.jpg',
      backdropPath: null,
      releaseDate: '1999-03-31',
      genres: [{ id: 28, name: 'Action' }],
      voteAverage: 8.7,
      voteCount: 24000,
      runtime: 136,
      seasonsCount: null,
      showStatus: 'Released',
      cachedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(() => mediaCacheSchema.parse(entry)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run — confirm failure**

Run: `pnpm --filter @mywatch/core test`
Expected: `Cannot find module '../src/schemas'`

- [ ] **Step 3: Implement `packages/core/src/schemas.ts`**

```typescript
import { z } from 'zod'

export const mediaTypeSchema = z.enum(['movie', 'tv'])

export const watchStatusSchema = z.enum(['planned', 'in_progress', 'watched', 'quit'])

export const watchlistItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tmdbId: z.number().int().positive(),
  mediaType: mediaTypeSchema,
  status: watchStatusSchema,
  progressEpisode: z.number().int().positive().nullable(),
  progressSeason: z.number().int().positive().nullable(),
  rating: z.number().int().min(1).max(10).nullable(),
  notes: z.string().nullable(),
  addedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  quitAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  deviceId: z.string().min(1),
  deletedAt: z.string().datetime().nullable(),
})

export const mediaCacheSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: mediaTypeSchema,
  title: z.string().min(1),
  overview: z.string(),
  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),
  releaseDate: z.string().nullable(),
  genres: z.array(z.object({ id: z.number(), name: z.string() })),
  voteAverage: z.number().min(0).max(10),
  voteCount: z.number().int().nonnegative(),
  runtime: z.number().int().positive().nullable(),
  seasonsCount: z.number().int().positive().nullable(),
  showStatus: z.string().nullable(),
  cachedAt: z.string().datetime(),
})

export type WatchlistItemInput = z.input<typeof watchlistItemSchema>
export type MediaCacheInput = z.input<typeof mediaCacheSchema>
```

- [ ] **Step 4: Run — confirm pass**

Run: `pnpm --filter @mywatch/core test`
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/schemas.ts packages/core/tests/schemas.test.ts
git commit -m "feat(core): Zod schemas for WatchlistItem and MediaCache"
```

---

## Task 4: `packages/core` — Status Transitions (TDD)

**Files:**
- Create: `packages/core/tests/status.test.ts`
- Create: `packages/core/src/status.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/tests/status.test.ts
import { describe, it, expect } from 'vitest'
import { canTransition, applyStatusChange } from '../src/status'
import type { WatchlistItem } from '../src/types'

const baseItem: WatchlistItem = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  tmdbId: 1396,
  mediaType: 'tv',
  status: 'planned',
  progressEpisode: null,
  progressSeason: null,
  rating: null,
  notes: null,
  addedAt: '2026-01-01T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  quitAt: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
  deviceId: 'device-a',
  deletedAt: null,
}

describe('canTransition', () => {
  it('allows planned → in_progress', () => {
    expect(canTransition('planned', 'in_progress')).toBe(true)
  })

  it('allows in_progress → watched', () => {
    expect(canTransition('in_progress', 'watched')).toBe(true)
  })

  it('allows watched → planned (re-watch)', () => {
    expect(canTransition('watched', 'planned')).toBe(true)
  })

  it('allows quit → in_progress', () => {
    expect(canTransition('quit', 'in_progress')).toBe(true)
  })

  it('disallows planned → planned (no-op transition)', () => {
    expect(canTransition('planned', 'planned')).toBe(false)
  })
})

describe('applyStatusChange', () => {
  it('sets startedAt when transitioning to in_progress for first time', () => {
    const now = '2026-06-01T10:00:00.000Z'
    const result = applyStatusChange(baseItem, 'in_progress', 'device-b', now)
    expect(result.status).toBe('in_progress')
    expect(result.startedAt).toBe(now)
    expect(result.deviceId).toBe('device-b')
    expect(result.updatedAt).toBe(now)
  })

  it('does not overwrite startedAt on second in_progress transition', () => {
    const firstStart = '2026-06-01T10:00:00.000Z'
    const restarted = { ...baseItem, status: 'quit' as const, startedAt: firstStart }
    const result = applyStatusChange(restarted, 'in_progress', 'device-b', '2026-07-01T00:00:00.000Z')
    expect(result.startedAt).toBe(firstStart)
  })

  it('sets finishedAt and clears quitAt when transitioning to watched', () => {
    const now = '2026-06-01T12:00:00.000Z'
    const inProgress = { ...baseItem, status: 'in_progress' as const }
    const result = applyStatusChange(inProgress, 'watched', 'device-a', now)
    expect(result.finishedAt).toBe(now)
    expect(result.quitAt).toBeNull()
  })

  it('sets quitAt and clears finishedAt when transitioning to quit', () => {
    const now = '2026-06-01T12:00:00.000Z'
    const inProgress = { ...baseItem, status: 'in_progress' as const }
    const result = applyStatusChange(inProgress, 'quit', 'device-a', now)
    expect(result.quitAt).toBe(now)
    expect(result.finishedAt).toBeNull()
  })

  it('clears all timestamps when transitioning to planned', () => {
    const now = '2026-06-01T12:00:00.000Z'
    const watched = {
      ...baseItem,
      status: 'watched' as const,
      startedAt: '2026-05-01T00:00:00.000Z',
      finishedAt: '2026-05-15T00:00:00.000Z',
    }
    const result = applyStatusChange(watched, 'planned', 'device-a', now)
    expect(result.startedAt).toBeNull()
    expect(result.finishedAt).toBeNull()
    expect(result.quitAt).toBeNull()
  })

  it('throws on invalid transition', () => {
    expect(() => applyStatusChange(baseItem, 'planned', 'device-a')).toThrow(
      'Cannot transition from planned to planned',
    )
  })
})
```

- [ ] **Step 2: Run — confirm failure**

Run: `pnpm --filter @mywatch/core test`
Expected: `Cannot find module '../src/status'`

- [ ] **Step 3: Implement `packages/core/src/status.ts`**

```typescript
import type { WatchlistItem, WatchStatus } from './types'

const VALID_TRANSITIONS: Record<WatchStatus, WatchStatus[]> = {
  planned: ['in_progress', 'watched', 'quit'],
  in_progress: ['watched', 'quit', 'planned'],
  watched: ['planned', 'in_progress'],
  quit: ['planned', 'in_progress'],
}

export function canTransition(from: WatchStatus, to: WatchStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function applyStatusChange(
  item: WatchlistItem,
  newStatus: WatchStatus,
  deviceId: string,
  now = new Date().toISOString(),
): WatchlistItem {
  if (!canTransition(item.status, newStatus)) {
    throw new Error(`Cannot transition from ${item.status} to ${newStatus}`)
  }

  const updated: WatchlistItem = { ...item, status: newStatus, updatedAt: now, deviceId }

  if (newStatus === 'in_progress' && item.startedAt === null) {
    updated.startedAt = now
  }
  if (newStatus === 'watched') {
    updated.finishedAt = now
    updated.quitAt = null
  }
  if (newStatus === 'quit') {
    updated.quitAt = now
    updated.finishedAt = null
  }
  if (newStatus === 'planned') {
    updated.startedAt = null
    updated.finishedAt = null
    updated.quitAt = null
  }

  return updated
}
```

- [ ] **Step 4: Create `packages/core/src/index.ts`**

```typescript
export * from './types'
export * from './schemas'
export * from './status'
```

- [ ] **Step 5: Run — confirm pass**

Run: `pnpm --filter @mywatch/core test`
Expected: all tests PASS (schemas + status)

- [ ] **Step 6: Build and verify types compile**

Run: `pnpm --filter @mywatch/core build`
Expected: `dist/` created with `.js` and `.d.ts` files, no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/status.ts packages/core/src/index.ts packages/core/tests/status.test.ts
git commit -m "feat(core): status transition logic with timestamp management"
```

---

## Task 5: `packages/tmdb` — Scaffold + TMDB Types + Normalizer (TDD)

**Files:**
- Create: `packages/tmdb/package.json`
- Create: `packages/tmdb/tsconfig.json`
- Create: `packages/tmdb/src/types.ts`
- Create: `packages/tmdb/tests/normalize.test.ts`
- Create: `packages/tmdb/src/normalize.ts`

- [ ] **Step 1: Create `packages/tmdb/package.json`**

```json
{
  "name": "@mywatch/tmdb",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run --reporter=verbose"
  },
  "dependencies": {
    "@mywatch/core": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `packages/tmdb/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `packages/tmdb/src/types.ts`**

```typescript
export interface TmdbGenre {
  id: number
  name: string
}

export interface TmdbMovieResult {
  id: number
  media_type: 'movie'
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  genre_ids: number[]
  vote_average: number
  vote_count: number
}

export interface TmdbTvResult {
  id: number
  media_type: 'tv'
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  genre_ids: number[]
  vote_average: number
  vote_count: number
}

export type TmdbSearchResult = TmdbMovieResult | TmdbTvResult

export interface TmdbMovieDetail {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  genres: TmdbGenre[]
  vote_average: number
  vote_count: number
  runtime: number | null
  status: string
}

export interface TmdbTvDetail {
  id: number
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  genres: TmdbGenre[]
  vote_average: number
  vote_count: number
  episode_run_time: number[]
  number_of_seasons: number
  status: string
}

export interface TmdbPagedResponse<T> {
  results: T[]
  page: number
  total_pages: number
  total_results: number
}
```

- [ ] **Step 4: Write failing tests for normalizer**

```typescript
// packages/tmdb/tests/normalize.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeMovie, normalizeTv } from '../src/normalize'
import type { TmdbMovieDetail, TmdbTvDetail } from '../src/types'

const movie: TmdbMovieDetail = {
  id: 603,
  title: 'The Matrix',
  overview: 'A hacker discovers reality.',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  release_date: '1999-03-31',
  genres: [{ id: 28, name: 'Action' }],
  vote_average: 8.7,
  vote_count: 24000,
  runtime: 136,
  status: 'Released',
}

const tvShow: TmdbTvDetail = {
  id: 1396,
  name: 'Breaking Bad',
  overview: 'A chemistry teacher turns to crime.',
  poster_path: '/bb.jpg',
  backdrop_path: null,
  first_air_date: '2008-01-20',
  genres: [{ id: 18, name: 'Drama' }],
  vote_average: 9.5,
  vote_count: 12000,
  episode_run_time: [45, 47],
  number_of_seasons: 5,
  status: 'Ended',
}

describe('normalizeMovie', () => {
  it('maps id to tmdbId', () => {
    expect(normalizeMovie(movie).tmdbId).toBe(603)
  })

  it('sets mediaType to movie', () => {
    expect(normalizeMovie(movie).mediaType).toBe('movie')
  })

  it('maps runtime directly', () => {
    expect(normalizeMovie(movie).runtime).toBe(136)
  })

  it('sets seasonsCount to null', () => {
    expect(normalizeMovie(movie).seasonsCount).toBeNull()
  })

  it('maps showStatus', () => {
    expect(normalizeMovie(movie).showStatus).toBe('Released')
  })
})

describe('normalizeTv', () => {
  it('maps id to tmdbId', () => {
    expect(normalizeTv(tvShow).tmdbId).toBe(1396)
  })

  it('uses name as title', () => {
    expect(normalizeTv(tvShow).title).toBe('Breaking Bad')
  })

  it('averages episode_run_time', () => {
    expect(normalizeTv(tvShow).runtime).toBe(46) // Math.round((45+47)/2)
  })

  it('sets seasonsCount', () => {
    expect(normalizeTv(tvShow).seasonsCount).toBe(5)
  })

  it('uses first_air_date as releaseDate', () => {
    expect(normalizeTv(tvShow).releaseDate).toBe('2008-01-20')
  })

  it('handles empty episode_run_time as null runtime', () => {
    const noRuntime = { ...tvShow, episode_run_time: [] }
    expect(normalizeTv(noRuntime).runtime).toBeNull()
  })
})
```

- [ ] **Step 5: Run — confirm failure**

Run: `pnpm --filter @mywatch/tmdb test`
Expected: `Cannot find module '../src/normalize'`

- [ ] **Step 6: Implement `packages/tmdb/src/normalize.ts`**

```typescript
import type { MediaCache } from '@mywatch/core'
import type { TmdbMovieDetail, TmdbTvDetail } from './types'

export function normalizeMovie(movie: TmdbMovieDetail): MediaCache {
  return {
    tmdbId: movie.id,
    mediaType: 'movie',
    title: movie.title,
    overview: movie.overview,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    releaseDate: movie.release_date || null,
    genres: movie.genres,
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    runtime: movie.runtime,
    seasonsCount: null,
    showStatus: movie.status,
    cachedAt: new Date().toISOString(),
  }
}

export function normalizeTv(show: TmdbTvDetail): MediaCache {
  const avgRuntime =
    show.episode_run_time.length > 0
      ? Math.round(
          show.episode_run_time.reduce((a, b) => a + b, 0) / show.episode_run_time.length,
        )
      : null

  return {
    tmdbId: show.id,
    mediaType: 'tv',
    title: show.name,
    overview: show.overview,
    posterPath: show.poster_path,
    backdropPath: show.backdrop_path,
    releaseDate: show.first_air_date || null,
    genres: show.genres,
    voteAverage: show.vote_average,
    voteCount: show.vote_count,
    runtime: avgRuntime,
    seasonsCount: show.number_of_seasons,
    showStatus: show.status,
    cachedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 7: Run — confirm pass**

Run: `pnpm --filter @mywatch/tmdb test`
Expected: all 11 tests PASS

- [ ] **Step 8: Commit**

```bash
git add packages/tmdb
git commit -m "feat(tmdb): package scaffold, TMDB types, and normalizer"
```

---

## Task 6: `packages/tmdb` — TmdbClient + Cache Staleness (TDD)

**Files:**
- Create: `packages/tmdb/tests/client.test.ts`
- Create: `packages/tmdb/src/client.ts`
- Create: `packages/tmdb/tests/cache.test.ts`
- Create: `packages/tmdb/src/cache.ts`
- Create: `packages/tmdb/src/index.ts`

- [ ] **Step 1: Write failing tests for TmdbClient**

```typescript
// packages/tmdb/tests/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TmdbClient } from '../src/client'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function mockFail(status: number) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Not Found',
  })
}

const client = new TmdbClient({ apiKey: 'test-key' })

describe('TmdbClient.search', () => {
  it('calls /search/multi with query param', async () => {
    mockOk({ results: [] })
    await client.search('matrix')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/multi'),
    )
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('query=matrix'),
    )
  })

  it('filters out non-movie/tv results (e.g. persons)', async () => {
    mockOk({
      results: [
        { id: 1, media_type: 'movie', title: 'A', overview: '', poster_path: null, backdrop_path: null, release_date: '', genre_ids: [], vote_average: 0, vote_count: 0 },
        { id: 2, media_type: 'person', name: 'Actor', profile_path: null },
      ],
    })
    const results = await client.search('matrix')
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe(1)
  })

  it('calls /search/movie when mediaType is movie', async () => {
    mockOk({ results: [] })
    await client.search('matrix', 'movie')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/movie'),
    )
  })

  it('calls /search/tv when mediaType is tv', async () => {
    mockOk({ results: [] })
    await client.search('breaking', 'tv')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/tv'),
    )
  })
})

describe('TmdbClient.getMovie', () => {
  it('calls /movie/:id', async () => {
    mockOk({ id: 603, title: 'The Matrix', overview: '', poster_path: null, backdrop_path: null, release_date: '', genres: [], vote_average: 0, vote_count: 0, runtime: 136, status: 'Released' })
    await client.getMovie(603)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/movie/603'))
  })

  it('throws on non-ok response', async () => {
    mockFail(404)
    await expect(client.getMovie(9999)).rejects.toThrow('TMDB /movie/9999 failed: 404')
  })
})

describe('TmdbClient.getTrending', () => {
  it('defaults to week window', async () => {
    mockOk({ results: [] })
    await client.getTrending()
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/trending/all/week'))
  })
})
```

- [ ] **Step 2: Run — confirm failure**

Run: `pnpm --filter @mywatch/tmdb test`
Expected: `Cannot find module '../src/client'`

- [ ] **Step 3: Implement `packages/tmdb/src/client.ts`**

```typescript
import type { MediaType } from '@mywatch/core'
import type {
  TmdbSearchResult,
  TmdbMovieDetail,
  TmdbTvDetail,
  TmdbPagedResponse,
} from './types'

export interface TmdbClientConfig {
  apiKey: string
  baseUrl?: string
}

export class TmdbClient {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor(config: TmdbClientConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl ?? 'https://api.themoviedb.org/3'
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    url.searchParams.set('api_key', this.apiKey)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`TMDB ${path} failed: ${res.status} ${res.statusText}`)
    }
    return res.json() as Promise<T>
  }

  async search(query: string, mediaType?: MediaType): Promise<TmdbSearchResult[]> {
    if (mediaType === 'movie') {
      const data = await this.get<TmdbPagedResponse<TmdbMovieDetail>>('/search/movie', { query })
      return data.results.map((r) => ({ ...r, media_type: 'movie' as const }))
    }
    if (mediaType === 'tv') {
      const data = await this.get<TmdbPagedResponse<TmdbTvDetail>>('/search/tv', { query })
      return data.results.map((r) => ({ ...r, media_type: 'tv' as const }))
    }
    const data = await this.get<TmdbPagedResponse<TmdbSearchResult>>('/search/multi', { query })
    return data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
  }

  async getMovie(tmdbId: number): Promise<TmdbMovieDetail> {
    return this.get<TmdbMovieDetail>(`/movie/${tmdbId}`)
  }

  async getTv(tmdbId: number): Promise<TmdbTvDetail> {
    return this.get<TmdbTvDetail>(`/tv/${tmdbId}`)
  }

  async getTrending(timeWindow: 'day' | 'week' = 'week'): Promise<TmdbSearchResult[]> {
    const data = await this.get<TmdbPagedResponse<TmdbSearchResult>>(
      `/trending/all/${timeWindow}`,
    )
    return data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
  }

  async getRecommendations(tmdbId: number, mediaType: MediaType): Promise<TmdbSearchResult[]> {
    const path =
      mediaType === 'movie' ? `/movie/${tmdbId}/recommendations` : `/tv/${tmdbId}/recommendations`
    const data = await this.get<TmdbPagedResponse<TmdbSearchResult>>(path)
    return data.results.map((r) => ({ ...r, media_type: mediaType }))
  }

  async getTopRated(mediaType: MediaType): Promise<TmdbSearchResult[]> {
    const path = mediaType === 'movie' ? '/movie/top_rated' : '/tv/top_rated'
    const data = await this.get<TmdbPagedResponse<TmdbSearchResult>>(path)
    return data.results.map((r) => ({ ...r, media_type: mediaType }))
  }
}
```

- [ ] **Step 4: Write failing tests for cache staleness**

```typescript
// packages/tmdb/tests/cache.test.ts
import { describe, it, expect } from 'vitest'
import { isStale } from '../src/cache'
import type { MediaCache } from '@mywatch/core'

const base: MediaCache = {
  tmdbId: 603,
  mediaType: 'movie',
  title: 'The Matrix',
  overview: '',
  posterPath: null,
  backdropPath: null,
  releaseDate: null,
  genres: [],
  voteAverage: 8.7,
  voteCount: 1000,
  runtime: 136,
  seasonsCount: null,
  showStatus: null,
  cachedAt: '',
}

describe('isStale', () => {
  it('returns false when cached less than 7 days ago', () => {
    const now = new Date('2026-06-10T00:00:00Z')
    const cache = { ...base, cachedAt: '2026-06-05T00:00:00.000Z' } // 5 days ago
    expect(isStale(cache, now)).toBe(false)
  })

  it('returns true when cached more than 7 days ago', () => {
    const now = new Date('2026-06-10T00:00:00Z')
    const cache = { ...base, cachedAt: '2026-06-01T00:00:00.000Z' } // 9 days ago
    expect(isStale(cache, now)).toBe(true)
  })

  it('returns false at exactly 7 days', () => {
    const now = new Date('2026-06-10T00:00:00Z')
    const cache = { ...base, cachedAt: '2026-06-03T00:00:00.000Z' } // exactly 7 days
    expect(isStale(cache, now)).toBe(false)
  })
})
```

- [ ] **Step 5: Implement `packages/tmdb/src/cache.ts`**

```typescript
import type { MediaCache } from '@mywatch/core'

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export function isStale(cache: MediaCache, now = new Date()): boolean {
  const cachedAt = new Date(cache.cachedAt)
  return now.getTime() - cachedAt.getTime() > STALE_AFTER_MS
}
```

- [ ] **Step 6: Create `packages/tmdb/src/index.ts`**

```typescript
export * from './types'
export * from './normalize'
export * from './client'
export * from './cache'
```

- [ ] **Step 7: Run — confirm all pass**

Run: `pnpm --filter @mywatch/tmdb test`
Expected: all tests PASS (normalize + client + cache)

- [ ] **Step 8: Build**

Run: `pnpm --filter @mywatch/tmdb build`
Expected: `dist/` created, no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/tmdb/src/client.ts packages/tmdb/src/cache.ts packages/tmdb/src/index.ts packages/tmdb/tests/client.test.ts packages/tmdb/tests/cache.test.ts
git commit -m "feat(tmdb): TmdbClient and cache staleness check"
```

---

## Task 7: `packages/sync` — Scaffold + Types + Device ID (TDD)

**Files:**
- Create: `packages/sync/package.json`
- Create: `packages/sync/tsconfig.json`
- Create: `packages/sync/src/types.ts`
- Create: `packages/sync/tests/device.test.ts`
- Create: `packages/sync/src/device.ts`

- [ ] **Step 1: Create `packages/sync/package.json`**

```json
{
  "name": "@mywatch/sync",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run --reporter=verbose"
  },
  "dependencies": {
    "@mywatch/core": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `packages/sync/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `packages/sync/src/types.ts`**

```typescript
import type { WatchlistItem } from '@mywatch/core'

export interface SyncPushPayload {
  items: WatchlistItem[]
}

export interface SyncPullResponse {
  items: WatchlistItem[]
  pulledAt: string
}

export interface SyncMeta {
  lastPushedAt: string | null
  lastPulledAt: string | null
  pendingCount: number
}

export interface DeviceIdStorage {
  get(): string | null
  set(id: string): void
}
```

- [ ] **Step 4: Write failing tests for device ID**

```typescript
// packages/sync/tests/device.test.ts
import { describe, it, expect } from 'vitest'
import { getOrCreateDeviceId } from '../src/device'
import type { DeviceIdStorage } from '../src/types'

function makeStorage(initial: string | null = null): DeviceIdStorage & { value: string | null } {
  const store = { value: initial }
  return {
    get value() { return store.value },
    set value(v) { store.value = v },
    get: () => store.value,
    set: (id: string) => { store.value = id },
  }
}

describe('getOrCreateDeviceId', () => {
  it('returns existing id from storage', () => {
    const storage = makeStorage('device-existing-123')
    expect(getOrCreateDeviceId(storage)).toBe('device-existing-123')
  })

  it('creates and stores a new id when storage is empty', () => {
    const storage = makeStorage(null)
    const id = getOrCreateDeviceId(storage)
    expect(id).toMatch(/^device-/)
    expect(storage.value).toBe(id)
  })

  it('returns the same id on subsequent calls', () => {
    const storage = makeStorage(null)
    const id1 = getOrCreateDeviceId(storage)
    const id2 = getOrCreateDeviceId(storage)
    expect(id1).toBe(id2)
  })

  it('generates unique ids for different empty storages', () => {
    const id1 = getOrCreateDeviceId(makeStorage(null))
    const id2 = getOrCreateDeviceId(makeStorage(null))
    expect(id1).not.toBe(id2)
  })
})
```

- [ ] **Step 5: Run — confirm failure**

Run: `pnpm --filter @mywatch/sync test`
Expected: `Cannot find module '../src/device'`

- [ ] **Step 6: Implement `packages/sync/src/device.ts`**

```typescript
import type { DeviceIdStorage } from './types'

export function getOrCreateDeviceId(storage: DeviceIdStorage): string {
  const existing = storage.get()
  if (existing !== null) return existing
  const id = generateDeviceId()
  storage.set(id)
  return id
}

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `device-${crypto.randomUUID()}`
  }
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
```

- [ ] **Step 7: Run — confirm pass**

Run: `pnpm --filter @mywatch/sync test`
Expected: all 4 device tests PASS

- [ ] **Step 8: Commit**

```bash
git add packages/sync
git commit -m "feat(sync): package scaffold, sync types, and device ID logic"
```

---

## Task 8: `packages/sync` — Conflict Resolution (TDD)

**Files:**
- Create: `packages/sync/tests/conflict.test.ts`
- Create: `packages/sync/src/conflict.ts`
- Create: `packages/sync/src/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/sync/tests/conflict.test.ts
import { describe, it, expect } from 'vitest'
import { resolveConflict, mergeItems } from '../src/conflict'
import type { WatchlistItem } from '@mywatch/core'

function makeItem(overrides: Partial<WatchlistItem> = {}): WatchlistItem {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    tmdbId: 1396,
    mediaType: 'tv',
    status: 'planned',
    progressEpisode: null,
    progressSeason: null,
    rating: null,
    notes: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    quitAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deviceId: 'device-a',
    deletedAt: null,
    ...overrides,
  }
}

describe('resolveConflict', () => {
  it('remote wins when remote is newer', () => {
    const local = makeItem({ updatedAt: '2026-06-01T10:00:00.000Z', status: 'planned' })
    const remote = makeItem({ updatedAt: '2026-06-01T11:00:00.000Z', status: 'watched' })
    expect(resolveConflict(local, remote).status).toBe('watched')
  })

  it('local wins when local is newer', () => {
    const local = makeItem({ updatedAt: '2026-06-01T12:00:00.000Z', status: 'in_progress' })
    const remote = makeItem({ updatedAt: '2026-06-01T11:00:00.000Z', status: 'planned' })
    expect(resolveConflict(local, remote).status).toBe('in_progress')
  })

  it('local wins on timestamp tie', () => {
    const ts = '2026-06-01T10:00:00.000Z'
    const local = makeItem({ updatedAt: ts, status: 'in_progress', deviceId: 'device-local' })
    const remote = makeItem({ updatedAt: ts, status: 'planned', deviceId: 'device-remote' })
    expect(resolveConflict(local, remote).deviceId).toBe('device-local')
  })
})

describe('mergeItems', () => {
  it('includes items only in remote', () => {
    const remote = makeItem({ id: 'aaa-0000-0000-0000-000000000001' })
    const result = mergeItems([], [remote])
    expect(result).toHaveLength(1)
  })

  it('includes items only in local', () => {
    const local = makeItem({ id: 'aaa-0000-0000-0000-000000000001' })
    const result = mergeItems([local], [])
    expect(result).toHaveLength(1)
  })

  it('resolves conflicts for same id', () => {
    const local = makeItem({ id: 'aaa-0000-0000-0000-000000000001', updatedAt: '2026-06-01T10:00:00.000Z', status: 'planned' })
    const remote = makeItem({ id: 'aaa-0000-0000-0000-000000000001', updatedAt: '2026-06-01T12:00:00.000Z', status: 'watched' })
    const result = mergeItems([local], [remote])
    expect(result).toHaveLength(1)
    expect(result[0]?.status).toBe('watched')
  })

  it('excludes soft-deleted items from result', () => {
    const deleted = makeItem({
      id: 'aaa-0000-0000-0000-000000000001',
      deletedAt: '2026-06-01T10:00:00.000Z',
    })
    const result = mergeItems([deleted], [])
    expect(result).toHaveLength(0)
  })

  it('merges unrelated items from both sides', () => {
    const local = makeItem({ id: 'aaa-0000-0000-0000-000000000001' })
    const remote = makeItem({ id: 'bbb-0000-0000-0000-000000000002' })
    const result = mergeItems([local], [remote])
    expect(result).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run — confirm failure**

Run: `pnpm --filter @mywatch/sync test`
Expected: `Cannot find module '../src/conflict'`

- [ ] **Step 3: Implement `packages/sync/src/conflict.ts`**

```typescript
import type { WatchlistItem } from '@mywatch/core'

export function resolveConflict(local: WatchlistItem, remote: WatchlistItem): WatchlistItem {
  const localTime = new Date(local.updatedAt).getTime()
  const remoteTime = new Date(remote.updatedAt).getTime()
  return remoteTime > localTime ? remote : local
}

export function mergeItems(
  localItems: WatchlistItem[],
  remoteItems: WatchlistItem[],
): WatchlistItem[] {
  const map = new Map<string, WatchlistItem>()

  for (const item of localItems) {
    map.set(item.id, item)
  }

  for (const remote of remoteItems) {
    const local = map.get(remote.id)
    map.set(remote.id, local === undefined ? remote : resolveConflict(local, remote))
  }

  return Array.from(map.values()).filter((item) => item.deletedAt === null)
}
```

- [ ] **Step 4: Create `packages/sync/src/index.ts`**

```typescript
export * from './types'
export * from './device'
export * from './conflict'
```

- [ ] **Step 5: Run — confirm all pass**

Run: `pnpm --filter @mywatch/sync test`
Expected: all 9 tests PASS (device + conflict)

- [ ] **Step 6: Build all three packages**

Run: `pnpm build:packages`
Expected: `dist/` created in `core`, `tmdb`, `sync` — no errors.

- [ ] **Step 7: Final root test run**

Run: `pnpm test`
Expected: all tests across all packages PASS, zero failures.

- [ ] **Step 8: Commit**

```bash
git add packages/sync/src/conflict.ts packages/sync/src/index.ts packages/sync/tests/conflict.test.ts
git commit -m "feat(sync): conflict resolution and barrel export — Plan 1 complete"
```

---

## Summary

Plan 1 produces three fully-tested, built TypeScript packages:

| Package | Exports |
|---|---|
| `@mywatch/core` | `MediaType`, `WatchStatus`, `User`, `WatchlistItem`, `MediaCache`, Zod schemas, `canTransition`, `applyStatusChange` |
| `@mywatch/tmdb` | `TmdbClient`, `normalizeMovie`, `normalizeTv`, `isStale`, all TMDB response types |
| `@mywatch/sync` | `resolveConflict`, `mergeItems`, `getOrCreateDeviceId`, `SyncPushPayload`, `SyncPullResponse`, `SyncMeta`, `DeviceIdStorage` |

Plan 2 builds the Fastify API that imports all three.
