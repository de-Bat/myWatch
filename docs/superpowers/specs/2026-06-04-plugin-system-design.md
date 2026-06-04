# Plugin System Design

**Date:** 2026-06-04  
**Status:** Approved

## Goals

Let developers extend myWatch with new list types and visual media cards by shipping plugins as `.tgz` files. First example plugin: YouTube Links.

## Constraints

- Plugins live outside the repo; user drops a `.tgz` into a `plugins/` folder at repo root
- No runtime rebuild required — app picks up plugins at startup (dev server start or production build)
- Full TypeScript support for plugin authors
- Shared React instance between host and plugins (no duplicate React)
- First-party YouTube plugin ships in-tree as the reference implementation

---

## Architecture

### Plugin Format

A plugin is a standard npm tarball (`npm pack` output). Structure:

```
mywatch-plugin-youtube/
  package.json          # { name, version, mywatch: { id, displayName } }
  dist/index.js         # compiled CJS/ESM, no bundled React
  dist/index.d.ts       # types
```

`package.json` must include a `mywatch` key:
```json
{
  "name": "mywatch-plugin-youtube",
  "version": "1.0.0",
  "mywatch": {
    "id": "youtube",
    "displayName": "YouTube Links"
  }
}
```

### Plugin SDK

New package: `packages/plugin-sdk`

