# myWatch — Media Watchlist App Design

**Date:** 2026-05-28  
**Status:** Approved

---

## 1. Overview

myWatch is a cross-platform media watchlist app for tracking TV series and movies. Users search TMDB, add titles to their list, and assign one of four statuses. The app works offline (local-first) and syncs bidirectionally when a connection is available.

**Platforms:** Web (browser), iOS, Android TV  
**All three platforms are first-class** — no deprioritization.

---

## 2. Architecture

### Monorepo Structure

```
myWatch/
  apps/
    web/        — Next.js 14 (App Router), TypeScript
    mobile/     — React Native bare + react-native-tvos (iOS + Android TV)
    api/        — Fastify, TypeScript, PostgreSQL
  packages/
    core/       — shared types, Zod schemas, business logic
    tmdb/       — TMDB API client + fallback cache logic
    sync/       — sync protocol (shared between web and mobile)
```

### Local-First Sync

- **Mobile/TV:** WatermelonDB (SQLite)
- **Web:** Dexie.js (IndexedDB)
- **Server:** PostgreSQL (source of truth when connected)
- **Sync protocol:** timestamp-based, last-write-wins per field, soft deletes only
- Each record carries `updated_at` + `device_id`
- Pull on app open; push on every write
- Guest mode: local-only, no sync. Upgrading guest → account migrates all local data.

### TMDB Strategy

- Primary: TMDB API (live fetch)
- Fallback: cached local copy (`media_cache` table) refreshed if >7 days old
- Graceful degrade: if no TMDB and no cache, show title only (no poster)

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Web frontend | Next.js 14 (App Router), TypeScript |
| Mobile + TV | react-native-tvos (fork of React Native supporting iOS + Android TV in one codebase) |
| Shared logic | TypeScript packages in monorepo |
| Backend API | Fastify, TypeScript |
| Database | PostgreSQL (server), SQLite via WatermelonDB (mobile), IndexedDB via Dexie.js (web) |
| Auth | Auth.js — email/password + Google + Apple Sign-In |
| Media data | TMDB API (primary) + local cache (fallback) |
| Package manager | pnpm workspaces |

---

## 4. Data Model

### `users`

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | text unique nullable | null for guests |
| display_name | text | |
| avatar_url | text nullable | |
| is_guest | boolean | default true |
| created_at / updated_at | timestamptz | |

### `watchlist_items`

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | → users |
| tmdb_id | integer | |
| media_type | enum | 'movie' \| 'tv' |
| status | enum | 'planned' \| 'in_progress' \| 'watched' \| 'quit' |
| progress_episode | integer nullable | TV: last watched episode number |
| progress_season | integer nullable | TV: last watched season number |
| rating | integer nullable | 1–10, user's own rating |
| notes | text nullable | |
| added_at | timestamptz | when user first added |
| started_at | timestamptz nullable | |
| finished_at | timestamptz nullable | |
| quit_at | timestamptz nullable | |
| updated_at | timestamptz | sync key |
| device_id | text | last write origin |
| deleted_at | timestamptz nullable | soft delete |

### `media_cache`

| Field | Type | Notes |
|---|---|---|
| tmdb_id | integer | composite PK with media_type |
| media_type | enum | 'movie' \| 'tv' · composite PK with tmdb_id |
| title | text | |
| overview | text | |
| poster_path / backdrop_path | text nullable | |
| release_date | date nullable | |
| genres | jsonb | [{id, name}] |
| vote_average / vote_count | numeric | |
| runtime | integer nullable | minutes (movie) or avg ep length (tv) |
| seasons_count | integer nullable | tv only |
| status | text nullable | 'Ended', 'Returning Series', etc. |
| cached_at | timestamptz | stale if >7 days |

---

## 5. Features

### My List (Home Screen)

- Status filter tabs: All / Planned / In Progress / Watched / Quit
- Type filter: All / Movies / TV
- Sort options: Recently Added, Title A–Z, Rating, Release Date, TMDB Score
- Genre filter
- List view: poster thumbnail, title, type, progress (TV: S/E), TMDB score, status badge

### Search

- Real-time search against TMDB API
- Filter: All / Movies / TV Shows
- Each result shows poster, title, year, TMDB score
- Inline "Add to list" → opens status picker on first add
- Results already in list show current status badge

### Media Detail

- Backdrop + poster
- Title, type, year range, seasons count (TV), runtime, genres, TMDB score
- Overview text
- Status selector (Planned / In Progress / Watched / Quit) — always visible
- Progress tracker for TV: season + episode selectors (when In Progress)
- User rating (1–10 stars)
- Notes field
- Timestamps: added, started, finished/quit

### Discover

- **Trending This Week** — TMDB trending endpoint (movies + TV, or filtered)
- **Personalized rows** — "Because you watched X": TMDB recommendations for up to 3 most recent In Progress / Watched titles
- **Top Rated** — TMDB top rated fallback row
- Tapping any card → Media Detail

### Profile / Settings

- Auth: login, logout, switch account
- Guest upgrade flow
- Sync status indicator (last synced time, pending changes count)
- Manual sync trigger
- Appearance: dark/light mode (dark default)
- Clear local cache

---

## 6. Android TV — Platform Specifics

- All navigation via D-pad (no touch, no hover)
- `TVFocusGuide` for spatial focus management
- Focus trap inside modals and dialogs
- Always-visible focus ring (high contrast)
- Remote button mapping:
  - D-pad arrows = navigate
  - SELECT (center) = confirm / open
  - BACK = back / dismiss
  - Long-press SELECT = quick status change (cycle through statuses)
- Layout adaptations: larger cards, larger text, horizontal scrolling rows, no hover states
- TV-specific navigation: bottom tab bar replaced with left sidebar (D-pad friendly)

---

## 7. Sync Protocol

1. **Push:** On every local write, queue a sync event. When online, POST changed records to `POST /sync/push` with `updated_at` + `device_id`.
2. **Pull:** On app open (and periodic background poll every 15 min when active), GET `/sync/pull?since=<last_pull_at>`. Server returns all records updated after that timestamp for the user.
3. **Conflict resolution:** Last-write-wins per field, using `updated_at`. No CRDT — watchlist data is low-conflict by nature.
4. **Soft deletes:** `deleted_at` field propagates deletes without data loss.
5. **Guest → account migration:** Guest items use a local device UUID as `user_id` (never sent to server). On account creation/login, all local items are re-assigned the server user ID and pushed as a bulk initial sync.

---

## 8. Auth Flow

- Auth.js handles web session (cookie-based)
- Mobile: custom JWT issued by API on login, stored in secure keychain
- Providers: email/password, Google OAuth, Apple Sign-In
- Guest mode: app works fully without login; data is local-only
- Guest upgrade: login prompt shows pending local item count ("You have 12 items — sign in to sync them")

---

## 9. Out of Scope

- Social features (sharing lists, following users)
- Watch provider availability ("available on Netflix")
- Push notifications
- iPad-specific layout (iOS phone layout scales to iPad)
- Apple TV (only Android TV in scope)
