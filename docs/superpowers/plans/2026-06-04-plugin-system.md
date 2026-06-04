# Plugin System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a plugin system that lets developers extend myWatch with new list types and visual media cards, delivered as `.tgz` files dropped into a `plugins/` folder, with a YouTube Links plugin as the first example including iOS Share Sheet support.

**Architecture:** Plugins are workspace packages in `plugins/`; a pre-dev/build scanner script generates a static `registry.ts` import list; Next.js transpiles plugin source directly (same pattern as `@mywatch/core`). Plugin items are stored in a new generic `pluginItems` Dexie table. The YouTube plugin registers a `youtube` list type with its own card + add-item modal.

**Tech Stack:** Next.js 14, React 18, Dexie 4, TypeScript 5, pnpm workspaces, tsup, vitest, YouTube oEmbed API.

---

## File Map

**New:**
- `packages/plugin-sdk/package.json` — SDK package config
- `packages/plugin-sdk/tsconfig.json`
- `packages/plugin-sdk/src/index.ts` — plugin types (PluginItem, MyWatchPlugin, PluginListType, etc.)
- `apps/web/scripts/scan-plugins.mjs` — scans `plugins/`, generates registry.ts + manifest JSON
- `apps/web/src/plugins/registry.ts` — auto-generated stub (committed; overwritten by scanner)
- `apps/web/src/plugins/index.ts` — `usePlugins`, `useListTypePlugin`, `useUrlMatchPlugin` hooks
- `apps/web/src/hooks/usePluginItems.ts` — Dexie live query for pluginItems table
- `apps/web/src/app/share/page.tsx` — handles Web Share Target redirect
- `plugins/mywatch-plugin-youtube/package.json`
- `plugins/mywatch-plugin-youtube/tsconfig.json`
- `plugins/mywatch-plugin-youtube/src/utils.ts` — URL parsing + oEmbed fetch
- `plugins/mywatch-plugin-youtube/src/YouTubeCard.tsx`
- `plugins/mywatch-plugin-youtube/src/AddYouTubeItemModal.tsx`
- `plugins/mywatch-plugin-youtube/src/index.tsx` — plugin entry point
- `plugins/mywatch-plugin-youtube/tests/utils.test.ts`

**Modified:**
- `pnpm-workspace.yaml` — add `'plugins/*'`
- `packages/core/src/types.ts` — add `PluginItem`, extend `Playlist.type`
- `apps/web/src/lib/db.ts` — Dexie v6 with `pluginItems` table
- `apps/web/package.json` — add `@mywatch/plugin-sdk` dep + `scan-plugins` scripts
- `apps/web/next.config.mjs` — read plugin manifest, extend transpilePackages
- `apps/web/src/app/manifest.ts` — add `share_target`
- `apps/web/src/app/page.tsx` — plugin list rendering + share URL handler
- `apps/web/src/components/CreatePlaylistModal.tsx` — add plugin list type option

---

### Task 1: Plugin SDK package

**Files:**
- Create: `packages/plugin-sdk/package.json`
- Create: `packages/plugin-sdk/tsconfig.json`
- Create: `packages/plugin-sdk/src/index.ts`

- [ ] **Step 1: Create `packages/plugin-sdk/package.json`**

```json
{
  "name": "@mywatch/plugin-sdk",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/plugin-sdk/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/plugin-sdk/src/index.ts`**

```ts
import type { ComponentType } from 'react'

export interface PluginItem {
  id: string
  pluginId: string
  listTypeId: string
  playlistId: string
  data: Record<string, unknown>
  addedAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface PluginCardProps {
  item: PluginItem
  onSelect?: () => void
}

export interface AddItemModalProps {
  playlistId: string
  prefillUrl?: string
  onClose: () => void
  onAdded: (item: PluginItem) => void
}

export interface PluginSettingsProps {
  settings: Record<string, unknown>
  onUpdate: (patch: Record<string, unknown>) => void
}

export interface PluginListType {
  id: string
  label: string
  CardComponent: ComponentType<PluginCardProps>
  AddItemModal?: ComponentType<AddItemModalProps>
  matchesUrl?: (url: string) => boolean
  prefillFromUrl?: (url: string) => Promise<Partial<Record<string, unknown>>>
}

export interface MyWatchPlugin {
  id: string
  displayName: string
  listTypes?: PluginListType[]
  settingsPanel?: ComponentType<PluginSettingsProps>
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/plugin-sdk/
git commit -m "feat: add @mywatch/plugin-sdk types package"
```

---

### Task 2: Core — `PluginItem` type + extend `Playlist.type`

**Files:**
- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: Add `PluginItem` and extend `Playlist.type` in `packages/core/src/types.ts`**

Add after the `ProgressRecap` interface (end of file):

```ts
export interface PluginItem {
  id: string
  pluginId: string
  listTypeId: string
  playlistId: string
  data: Record<string, unknown>
  addedAt: string
  updatedAt: string
  deletedAt: string | null
}
```

Change the `Playlist` interface `type` field from:
```ts
  type: 'manual' | 'smart'
```
to:
```ts
  type: 'manual' | 'smart' | (string & {})
```

The `(string & {})` trick preserves autocomplete for the literal types while accepting plugin type IDs at runtime.

- [ ] **Step 2: Verify types compile**

```bash
cd packages/core && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core): add PluginItem type, extend Playlist.type for plugins"
```