```ts
// packages/plugin-sdk/src/types.ts

export interface MyWatchPlugin {
  id: string
  displayName: string
  listTypes?: PluginListType[]
  settingsPanel?: React.ComponentType<PluginSettingsProps>
}

export interface PluginListType {
  id: string                         // e.g. "youtube"
  label: string                      // "YouTube Links"
  CardComponent: React.ComponentType<PluginCardProps>
  AddItemModal?: React.ComponentType<AddItemModalProps>
  matchesUrl?: (url: string) => boolean          // claim shared URLs
  prefillFromUrl?: (url: string) => Promise<Partial<Record<string, unknown>>>
}

export interface PluginCardProps {
  item: PluginItem
  onSelect?: () => void
}

export interface AddItemModalProps {
  playlistId: string
  prefillUrl?: string                // populated from iOS share
  onClose: () => void
  onAdded: (item: PluginItem) => void
}

export interface PluginSettingsProps {
  settings: Record<string, unknown>
  onUpdate: (patch: Record<string, unknown>) => void
}

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

### Plugin Loading (Build-time Auto-discovery)

`next.config.js` runs a pre-build scan:

1. Reads all `plugins/*.tgz` at repo root
2. Extracts each to `plugins/<id>/` (skips if already extracted and version matches)
3. Generates `apps/web/src/plugins/registry.ts` with static imports

**Generated `registry.ts` example:**
```ts
// AUTO-GENERATED — do not edit manually
import youtubePlugin from '../../../../plugins/mywatch-plugin-youtube/dist/index'
export const PLUGINS: MyWatchPlugin[] = [youtubePlugin]
```

If `plugins/` is empty, the generated file exports an empty array. The app always compiles cleanly.

**`apps/web/src/plugins/index.ts`** — React context + hook:
```ts
export function usePlugins(): MyWatchPlugin[]
export function useListTypePlugin(listTypeId: string): PluginListType | undefined
```

---

## Data Model

### New: `PluginItem` type in `@mywatch/core`

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

### Dexie v6 — new `pluginItems` table

```ts
pluginItems: 'id, pluginId, playlistId, updatedAt'
```

Existing `pluginItems` data is preserved through version upgrades. The `data` field is schema-less — each plugin owns its shape.

### `Playlist.type` extension

`type` changes from `'manual' | 'smart'` to `'manual' | 'smart' | string`. Plugin list types use their `listTypeId` (e.g. `"youtube"`) as the type value. The home page and playlist UI treat any unrecognized type as a plugin list.

---

## Home Page Integration

### List Dropdown

Playlists with a plugin `type` show the plugin's `displayName` as a badge (instead of "Manual" / "Smart").

### Item Rendering

When `activeList.type` is a plugin type:
- Load `PluginListType.CardComponent` via `useListTypePlugin(activeList.type)`
- Render plugin cards instead of `WatchlistItemCard` / `GridItemCard`
- Existing filters (status, type, genre) are hidden — plugins manage their own filtering

### Create List Modal

"New list type" section appears if any plugins with `listTypes` are installed. Selecting a plugin list type sets `Playlist.type = listType.id`.

### Add Item

For plugin lists, the `+` button in the header opens `PluginListType.AddItemModal` instead of navigating to `/search`.

---

## iOS Share Target (Web Share Target API)

### Manifest

`apps/web/src/app/manifest.ts` gains a `share_target` entry:

```ts
share_target: {
  action: '/share',
  method: 'GET',
  params: { url: 'url', title: 'title', text: 'text' }
}
```

### Share Route

New page `apps/web/src/app/share/page.tsx`:

1. Reads `?url=` (and `?text=` fallback) from query params
2. Iterates installed plugins, calls `listType.matchesUrl(url)` on each registered list type
3. If a match: redirects to `/?shareUrl=<encoded>&pluginListType=<id>` which triggers the plugin's `AddItemModal` on home page
4. If no match: redirects to `/search?q=<title>` (fallback to TMDB search)

This means any future plugin (Vimeo, podcasts, Letterboxd) automatically appears in the iOS Share Sheet once it implements `matchesUrl`.

---

## YouTube Plugin (Reference Implementation)

**Location:** `plugins/mywatch-plugin-youtube/` (in-tree, also published as `.tgz`)

### Data shape (`data` field)

```ts
interface YouTubeItemData {
  url: string
  videoId: string
  title: string
  thumbnail: string        // maxresdefault or hqdefault
  channelName: string
  duration?: number        // seconds, fetched via oEmbed
  watched?: boolean
}
```

### Metadata fetching

Uses YouTube oEmbed endpoint (`https://www.youtube.com/oembed?url=<url>&format=json`) — no API key required. Extracts `videoId` from URL client-side via regex.

### `CardComponent`

Renders:
- 16:9 thumbnail (lazy-loaded)
- Title (truncated to 2 lines)
- Channel name + duration badge
- Watched/unwatched toggle
- Hover: shows YouTube red play button overlay

### `AddItemModal`

- URL input (pre-filled when opened from share)
- Auto-fetches title + thumbnail on paste/blur
- "Add to list" button — writes to `pluginItems` table
- Works offline (stores URL immediately, fetches metadata lazily)

### `matchesUrl`

```ts
matchesUrl: (url) =>
  /youtube\.com\/watch|youtu\.be\//.test(url)
```

---

## File Changelist

| File | Change |
|------|--------|
| `packages/plugin-sdk/` | New package — plugin types + helpers |
| `packages/core/src/types.ts` | Add `PluginItem` type; extend `Playlist.type` |
| `apps/web/src/lib/db.ts` | Dexie v6 with `pluginItems` table |
| `apps/web/next.config.js` | Pre-build plugin scan + registry codegen |
| `apps/web/src/plugins/registry.ts` | Auto-generated (gitignored) |
| `apps/web/src/plugins/index.ts` | `usePlugins`, `useListTypePlugin` hooks |
| `apps/web/src/app/manifest.ts` | Add `share_target` |
| `apps/web/src/app/share/page.tsx` | New share handler route |
| `apps/web/src/app/page.tsx` | Plugin list rendering + share state handling |
| `apps/web/src/components/CreatePlaylistModal.tsx` | Plugin list type option |
| `plugins/mywatch-plugin-youtube/` | Reference YouTube plugin |
| `pnpm-workspace.yaml` | Add `plugins/mywatch-plugin-youtube` to workspace |

---

## Out of Scope

- Plugin sync to server (plugin items are local-only for now)
- Plugin marketplace / discovery UI
- Plugin sandboxing / permissions model
- Grid view support for plugin cards (phase 2)
