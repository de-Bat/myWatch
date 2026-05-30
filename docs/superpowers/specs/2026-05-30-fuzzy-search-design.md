# Fuzzy Search + Nav Refactor — Design Spec

**Date:** 2026-05-30  
**Scope:** Local watchlist fuzzy search on main page; nav icon changes

---

## Goals

1. Users can search their local watchlist by title on the main page.
2. Search works offline (Dexie/IndexedDB only — no network).
3. Nav: search icon becomes a toggle for the search bar; existing search icon becomes an Add (`+`) icon pointing to `/search`.
4. Mobile-friendly: search bar expands inline on icon tap.

---

## Nav Changes

| Before | After |
|--------|-------|
| Magnifier icon → `/search` (TMDB) | Plus (`+`) icon → `/search` (TMDB add flow) |
| _(no local search)_ | Magnifier icon → toggles `searchOpen` state |

The `+` icon replaces the old magnifier SVG. The magnifier moves to become a toggle. Route and page for `/search` are unchanged.

---

## Search Bar UI

- Rendered in `page.tsx` between header and filter bar when `searchOpen = true`.
- Full-width text input, auto-focuses on open.
- `×` button clears query and collapses bar.
- Escape key also collapses.
- On mobile: same behavior — icon tap expands inline, no modal/overlay.

---

## Data Layer

**Problem:** `watchlistItems` rows have `tmdbId + mediaType` but no `title`. Titles live in `mediaCache`.

**Solution:** When `searchOpen && query.length > 0`, fetch all mediaCache entries for current watchlist items via `db.mediaCache.bulkGet(tmdbKeys)` (same pattern used for genre filtering). Build a `{ id, title }` map in memory.

**Fuzzy matching:** Use [Fuse.js](https://fusejs.io/) — lightweight, no network, works in browser. Index over `{ id, title }` array. Match on `title` field with threshold `0.35` (permissive enough for typos, strict enough to avoid noise).

**Filter interaction:** When query is non-empty, Fuse results replace `displayed` list. Status/type/genre filters still apply before fuzzy matching (filter first, then fuzzy rank). Result order: Fuse score order (best match first).

When query is empty, behavior is identical to current (no regression).

---

## Offline Behavior

All data is in IndexedDB. No network calls added. Works fully offline. The existing `/search` TMDB page continues to require network — no change there.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/app/page.tsx` | Add `searchOpen` + `searchQuery` state; search bar JSX; Fuse.js join logic; nav icon swap |
| `apps/web/package.json` | Add `fuse.js` dependency |

No new files.

---

## Out of Scope

- TMDB search in overlay (approach A/C — rejected in favor of simplicity)
- Animation/transitions beyond normal React render
- Persisting search query across navigation