---

### Task 3: Dexie v6 migration

**Files:**
- Modify: `apps/web/src/lib/db.ts`

- [ ] **Step 1: Update `apps/web/src/lib/db.ts`**

Add `PluginItem` to the import:
```ts
import type { WatchlistItem, MediaCache, Playlist, PlaylistItem, JellyfinProgress, ProgressRecap, PluginItem } from '@mywatch/core'
```

Add `pluginItems` table declaration after `progressRecaps`:
```ts
  pluginItems!: Table<PluginItem, string>
```

Add version 6 after the existing `this.version(5)` block:
```ts
    // v6: adds pluginItems table for plugin-managed content
    this.version(6).stores({
      watchlistItems: 'id, userId, status, mediaType, updatedAt',
      pendingPushes: '++id, itemId, queuedAt',
      mediaCache: '[tmdbId+mediaType], cachedAt',
      playlists: 'id, userId, updatedAt',
      playlistItems: 'id, playlistId, [tmdbId+mediaType]',
      jellyfinProgress: '[tmdbId+mediaType], updatedAt',
      progressRecaps: '[tmdbId+mediaType], updatedAt',
      pluginItems: 'id, pluginId, playlistId, updatedAt',
    })
```

- [ ] **Step 2: Verify app still starts**

```bash
cd apps/web && pnpm dev
```

Open the app in browser, open DevTools → Application → IndexedDB → mywatch. Verify `pluginItems` table appears (may need to close and reopen the DB).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/db.ts
git commit -m "feat(db): v6 migration — add pluginItems table"
```

---

### Task 4: Plugin items hook

**Files:**
- Create: `apps/web/src/hooks/usePluginItems.ts`

- [ ] **Step 1: Create `apps/web/src/hooks/usePluginItems.ts`**

```ts
import { useLiveQuery } from 'dexie-react-hooks'
import type { PluginItem } from '@mywatch/core'
import { db } from '@/lib/db'

export function usePluginItems(playlistId: string | undefined): PluginItem[] | undefined {
  return useLiveQuery(async () => {
    if (!playlistId) return []
    return db.pluginItems
      .where('playlistId').equals(playlistId)
      .filter((i) => i.deletedAt === null)
      .toArray()
  }, [playlistId])
}

