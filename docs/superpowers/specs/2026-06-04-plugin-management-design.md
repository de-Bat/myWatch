# Plugin Management Design

**Date:** 2026-06-04  
**Status:** Approved  

---

## Overview

Add a Plugins tab to the Settings page. Users can view installed plugins, toggle them on/off, upload custom plugins as zip bundles, and see available official myWatch plugins.

Plugin loading uses script-tag injection at runtime — no app restart required. Built-in plugins (bundled at build time) can be toggled. Custom plugins are uploaded as compiled zip bundles, served from the API, and loaded dynamically into the client.

---

## Architecture

### Two plugin categories

| Category | Source | Enable/Disable | Remove |
|----------|--------|----------------|--------|
| Built-in | Bundled at build time via scanner | ✓ | ✗ |
| Custom   | Uploaded zip bundle, served by API | ✓ | ✓ |

### Runtime loading flow

```
Build-time PLUGINS array (registry.ts — always present)
        +
Runtime custom plugins (script tags → /api/plugins/:id/bundle.js)
        +
Enabled state (from GET /api/plugins)
        ↓
usePlugins() → merged array, filtered by enabled flag
```

---

## UI: Settings → Plugins Tab

New fourth tab added alongside Server / Client / Logs.

### Installed Plugins section

- Lists all installed plugins (built-in + custom)
- Each row: plugin name, source badge (BUILT-IN or CUSTOM), enabled toggle
- Custom plugins additionally show a Remove button
- Load error state: error badge + Retry button

### Official Plugins section

- Cross-references `OFFICIAL_CATALOG` (client-side hardcoded list) against installed plugins
- Shows uninstalled official plugins with an Install affordance
- If all official plugins are installed: shows "No additional plugins available yet."

### Install Custom Plugin section

- File upload button (`.zip`)
- On upload: POST to `/api/plugins/upload`, show success/error inline
- On success: new plugin appears in Installed section

---

## Data Model

### New types (packages/core/src/types.ts)

```typescript
interface InstalledPluginMeta {
  id: string
  displayName: string
  source: 'builtin' | 'custom'
  enabled: boolean
  installedAt?: string  // custom plugins only
}
```

### Server persistence

Custom plugin metadata and enabled state stored in `apps/api/data/plugins.json`:

```json
{
  "youtube": { "id": "youtube", "source": "builtin", "enabled": true },
  "my-plugin": { "id": "my-plugin", "source": "custom", "enabled": true, "installedAt": "..." }
}
```

Built-in plugins not present in the file default to `enabled: true`.

### Uploaded plugin zip format

```
my-plugin.zip
├── manifest.json   { "id": "my-plugin", "displayName": "My Plugin" }
└── bundle.js       compiled UMD bundle
```

### Bundle self-registration pattern

```js
(function() {
  window.__mywatchPlugins = window.__mywatchPlugins || [];
  window.__mywatchPlugins.push({
    id: 'my-plugin',
    displayName: 'My Plugin',
    listTypes: [...]
  });
})();
```

---

## API

New route file: `apps/api/src/routes/plugins.ts`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/plugins` | List all plugins with metadata and enabled state |
| `POST` | `/api/plugins/upload` | Upload zip, extract, validate, store |
| `PATCH` | `/api/plugins/:id` | Toggle enabled/disabled |
| `DELETE` | `/api/plugins/:id` | Remove custom plugin (built-in returns 400) |
| `GET` | `/api/plugins/:id/bundle.js` | Serve custom plugin bundle |

`GET /api/plugins` response shape:
```typescript
{
  plugins: Array<InstalledPluginMeta & { displayName: string }>
}
```

Server merges: built-in entries from a hardcoded list in `apps/api/src/routes/plugins.ts` (id + displayName for each bundled plugin) + custom entries from `data/plugins.json`.

---

## Client-side Dynamic Loading

### New files

- `apps/web/src/plugins/registry-runtime.ts` — `usePluginRegistry` hook
- `apps/web/src/plugins/official-catalog.ts` — hardcoded official plugin entries
- `apps/web/src/plugins/PluginRegistryProvider.tsx` — context provider (replaces static context)

### usePluginRegistry hook

1. Fetch `GET /api/plugins` on mount
2. For each enabled custom plugin: inject `<script src="/api/plugins/:id/bundle.js">` if not already in DOM (deduplicated via a `Set<string>`)
3. On script `onload`: read `window.__mywatchPlugins`, merge into state
4. On script `onerror`: mark plugin as `loadError` in state
5. Merge result: built-in PLUGINS filtered by enabled + loaded custom plugins
6. Expose merged array via context

### Enable/disable

- Built-in toggle: `PATCH /api/plugins/:id` → update server state → filter built-in from merged array
- Custom enable: `PATCH /api/plugins/:id` → inject script tag if not loaded → add to merged array
- Custom disable: `PATCH /api/plugins/:id` → remove script tag from DOM → filter from merged array

### Remove custom plugin

1. Check if any playlists use `listTypeId` matching this plugin
2. If yes: show warning "X playlists use this plugin. Their items will be hidden."
3. On confirm: `DELETE /api/plugins/:id` → remove script tag → remove from merged array

---

## Validation (server-side upload)

- Zip must contain `manifest.json` and `bundle.js`
- `manifest.json` must have `id` and `displayName`
- `id`: alphanumeric + dash only, max 64 chars
- `id` must not collide with any built-in plugin ID
- `bundle.js` max size: 5MB
- Return `400` with descriptive message on any violation

---

## Official Plugins Catalog

Hardcoded in `apps/web/src/plugins/official-catalog.ts`:

```typescript
export const OFFICIAL_CATALOG = [
  {
    id: 'youtube',
    displayName: 'YouTube Links',
    description: 'Add YouTube videos to your watch lists',
  },
  // future official plugins added here
]
```

UI uses this to populate the "Official Plugins" section — entries whose `id` is not in the installed list are shown as available.

---

## Security

- Plugin bundles served from same origin (`/api/plugins/:id/bundle.js`) — no CSP wildcard needed
- `script-src 'self'` covers dynamically injected same-origin script tags
- No `eval` or cross-origin script loading
- Upload size limit (5MB) prevents abuse
- ID validation prevents path traversal in bundle serving route

---

## Out of Scope

- Downloading official plugins from a remote registry (future)
- Plugin sandboxing / permissions model (future)
- Plugin version management / updates (future)
- Plugin SDK build tooling for custom plugin authors (future)
