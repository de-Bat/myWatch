# Jellyfin Integration Design

**Date:** 2026-05-31  
**Scope:** Read-only progress display — show Jellyfin watch state on cards, no watchlist sync

---

## Goals

- Retrieve watch progress from a user-configured Jellyfin server
- Display progress on watchlist cards when Jellyfin data exists
- No writes to the watchlist — Jellyfin data is overlay only

---

## Settings

Add to `AppSettings` in `apps/web/src/hooks/useSettings.ts`:

```typescript
jellyfinUrl: string      // e.g. "http://jellyfin.local:8096"
jellyfinApiKey: string   // Jellyfin API key
jellyfinUserId: string   // Jellyfin user ID
```

Defaults: empty strings. Stored in localStorage alongside existing settings.

---

## Data Model

```typescript
// apps/web/src/lib/jellyfin.ts
export interface JellyfinProgress {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  jellyfinStatus: 'planned' | 'watching' | 'watched'
  // movie:
  moviePercent?: number       // 0–100
  // tv (in-progress series only):
  season?: number
  episode?: number
  episodePercent?: number     // 0–100 (100 = fully watched episode)
}
```

---

## Jellyfin API Usage

Auth header on all requests: `X-Emby-Token: {apiKey}`

### Fetch movies

```
GET {url}/Users/{userId}/Items
  ?IncludeItemTypes=Movie
  &Recursive=true
  &Fields=ProviderIds,UserData,RunTimeTicks
```

Map per item:
- `ProviderIds.Tmdb` → `tmdbId`
- `UserData.Played = true` → status `watched`
- `UserData.PlaybackPositionTicks > 0` → status `watching`, percent = `PlaybackPositionTicks / RunTimeTicks * 100`
- else → status `planned`

Skip items without `ProviderIds.Tmdb`.

### Fetch TV series

```
GET {url}/Users/{userId}/Items
  ?IncludeItemTypes=Series
  &Recursive=true
  &Fields=ProviderIds,UserData,RecursiveItemCount
```

Map per series:
- `UserData.UnplayedItemCount == 0 && RecursiveItemCount > 0` → `watched`
- `RecursiveItemCount - UnplayedItemCount > 0` OR `UserData.PlaybackPositionTicks > 0` → `watching`
- else → `planned`

### Fetch episodes (in-progress series only)

For each series with status `watching`:
```
GET {url}/Users/{userId}/Items
  ?ParentId={seriesJellyfinId}
  &IncludeItemTypes=Episode
  &Recursive=true
  &Fields=UserData,ParentIndexNumber,IndexNumber,RunTimeTicks
  &SortBy=SortName
```

Find the last played / in-progress episode:
- Last episode where `UserData.PlaybackPositionTicks > 0` OR (`UserData.Played = true` and next episode exists unplayed)
- Extract `ParentIndexNumber` (season), `IndexNumber` (episode)
- Percent = `PlaybackPositionTicks / RunTimeTicks * 100`, or 100 if `Played = true`

---

## Hook: `useJellyfinProgress`

`apps/web/src/hooks/useJellyfinProgress.ts`

```typescript
// Returns: Map<`${tmdbId}-${mediaType}`, JellyfinProgress> | null
// null = not configured or fetch failed
```

- Runs once on mount when `jellyfinUrl + jellyfinApiKey + jellyfinUserId` are non-empty
- Exposes `refresh()` for manual re-fetch
- Stores result in React state (no persistence — fresh fetch each session)
- On fetch error: logs to console, returns `null` (silent fail, no blocking UI)

---

## UI: Card Indicator

In `WatchlistItemCard`, when Jellyfin progress exists for the item:

1. **Small `J` badge** — amber pill next to `StatusBadge`, always shown when data exists
2. **Progress detail** — shown only when `jellyfinStatus === 'watching'`:
   - Movie: `72%` pill
   - TV: `S2·E4 · 38%` pill (or `S2·E4` if no episode-level percent)
3. **Watched hint** — if `jellyfinStatus === 'watched'` but app status is `planned`: dim text `seen on Jellyfin`

---

## UI: Settings Page

New "Jellyfin" section in profile/settings:

- **Server URL** — text input, placeholder `http://jellyfin.local:8096`
- **User ID** — text input
- **API Key** — text input (password type, toggleable)
- **Test connection** — button that calls `/Users/{userId}/Items?Limit=1` and shows ✓ or error message

---

## Error Handling

- Missing credentials → hook returns `null` silently, no UI shown
- Fetch failure (network, 401, etc.) → returns `null`, no UI change
- CORS: user must enable in Jellyfin dashboard (Network → Allow CORS). Note in settings UI.

---

## What's NOT in scope

- Syncing Jellyfin progress back into the watchlist
- Fetching episodes for watched/planned series
- Jellyfin login flow (API key only)
- Multiple Jellyfin servers