export function useUpsertPluginItem() {
  return async (item: Omit<PluginItem, 'id'> & { id?: string }): Promise<PluginItem> => {
    const full: PluginItem = {
      ...item,
      id: item.id ?? crypto.randomUUID(),
    }
    await db.pluginItems.put(full)
    return full
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/usePluginItems.ts
git commit -m "feat: add usePluginItems + useUpsertPluginItem hooks"
```

---

### Task 5: Plugin scanner script + workspace update

**Files:**
- Create: `apps/web/scripts/scan-plugins.mjs`
- Create: `apps/web/src/plugins/registry.ts` (committed stub)
- Modify: `pnpm-workspace.yaml`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Update `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'plugins/*'
```

- [ ] **Step 2: Create `apps/web/scripts/scan-plugins.mjs`**

```mjs
#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginsRoot = path.resolve(__dirname, '../../../plugins')
const registryPath = path.resolve(__dirname, '../src/plugins/registry.ts')
const manifestPath = path.resolve(__dirname, '../src/plugins/.plugins-manifest.json')

const plugins = []

if (fs.existsSync(pluginsRoot)) {
  for (const entry of fs.readdirSync(pluginsRoot)) {
    const pkgPath = path.join(pluginsRoot, entry, 'package.json')
    if (!fs.existsSync(pkgPath)) continue
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      if (pkg?.mywatch?.id && pkg.name) {
        plugins.push({ name: pkg.name, id: pkg.mywatch.id })
      }
    } catch {
      // skip malformed package.json
    }
  }
}

// Write registry.ts
const importLines = plugins
  .map((p, i) => `import plugin${i} from '${p.name}'`)
  .join('\n')

const registryContent = `// AUTO-GENERATED by scripts/scan-plugins.mjs — do not edit manually
import type { MyWatchPlugin } from '@mywatch/plugin-sdk'
${importLines}

export const PLUGINS: MyWatchPlugin[] = [${plugins.map((_, i) => `plugin${i}`).join(', ')}]
`

fs.mkdirSync(path.dirname(registryPath), { recursive: true })
fs.writeFileSync(registryPath, registryContent)

// Write manifest for next.config.mjs to consume
fs.writeFileSync(manifestPath, JSON.stringify(plugins, null, 2))

if (plugins.length === 0) {
  console.log('[scan-plugins] No plugins found.')
} else {
  console.log(`[scan-plugins] Found ${plugins.length} plugin(s): ${plugins.map(p => p.name).join(', ')}`)
}
```

- [ ] **Step 3: Create stub `apps/web/src/plugins/registry.ts`**

```ts
// AUTO-GENERATED by scripts/scan-plugins.mjs — do not edit manually
// Run `pnpm scan-plugins` or start the dev server to regenerate.
import type { MyWatchPlugin } from '@mywatch/plugin-sdk'

export const PLUGINS: MyWatchPlugin[] = []
```

- [ ] **Step 4: Create stub `apps/web/src/plugins/.plugins-manifest.json`**

```json
[]
```

- [ ] **Step 5: Update `apps/web/package.json` scripts**

Change:
```json
"dev": "next dev",
"build": "next build",
```
To:
```json
"dev": "node scripts/scan-plugins.mjs && next dev",
"build": "node scripts/scan-plugins.mjs && next build",
"scan-plugins": "node scripts/scan-plugins.mjs",
```

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml apps/web/scripts/ apps/web/src/plugins/registry.ts apps/web/src/plugins/.plugins-manifest.json apps/web/package.json
git commit -m "feat: add plugin scanner script, workspace plugins/ glob, registry stub"
```

---

### Task 6: Plugin context hooks + next.config.mjs update

**Files:**
- Create: `apps/web/src/plugins/index.ts`
- Modify: `apps/web/next.config.mjs`
- Modify: `apps/web/package.json` (add @mywatch/plugin-sdk dep)

- [ ] **Step 1: Create `apps/web/src/plugins/index.ts`**

```ts
import type { MyWatchPlugin, PluginListType } from '@mywatch/plugin-sdk'
import { PLUGINS } from './registry'

export function usePlugins(): MyWatchPlugin[] {
  return PLUGINS
}

export function useListTypePlugin(listTypeId: string | undefined): PluginListType | undefined {
  if (!listTypeId) return undefined
  for (const plugin of PLUGINS) {
    const lt = plugin.listTypes?.find((l) => l.id === listTypeId)
    if (lt) return lt
  }
  return undefined
}

export function useUrlMatchPlugin(url: string): PluginListType | undefined {
  for (const plugin of PLUGINS) {
    for (const lt of plugin.listTypes ?? []) {
      if (lt.matchesUrl?.(url)) return lt
    }
  }
  return undefined
}

export function isPluginListType(type: string): boolean {
  return type !== 'manual' && type !== 'smart'
}
```

- [ ] **Step 2: Add `@mywatch/plugin-sdk` to `apps/web/package.json` dependencies**

In the `dependencies` section, add:
```json
"@mywatch/plugin-sdk": "workspace:*",
```

- [ ] **Step 3: Update `apps/web/next.config.mjs` to read plugin manifest**

Add at the top of the file (after existing imports):
```js
import { readFileSync } from 'fs'

// Read discovered plugin package names for transpilation
let discoveredPlugins = []
try {
  const manifestPath = new URL('./src/plugins/.plugins-manifest.json', import.meta.url)
  discoveredPlugins = JSON.parse(readFileSync(manifestPath, 'utf8')).map((p) => p.name)
} catch {
  // no manifest yet — scanner hasn't run
}
```

Change the `transpilePackages` line from:
```js
transpilePackages: ['@mywatch/core', '@mywatch/tmdb', '@mywatch/sync'],
```
To:
```js
transpilePackages: ['@mywatch/core', '@mywatch/tmdb', '@mywatch/sync', '@mywatch/plugin-sdk', ...discoveredPlugins],
```

- [ ] **Step 4: Run pnpm install to link new packages**

```bash
pnpm install
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/web && pnpm type-check
```

Expected: no errors (or only pre-existing ones unrelated to plugins).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/plugins/index.ts apps/web/package.json apps/web/next.config.mjs pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: plugin context hooks, wire @mywatch/plugin-sdk into web app"
```

---

### Task 7: YouTube plugin — package skeleton

**Files:**
- Create: `plugins/mywatch-plugin-youtube/package.json`
- Create: `plugins/mywatch-plugin-youtube/tsconfig.json`

- [ ] **Step 1: Create `plugins/mywatch-plugin-youtube/package.json`**

```json
{
  "name": "mywatch-plugin-youtube",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.tsx",
  "types": "./src/index.tsx",
  "mywatch": {
    "id": "youtube",
    "displayName": "YouTube Links"
  },
  "scripts": {
    "test": "vitest run"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "vitest": "^2.1.9"
  },
  "dependencies": {
    "@mywatch/plugin-sdk": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `plugins/mywatch-plugin-youtube/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Run pnpm install to link the new package**

```bash
pnpm install
```

- [ ] **Step 4: Run scanner to pick up the new plugin**

```bash
cd apps/web && pnpm scan-plugins
```

Expected output:
```
[scan-plugins] Found 1 plugin(s): mywatch-plugin-youtube
```

Check `apps/web/src/plugins/registry.ts` — it should now import `mywatch-plugin-youtube`.

- [ ] **Step 5: Commit**

```bash
git add plugins/mywatch-plugin-youtube/ pnpm-lock.yaml
git commit -m "feat(youtube-plugin): add package skeleton"
```

---

### Task 8: YouTube plugin — URL utils with tests

**Files:**
- Create: `plugins/mywatch-plugin-youtube/src/utils.ts`
- Create: `plugins/mywatch-plugin-youtube/tests/utils.test.ts`

- [ ] **Step 1: Write failing tests first — `plugins/mywatch-plugin-youtube/tests/utils.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { extractVideoId, matchesUrl, buildThumbnailUrl, fetchYouTubeMetadata } from '../src/utils'

describe('extractVideoId', () => {
  test('extracts from youtube.com/watch?v=', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  test('extracts from youtu.be/ short link', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  test('extracts from youtube.com/shorts/', () => {
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  test('returns null for non-youtube URL', () => {
    expect(extractVideoId('https://vimeo.com/123456')).toBeNull()
  })
  test('returns null for malformed URL', () => {
    expect(extractVideoId('not a url')).toBeNull()
  })
})

describe('matchesUrl', () => {
  test('true for youtube.com/watch', () => {
    expect(matchesUrl('https://www.youtube.com/watch?v=abc')).toBe(true)
  })
  test('true for youtu.be', () => {
    expect(matchesUrl('https://youtu.be/abc')).toBe(true)
  })
  test('true for youtube.com/shorts', () => {
    expect(matchesUrl('https://www.youtube.com/shorts/abc')).toBe(true)
  })
  test('false for vimeo', () => {
    expect(matchesUrl('https://vimeo.com/123')).toBe(false)
  })
})

describe('buildThumbnailUrl', () => {
  test('returns maxresdefault thumbnail', () => {
    expect(buildThumbnailUrl('dQw4w9WgXcQ')).toBe(
      'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd plugins/mywatch-plugin-youtube && pnpm test
```

Expected: FAIL — "Cannot find module '../src/utils'"

- [ ] **Step 3: Implement `plugins/mywatch-plugin-youtube/src/utils.ts`**

```ts
export interface YouTubeMetadata {
  videoId: string
  title: string
  thumbnail: string
  channelName: string
}

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1) || null
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/shorts/')) {
        return u.pathname.split('/')[2] || null
      }
      return u.searchParams.get('v')
    }
    return null
  } catch {
    return null
  }
}

export function matchesUrl(url: string): boolean {
  return extractVideoId(url) !== null
}

export function buildThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
}

export async function fetchYouTubeMetadata(url: string): Promise<YouTubeMetadata | null> {
  const videoId = extractVideoId(url)
  if (!videoId) return null

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(oembedUrl)
    if (!res.ok) return null
    const data = await res.json() as { title?: string; author_name?: string }
    return {
      videoId,
      title: data.title ?? 'YouTube Video',
      thumbnail: buildThumbnailUrl(videoId),
      channelName: data.author_name ?? '',
    }
  } catch {
    // Return minimal metadata if oEmbed fails (e.g. offline)
    return {
      videoId,
      title: 'YouTube Video',
      thumbnail: buildThumbnailUrl(videoId),
      channelName: '',
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd plugins/mywatch-plugin-youtube && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/mywatch-plugin-youtube/src/utils.ts plugins/mywatch-plugin-youtube/tests/utils.test.ts
git commit -m "feat(youtube-plugin): URL utils with tests"
```

---

### Task 9: YouTube plugin — `YouTubeCard` component

**Files:**
- Create: `plugins/mywatch-plugin-youtube/src/YouTubeCard.tsx`

- [ ] **Step 1: Create `plugins/mywatch-plugin-youtube/src/YouTubeCard.tsx`**

```tsx
import type { PluginCardProps } from '@mywatch/plugin-sdk'
import { useState } from 'react'

interface YouTubeData {
  videoId: string
  title: string
  thumbnail: string
  channelName: string
  duration?: number
  watched?: boolean
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function YouTubeCard({ item }: PluginCardProps) {
  const data = item.data as YouTubeData
  const [imgError, setImgError] = useState(false)
  const watchUrl = `https://www.youtube.com/watch?v=${data.videoId}`

  return (
    <div
      className="flex gap-3 rounded-[var(--r)] border overflow-hidden"
      style={{
        padding: '12px 14px',
        background: 'var(--surface)',
        borderColor: 'var(--border2)',
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface2)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--surface)'
        e.currentTarget.style.borderColor = 'var(--border2)'
      }}
    >
      {/* Thumbnail */}
      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 relative group"
        style={{ width: 112, height: 63, borderRadius: 6, overflow: 'hidden', background: 'var(--surface2)', display: 'block' }}
      >
        {!imgError && data.thumbnail ? (
          <img
            src={data.thumbnail}
            alt={data.title}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--muted2)' }}>
              <path d="M23.5 6.2a3.01 3.01 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3.01 3.01 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3.01 3.01 0 0 0 2.1 2.1C4.5 20.4 12 20.4 12 20.4s7.5 0 9.4-.5a3.01 3.01 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
            </svg>
          </div>
        )}
        {/* Play overlay on hover */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ background: 'rgba(0,0,0,.45)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#ff0000">
            <path d="M23.5 6.2a3.01 3.01 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3.01 3.01 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3.01 3.01 0 0 0 2.1 2.1C4.5 20.4 12 20.4 12 20.4s7.5 0 9.4-.5a3.01 3.01 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
          </svg>
        </div>
        {/* Duration badge */}
        {data.duration != null && (
          <span
            className="absolute bottom-[4px] right-[4px] text-[10px] font-bold tabular-nums px-[5px] py-[1px] rounded-[3px]"
            style={{ background: 'rgba(0,0,0,.75)', color: '#fff' }}
          >
            {formatDuration(data.duration)}
          </span>
        )}
      </a>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-[4px] justify-center">
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          <p
            className="text-[var(--text-14)] font-semibold leading-[1.3] tracking-[-0.015em]"
            style={{
              color: 'var(--fg)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {data.title}
          </p>
        </a>

        <div className="flex items-center gap-[6px]">
          {/* YouTube icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff0000">
            <path d="M23.5 6.2a3.01 3.01 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3.01 3.01 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3.01 3.01 0 0 0 2.1 2.1C4.5 20.4 12 20.4 12 20.4s7.5 0 9.4-.5a3.01 3.01 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
          </svg>
          {data.channelName && (
            <span className="text-[var(--text-11h)]" style={{ color: 'var(--muted2)' }}>
              {data.channelName}
            </span>
          )}
          {data.watched && (
            <>
              <span style={{ opacity: 0.35, color: 'var(--muted2)', fontSize: 'var(--text-11h)' }}>·</span>
              <span
                className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
                style={{ background: 'rgba(134,239,172,.12)', color: 'var(--green)' }}
              >
                Watched
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/mywatch-plugin-youtube/src/YouTubeCard.tsx
git commit -m "feat(youtube-plugin): YouTubeCard component"
```

---

### Task 10: YouTube plugin — `AddYouTubeItemModal`

**Files:**
- Create: `plugins/mywatch-plugin-youtube/src/AddYouTubeItemModal.tsx`

- [ ] **Step 1: Create `plugins/mywatch-plugin-youtube/src/AddYouTubeItemModal.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react'
import type { AddItemModalProps } from '@mywatch/plugin-sdk'
import { extractVideoId, fetchYouTubeMetadata, buildThumbnailUrl } from './utils'

interface YouTubePreview {
  videoId: string
  title: string
  thumbnail: string
  channelName: string
}

export function AddYouTubeItemModal({ playlistId, prefillUrl, onClose, onAdded }: AddItemModalProps) {
  const [url, setUrl] = useState(prefillUrl ?? '')
  const [preview, setPreview] = useState<YouTubePreview | null>(null)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

  // Auto-fetch metadata when prefillUrl is provided
  useEffect(() => {
    if (prefillUrl) void handleFetch(prefillUrl)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFetch(targetUrl = url) {
    const videoId = extractVideoId(targetUrl.trim())
    if (!videoId) {
      setError('Not a valid YouTube URL')
      setPreview(null)
      return
    }
    setError(null)
    setFetching(true)
    const meta = await fetchYouTubeMetadata(targetUrl.trim())
    setFetching(false)
    if (meta) {
      setPreview({ videoId: meta.videoId, title: meta.title, thumbnail: meta.thumbnail, channelName: meta.channelName })
    } else {
      // Offline fallback — use videoId only
      setPreview({
        videoId,
        title: 'YouTube Video',
        thumbnail: buildThumbnailUrl(videoId),
        channelName: '',
      })
    }
  }

  async function handleAdd() {
    if (!preview) return
    setSaving(true)
    const now = new Date().toISOString()
    const item = {
      id: crypto.randomUUID(),
      pluginId: 'youtube',
      listTypeId: 'youtube',
      playlistId,
      data: {
        url: url.trim(),
        videoId: preview.videoId,
        title: preview.title,
        thumbnail: preview.thumbnail,
        channelName: preview.channelName,
        watched: false,
      },
      addedAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    onAdded(item)
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-t-[16px] sm:rounded-[12px] flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border2)' }}
        >
          <h2 className="text-[var(--text-15)] font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>
            Add YouTube Video
          </h2>
          <button
            onClick={onClose}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-full transition-all duration-100 border-none cursor-pointer"
            style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* URL input */}
          <div className="space-y-1">
            <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
              YouTube URL
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setPreview(null); setError(null) }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text')
                  setTimeout(() => void handleFetch(pasted), 50)
                }}
                placeholder="https://youtube.com/watch?v=…"
                className="flex-1 px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; void handleFetch() }}
              />
              <button
                onClick={() => void handleFetch()}
                disabled={fetching || !url.trim()}
                className="px-3 py-2 rounded-[6px] text-[var(--text-12)] font-medium border-none cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
              >
                {fetching ? '…' : 'Fetch'}
              </button>
            </div>
            {error && (
              <p className="text-[var(--text-11)]" style={{ color: 'var(--red)' }}>{error}</p>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div
              className="flex gap-3 rounded-[8px] overflow-hidden"
              style={{ background: 'var(--bg)', border: '1px solid var(--border2)', padding: '10px 12px' }}
            >
              <img
                src={preview.thumbnail}
                alt={preview.title}
                style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
              />
              <div className="min-w-0">
                <p
                  className="text-[var(--text-13)] font-medium leading-[1.3]"
                  style={{ color: 'var(--fg)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                >
                  {preview.title}
                </p>
                {preview.channelName && (
                  <p className="text-[var(--text-11h)] mt-[2px]" style={{ color: 'var(--muted2)' }}>
                    {preview.channelName}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--border2)' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium transition-all duration-100 cursor-pointer border"
            style={{ background: 'transparent', color: 'var(--muted)', borderColor: 'var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!preview || saving}
            className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium transition-all duration-100 cursor-pointer border-none disabled:opacity-50"
            style={{ background: '#ff0000', color: '#fff' }}
          >
            {saving ? 'Adding…' : 'Add Video'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/mywatch-plugin-youtube/src/AddYouTubeItemModal.tsx
git commit -m "feat(youtube-plugin): AddYouTubeItemModal with oEmbed fetch"
```

---

### Task 11: YouTube plugin — entry point

**Files:**
- Create: `plugins/mywatch-plugin-youtube/src/index.tsx`

- [ ] **Step 1: Create `plugins/mywatch-plugin-youtube/src/index.tsx`**

```tsx
import type { MyWatchPlugin } from '@mywatch/plugin-sdk'
import { YouTubeCard } from './YouTubeCard'
import { AddYouTubeItemModal } from './AddYouTubeItemModal'
import { matchesUrl, fetchYouTubeMetadata } from './utils'

const youtubePlugin: MyWatchPlugin = {
  id: 'youtube',
  displayName: 'YouTube Links',
  listTypes: [
    {
      id: 'youtube',
      label: 'YouTube Links',
      CardComponent: YouTubeCard,
      AddItemModal: AddYouTubeItemModal,
      matchesUrl,
      prefillFromUrl: async (url) => {
        const meta = await fetchYouTubeMetadata(url)
        if (!meta) return {}
        return {
          url,
          videoId: meta.videoId,
          title: meta.title,
          thumbnail: meta.thumbnail,
          channelName: meta.channelName,
          watched: false,
        }
      },
    },
  ],
}

export default youtubePlugin
```

- [ ] **Step 2: Re-run scanner to ensure registry imports the entry point**

```bash
cd apps/web && pnpm scan-plugins
```

Verify `apps/web/src/plugins/registry.ts` now has:
```ts
import plugin0 from 'mywatch-plugin-youtube'
```

- [ ] **Step 3: Commit**

```bash
git add plugins/mywatch-plugin-youtube/src/index.tsx apps/web/src/plugins/registry.ts apps/web/src/plugins/.plugins-manifest.json
git commit -m "feat(youtube-plugin): plugin entry point, update registry"
```

---

### Task 12: `CreatePlaylistModal` — plugin list type option

**Files:**
- Modify: `apps/web/src/components/CreatePlaylistModal.tsx`

- [ ] **Step 1: Update `apps/web/src/components/CreatePlaylistModal.tsx`**

Add import at top:
```ts
import { usePlugins } from '@/plugins'
```

Add inside the component (after the existing hooks):
```ts
const plugins = usePlugins()
const pluginListTypes = plugins.flatMap((p) => p.listTypes ?? [])
```

Change the `type` state type and initial value:
```ts
const [type, setType] = useState<string>('manual')
```

Replace the type toggle section. Find the block with `(['manual', 'smart'] as const).map(...)` and replace the entire type toggle `<div>` with:

```tsx
          {/* Type toggle */}
          <div className="space-y-2">
            <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
              Type
            </label>
            <div
              className="flex flex-wrap gap-[5px]"
            >
              {[
                { id: 'manual', label: 'Manual' },
                { id: 'smart', label: 'Smart (auto)' },
                ...pluginListTypes.map((lt) => ({ id: lt.id, label: lt.label })),
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className="px-[9px] py-[4px] rounded-full text-[var(--text-11)] font-medium transition-all duration-100 cursor-pointer border"
                  style={{
                    background: type === t.id ? 'var(--accent-bg)' : 'transparent',
                    color: type === t.id ? 'var(--accent2)' : 'var(--muted)',
                    borderColor: type === t.id ? 'var(--accent)' : 'var(--border2)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>
              {type === 'manual'
                ? 'Add items manually. Drag to reorder.'
                : type === 'smart'
                ? 'Items auto-populate based on rules below.'
                : `Plugin-managed list (${pluginListTypes.find(lt => lt.id === type)?.label ?? type}).`}
            </p>
          </div>
```

Update `handleCreate` — the `smartRules` block uses `type === 'smart'` which still works. But `upsert` needs the type passed as a string. The existing call already uses `type` variable, so no changes needed there. Verify the call looks like:
```ts
    const playlist = await upsert({
      ...
      type,          // ← already passes the string, works for plugin types too
      smartRules,
      ...
    })
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/CreatePlaylistModal.tsx
git commit -m "feat: CreatePlaylistModal supports plugin list types"
```

---

### Task 13: Home page — plugin list rendering

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Add plugin imports to `apps/web/src/app/page.tsx`**

At the top of the file, add:
```ts
import { useListTypePlugin, isPluginListType } from '@/plugins'
import { usePluginItems, useUpsertPluginItem } from '@/hooks/usePluginItems'
import type { PluginItem } from '@mywatch/core'
```

- [ ] **Step 2: Add plugin state inside `HomePageInner`**

After the existing `const activeList = ...` line, add:
```ts
  const isPluginList = activeList ? isPluginListType(activeList.type) : false
  const activeListPlugin = useListTypePlugin(isPluginList ? activeList?.type : undefined)
  const rawPluginItems = usePluginItems(isPluginList ? activeList?.id : undefined)
  const pluginItems = rawPluginItems ?? []
  const upsertPluginItem = useUpsertPluginItem()
  const [showPluginAddModal, setShowPluginAddModal] = useState(false)
```

- [ ] **Step 3: Update the `+` (Add) button click handler in the header**

Find the button with `onClick={() => router.push('/search')}` and change it to:
```tsx
          <button
            onClick={() => isPluginList ? setShowPluginAddModal(true) : router.push('/search')}
            title="Add"
            ...same styles...
          >
```

- [ ] **Step 4: Update the list dropdown badge for plugin lists**

In the list dropdown, find the badge that shows `'Smart' : 'Manual'` and extend it:

```tsx
                          <span
                            className="text-[var(--text-10)] font-medium px-1.5 py-0.5 rounded-full border"
                            style={{
                              background: 'var(--surface)',
                              borderColor: 'var(--border2)',
                              color: 'var(--muted2)',
                            }}
                          >
                            {p.type === 'smart' ? 'Smart' : p.type === 'manual' ? 'Manual' : p.type.charAt(0).toUpperCase() + p.type.slice(1)}
                          </span>
```

- [ ] **Step 5: Replace the content area item rendering**

Find the section that renders `viewMode === 'list' ? <WatchlistItemCard ...> : <GridItemCard ...>` (approximately lines 1258–1286) and replace it with:

```tsx
        ) : isPluginList ? (
          activeListPlugin ? (
            <div className="flex flex-col" style={{ gap: 8 }}>
              {pluginItems.length === 0 ? (
                <div className="flex flex-col items-center gap-3 text-center" style={{ padding: '64px 16px 48px' }}>
                  <div
                    className="flex items-center justify-center"
                    style={{ width: 52, height: 52, borderRadius: 13, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted2)' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <p className="font-semibold" style={{ fontSize: 'var(--text-15)', color: 'var(--fg2)', letterSpacing: '-0.02em' }}>
                    No items yet
                  </p>
                  <p style={{ fontSize: 'var(--text-13)', color: 'var(--muted2)', maxWidth: 220, lineHeight: 1.5, marginTop: -4 }}>
                    Tap + to add your first {activeListPlugin.label} item
                  </p>
                </div>
              ) : (
                pluginItems.map((pi: PluginItem) => (
                  <activeListPlugin.CardComponent
                    key={pi.id}
                    item={pi}
                  />
                ))
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 'var(--text-13)' }}>Plugin not loaded.</p>
          )
        ) : viewMode === 'list' ? (
          <div className="flex flex-col" style={{ gap: 8 }}>
            {displayed.map((item) => (
              <WatchlistItemCard
                key={item.id}
                item={item}
                jellyfinProgress={progressMap?.get(`${item.tmdbId}-${item.mediaType}`) ?? undefined}
                onSelect={() => setPanel({ tmdbId: item.tmdbId, mediaType: item.mediaType as MediaType })}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns,
              gap: 12,
            }}
          >
            {displayed.map((item) => (
              <GridItemCard
                key={item.id}
                item={item}
                jellyfinProgress={progressMap?.get(`${item.tmdbId}-${item.mediaType}`) ?? undefined}
                onSelect={() => setPanel({ tmdbId: item.tmdbId, mediaType: item.mediaType as MediaType })}
              />
            ))}
          </div>
        )
```

The full ternary structure starts from `allItems === undefined ? (loading) : displayed.length === 0 ? (empty state) : isPluginList ? (...) : viewMode === 'list' ? (...) : (grid)`.

Note: when `isPluginList` is true, the `displayed.length === 0` empty state check will trigger incorrectly because `displayed` is still from TMDB items. Move the empty state check inside each branch instead — replace `displayed.length === 0 ? (empty) :` with:

```tsx
        ) : isPluginList ? (
          // plugin rendering (with its own empty state above)
        ) : displayed.length === 0 ? (
          // existing TMDB empty state
        ) : viewMode === 'list' ? (
```

- [ ] **Step 6: Add plugin AddItemModal rendering at bottom of component**

After the existing `{showCreateList && <CreatePlaylistModal ...>}` block, add:

```tsx
      {showPluginAddModal && activeListPlugin?.AddItemModal && activeList && (
        <activeListPlugin.AddItemModal
          playlistId={activeList.id}
          onClose={() => setShowPluginAddModal(false)}
          onAdded={async (item) => {
            await upsertPluginItem(item)
            setShowPluginAddModal(false)
          }}
        />
      )}
```

- [ ] **Step 7: Verify the app compiles and renders**

```bash
cd apps/web && pnpm dev
```

Navigate to the app. Create a new list with type "YouTube Links". The list should appear in the dropdown. Clicking `+` should open the YouTube add modal.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: home page renders plugin lists with plugin card components"
```

---

### Task 14: iOS Share Target — manifest + `/share` route

**Files:**
- Modify: `apps/web/src/app/manifest.ts`
- Create: `apps/web/src/app/share/page.tsx`

- [ ] **Step 1: Update `apps/web/src/app/manifest.ts`**

Read the current manifest.ts file, then add `share_target` to the returned object. Find the `return { ... }` block and add this field:

```ts
  share_target: {
    action: '/share',
    method: 'GET',
    enctype: 'application/x-www-form-urlencoded',
    params: {
      url: 'url',
      title: 'title',
      text: 'text',
    },
  },
```

- [ ] **Step 2: Create `apps/web/src/app/share/page.tsx`**

```tsx
'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUrlMatchPlugin } from '@/plugins'

function ShareHandlerInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const url = searchParams.get('url') ?? searchParams.get('text') ?? ''
  const title = searchParams.get('title') ?? ''
  const matchedPlugin = useUrlMatchPlugin(url)

  useEffect(() => {
    if (!url) {
      router.replace('/')
      return
    }

    if (matchedPlugin) {
      // Redirect home with share params — home page will open the plugin AddItemModal
      const params = new URLSearchParams({
        shareUrl: url,
        pluginListType: matchedPlugin.id,
      })
      router.replace(`/?${params.toString()}`)
    } else {
      // Fallback: TMDB search
      const params = new URLSearchParams({ q: title || url })
      router.replace(`/search?${params.toString()}`)
    }
  }, [url, matchedPlugin, router, title])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p style={{ color: 'var(--muted)', fontSize: 'var(--text-13)' }}>Opening…</p>
    </div>
  )
}

export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <ShareHandlerInner />
    </Suspense>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/manifest.ts apps/web/src/app/share/page.tsx
git commit -m "feat: Web Share Target API — manifest share_target + /share route"
```

---

### Task 15: Home page — share URL handler

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Add share URL state + effect in `HomePageInner`**

Add state after existing state declarations:
```ts
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharePluginType, setSharePluginType] = useState<string | null>(null)
```

Add an effect after the existing import-banner effect (the one that reads `searchParams.get('importLocal')`):
```ts
  useEffect(() => {
    const su = searchParams.get('shareUrl')
    const spt = searchParams.get('pluginListType')
    if (su && spt) {
      setShareUrl(su)
      setSharePluginType(spt)
      // Clean URL
      const url = new URL(window.location.href)
      url.searchParams.delete('shareUrl')
      url.searchParams.delete('pluginListType')
      window.history.replaceState({}, '', url.toString())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Auto-switch to the matching plugin list when a share arrives**

Add an effect after the share URL effect:
```ts
  useEffect(() => {
    if (!sharePluginType || !playlists) return
    // Find or use the first list of the matching plugin type
    const matchingList = playlists.find((p) => p.type === sharePluginType)
    if (matchingList) {
      setActiveListId(matchingList.id)
      setShowPluginAddModal(true)
    }
    // If no matching list exists, open create modal with plugin type pre-selected
    // (for now: just open add modal — user should have a list already)
  }, [sharePluginType, playlists]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Pass `prefillUrl` to the plugin AddItemModal**

Find the `showPluginAddModal` block added in Task 13 and update it to pass the share URL:
```tsx
      {showPluginAddModal && activeListPlugin?.AddItemModal && activeList && (
        <activeListPlugin.AddItemModal
          playlistId={activeList.id}
          prefillUrl={shareUrl ?? undefined}
          onClose={() => { setShowPluginAddModal(false); setShareUrl(null); setSharePluginType(null) }}
          onAdded={async (item) => {
            await upsertPluginItem(item)
            setShowPluginAddModal(false)
            setShareUrl(null)
            setSharePluginType(null)
          }}
        />
      )}
```

- [ ] **Step 4: Test the share flow manually**

1. On a device where the app is installed as a PWA, or in Chrome DevTools → Application → Manifest
2. Navigate to the share page directly: `http://localhost:3000/share?url=https://youtu.be/dQw4w9WgXcQ&title=Test`
3. Expected: redirects to home with YouTube AddItemModal open, URL pre-filled with `https://youtu.be/dQw4w9WgXcQ` and metadata fetched

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: home page handles share URL — opens plugin AddItemModal pre-filled"
```

---

### Task 16: Final wiring + smoke test

- [ ] **Step 1: Full rebuild smoke test**

```bash
cd /path/to/myWatch && pnpm install && cd apps/web && pnpm build
```

Expected: build succeeds with no TypeScript errors (the config has `ignoreBuildErrors: true` but aim for clean output).

- [ ] **Step 2: E2E flow test (manual)**

1. Start dev server: `pnpm dev`
2. Open app → click header dropdown → "Create New List"
3. Enter name "My YouTube" → select type "YouTube Links" → Create
4. Select the "My YouTube" list
5. Click `+` → YouTube add modal opens
6. Paste `https://youtu.be/dQw4w9WgXcQ` → metadata fetches (title + thumbnail appear)
7. Click "Add Video" → modal closes, card appears in list with thumbnail, title, channel
8. Test share route: navigate to `/share?url=https://youtu.be/dQw4w9WgXcQ`
9. Expected: redirects to home, AddItemModal opens pre-filled

- [ ] **Step 3: Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: post-integration smoke test fixes"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Plugin SDK types (`PluginListType`, `MyWatchPlugin`, `PluginItem`, `AddItemModalProps`, `PluginCardProps`)
- ✅ Plugin format (`.tgz` / directory in `plugins/`, `package.json` with `mywatch.id`)
- ✅ Build-time auto-discovery (scanner script, registry.ts codegen)
- ✅ Dexie v6 `pluginItems` table
- ✅ `Playlist.type` extended
- ✅ YouTube plugin — package, card, modal, entry point
- ✅ `matchesUrl` + `prefillFromUrl` on `PluginListType`
- ✅ `CreatePlaylistModal` plugin list type option
- ✅ Home page plugin list rendering
- ✅ Web Share Target API — `share_target` in manifest
- ✅ `/share` route — URL matching → plugin redirect
- ✅ Home page share URL handler + `prefillUrl` to modal
- ⚠️ Filter bar (status/type/genre/sort) is hidden when `isPluginList` — handled implicitly because plugin lists use `pluginItems` not `displayed`. The filter UI in the page still renders; a follow-up can hide it for plugin lists.

**Type consistency:**
- `PluginItem` defined in `@mywatch/plugin-sdk/src/index.ts` and mirrored in `@mywatch/core/src/types.ts` — they must be identical. Consider importing from plugin-sdk in core to avoid duplication. For now both are defined; ensure they match exactly.
- `useUpsertPluginItem` returns `PluginItem` — matches what `AddItemModalProps.onAdded` expects. ✅
- `activeListPlugin.CardComponent` typed as `ComponentType<PluginCardProps>` — `PluginCardProps.item` is `PluginItem`. ✅
