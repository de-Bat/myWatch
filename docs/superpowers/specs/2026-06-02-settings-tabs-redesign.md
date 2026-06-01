# Settings Page Redesign — Tabbed Layout

**Date:** 2026-06-02  
**Status:** Approved

## Summary

Redesign the settings page (`apps/web/src/app/profile/page.tsx`) to distinguish server-managed settings (shared across all clients) from client-local settings (per-device). Use a three-tab layout: **Server | Client | Logs**. Introduce a single Save button for server settings with dirty-state tracking. Move TMDB API key and sync interval from localStorage to the server DB.

---

## Architecture

### Settings Classification

**Server settings** — stored in DB, fetched on login, pushed to all clients:
- Jellyfin: URL, User ID, API Key
- TMDB: API key
- Sync interval (minutes)
- AI/LLM: provider, base URL, API key, model, recap min interval
- Radarr: URL, API key, quality profile ID, root folder path
- Sonarr: URL, API key, quality profile ID, root folder path

**Client settings** — localStorage only, per-device, instant-save:
- Theme (dark/light)
- Language
- Font family
- Font size
- Card display flags (genres, rating, runtime, providers, overview, progress bars)

---

## Frontend Changes

### Page Layout

```
Header: "← Settings"
Account section (always visible, above tabs)
  - User name + email row
  - Sign In / Sign Out button

Tab bar: [Server] [Client] [Logs]

Tab panels (scrollable):
  Server tab → server settings + Save button
  Client tab → appearance + card display (instant-save)
  Logs tab   → Jellyfin Debug + PWA Debug
```

### Server Tab

Sections (visual sub-headers, no individual save buttons):
1. **Jellyfin** — URL, User ID, API Key inputs + Test Connection button
2. **TMDB** — API key input (password)
3. **Sync** — segment picker: Never / 1 min / 5 min / 15 min / 30 min / 1 hour
4. **AI & Recap** — provider selector (Gemini / OpenAI-compatible), conditional inputs (Gemini key OR base URL + key + model), recap interval slider
5. **Radarr** — URL, API key, quality profile ID, root folder path + Test Connection button
6. **Sonarr** — URL, API key, quality profile ID, root folder path + Test Connection button

**Save button** at bottom of Server tab:
- Disabled when no field has changed from last-loaded server values
- Enabled (accent color) when any server field is dirty
- Label: "Save" (loading: "Saving…")
- On success: toast "Settings saved", reset dirty state
- On network error: persist dirty values to localStorage under key `mywatch_pending_server_settings`, show toast "Saved locally — will sync when online"

**Dirty state tracking:**
- On page load / server fetch: store snapshot of all server field values
- Compare current form state to snapshot on every input change
- `isDirty = JSON.stringify(current) !== JSON.stringify(snapshot)`

**Offline / reconnect sync:**
- On successful GET `/api/user/settings`: check `mywatch_pending_server_settings` in localStorage. If present and user is logged in, auto-PUT those pending values and clear the key.

### Client Tab

All changes save instantly (no Save button). Sections:

1. **Appearance**
   - Theme: Dark / Light segment
   - Language: English / Hebrew segment
   - Font family: System / Serif / Mono segment
   - Font size: S / M / L / XL segment

2. **Card Display**
   - Toggle rows: Genres, TMDB Rating, Runtime, Streaming Providers, Plot Overview, Progress Bars

### Logs Tab

Read-only debug info. Two collapsible (or always-expanded) sub-sections:

1. **Jellyfin Debug**
   - Server credentials status row
   - Local progress record count row
   - Sample progress items (up to 5)
   - Poll Jellyfin Now button
   - Pull from Backend DB Only button
   - Log output panel

2. **PWA Debug**
   - Diagnostic log panel (auto-runs on mount)
   - Refresh button + Copy Logs button

---

## Backend Changes

### DB Migration

All settings live directly on the `users` table (same as `llm_provider`, `radarr_url`, etc.). Add two columns:

```sql
ALTER TABLE users ADD COLUMN tmdb_api_key TEXT;
ALTER TABLE users ADD COLUMN sync_interval INTEGER NOT NULL DEFAULT 5;
```

### API Changes (`apps/api/src/routes/settings.ts`)

**GET `/api/user/settings`** — add to response:
```ts
tmdbApiKey: settings?.tmdbApiKey ? '••••••••' : '',
syncInterval: settings?.syncInterval ?? 5,
```

**PUT `/api/user/settings`** — accept and persist:
```ts
tmdbApiKey?: string
syncInterval?: number
```

Apply same masked-value pattern as other API keys (if value is `'••••••••'`, keep existing).

### user-repo (`apps/api/src/repos/user-repo.ts`)

Extend `updateLlmSettings` and `getLlmSettings` to include `tmdbApiKey` and `syncInterval`:

```ts
// Interface additions
updateLlmSettings(userId, settings: {
  llmProvider, llmBaseUrl, llmApiKey, llmModel, recapMinInterval,
  tmdbApiKey: string | null,
  syncInterval: number,
}): Promise<void>

getLlmSettings(userId): Promise<{
  ..., tmdbApiKey: string | null, syncInterval: number
} | null>
```

SQL in `updateLlmSettings`: add `tmdb_api_key = ${settings.tmdbApiKey}, sync_interval = ${settings.syncInterval}` to the existing UPDATE.

SQL in `getLlmSettings`: add `tmdb_api_key, sync_interval` to SELECT and map them in the return object.

---

## Data Flow

```
Page load:
  GET /api/user/settings
    → populate all server form fields
    → store snapshot for dirty comparison
    → check localStorage for pending_server_settings
      → if found + logged in: auto-PUT pending values, clear key

User edits server field:
  → compare to snapshot → set isDirty = true → enable Save button

User clicks Save:
  → PUT /api/user/settings (all server fields)
  → success: update snapshot, isDirty = false, toast success
  → failure: write to localStorage pending key, toast offline warning

Client settings change:
  → update(patch) immediately (existing behavior)
```

---

## Out of Scope

- No change to sync logic, AutoSync component, or SSE behavior
- No change to Jellyfin poll/pull debug functionality
- No password reset or account management changes
- TMDB key migration for existing users (new column = null = fall back to env key on server)
