# myWatch

A local-first media watchlist app. Track movies and TV shows across devices with offline support and background sync.

## Features

- **My List** — watchlist with status (Planned / In Progress / Watched / Quit), rating, notes, TV season+episode progress
- **Views** — toggle between List (enhanced row cards) and Grid (poster grid); preference persisted
- **Genre filter** — horizontal scrollable genre chips derived from cached media; ANDs with status/type filters
- **Release dates** — full date + UPCOMING badge on items with future release dates
- **Where to Watch** — TMDB streaming providers (flatrate, auto by region) + custom platforms (Jellyfin, Cellcom, FreTV, Plex, Emby, or free text)
- **Playlists** — Manual collections (drag to reorder, right-click to add) + Smart playlists (auto-populated by rules: status, type, genre, min rating)
- **Search** — real-time TMDB search with inline add
- **Discover** — trending, top rated, personalized recommendations based on what you've watched
- **Media Detail** — full metadata, genre chips, status controls, rating 1–10, notes, soft delete
- **Sync** — push/pull sync to PostgreSQL backend (watchlist + playlists); works offline, syncs when online
- **Auth** — email/password, Google OAuth, Apple Sign-In
- **Guest mode** — use the app without an account; sign in later to sync

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Local storage | Dexie 4 (IndexedDB) |
| Auth | Auth.js v5 (Credentials + Google + Apple) |
| Backend | Fastify 5, JWT |
| Database | PostgreSQL 16 |
| Metadata | TMDB API |
| Language | TypeScript 5.5 throughout |
| Monorepo | pnpm workspaces |
| Tests | Vitest — 111 tests |

## Plugins

myWatch supports plugins that add new list types beyond movies/TV. Plugins live under `plugins/` and are auto-discovered at build time.

### Books Plugin

Tracks books in dedicated reading lists. Not shown in the All view.

**Create a books list:** New List → type **Books** → name it → Create

**Add a book:** Open list → **+** → search by title, author, or ISBN → select result → Add Book. No results? Click "Add manually" → enter title + author.

**Cards show:** cover image (from Open Library), title, author, year, green **Read** badge when read, and a 🔗 store link (if configured).

**Grid / list view:** use the view toggle top-right. Grid renders covers in 2:3 portrait layout; list renders compact rows.

**Configure bookstore:** Settings → Plugins → Books → enter your store's search URL (e.g. `https://bookshop.org/search`). Plugin appends `?q=title+author` automatically.

**Data per book:**
```typescript
{
  title: string
  author: string
  coverUrl?: string      // Open Library cover
  year?: number
  isbn?: string
  openLibraryKey?: string
  read: boolean
}
```

### Building a Plugin

```
plugins/mywatch-plugin-<name>/
├── package.json          # mywatch.id + mywatch.displayName required
├── tsconfig.json
└── src/
    └── index.tsx         # export default: MyWatchPlugin
```

Register in `apps/web/src/plugins/official-catalog.ts` and `apps/api/src/routes/plugins.ts`, then run `node apps/web/scripts/scan-plugins.mjs` to regenerate the registry.

## Monorepo Structure

```
myWatch/
├── apps/
│   ├── api/          — Fastify REST API (auth, sync)
│   └── web/          — Next.js 14 frontend
├── packages/
│   ├── core/         — shared types, Zod schemas, status machine
│   ├── plugin-sdk/   — plugin interfaces (MyWatchPlugin, PluginCardProps, etc.)
│   ├── tmdb/         — TMDB API client, normalization, cache utils
│   └── sync/         — conflict resolution (LWW), device ID
├── plugins/
│   ├── mywatch-plugin-youtube/   — YouTube links plugin
│   └── mywatch-plugin-books/     — Books plugin
├── docker-compose.yml
├── SETUP.md          — full setup guide
└── .env.example      — environment variable template
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Get JWT token |
| GET | `/auth/me` | Bearer | Current user |
| POST | `/auth/oauth/google` | — | Google Sign-In |
| POST | `/auth/oauth/apple` | — | Apple Sign-In |
| POST | `/sync/push` | Bearer | Push watchlist items + playlists + playlist items |
| GET | `/sync/pull?since=<ISO>` | Bearer | Pull watchlist items + playlists + playlist items |

## Quick Start

### Docker (zero setup)

```bash
cp .env.example .env   # fill in JWT_SECRET, NEXT_PUBLIC_TMDB_API_KEY, AUTH_SECRET
docker compose up --build
```

Open http://localhost:3000 (or `http://localhost:$PORT_WEB` if you changed it)

### Manual

```bash
pnpm install
# configure apps/api/.env and apps/web/.env.local
cd apps/api && pnpm migrate && pnpm dev   # terminal 1
cd apps/web && pnpm dev                   # terminal 2
```

See [SETUP.md](./SETUP.md) for the full guide.

## Development

```bash
# Install all dependencies
pnpm install

# Run all tests
pnpm test

# Type-check web app
cd apps/web && pnpm type-check

# Type-check API
cd apps/api && pnpm build

# Dev servers (separate terminals)
cd apps/api && pnpm dev   # http://localhost:3001
cd apps/web && pnpm dev   # http://localhost:3000
```

## Environment Variables

### Docker (`.env` at repo root)

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | yes | Secret for signing JWTs |
| `NEXT_PUBLIC_TMDB_API_KEY` | yes | TMDB API key |
| `AUTH_SECRET` | yes | Auth.js session secret |
| `PORT_WEB` | no | Host port for the web container (default: `3000`) |
| `PORT_API` | no | Host port for the API container (default: `3001`) |
| `PORT_DB` | no | Host port for the Postgres container (default: `5432`) |
| `AUTH_URL` | no | Web app base URL — **auto-derived from `PORT_WEB`**, only set to override (e.g. LAN IP) |
| `NEXT_PUBLIC_API_URL` | no | Public API URL — **auto-derived from `PORT_API`**, only set to override |
| `GOOGLE_CLIENT_ID` | OAuth only | Google app client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth only | Google app client secret |
| `APPLE_ID` | OAuth only | Apple Services ID |
| `APPLE_SECRET` | OAuth only | Apple JWT secret |

### Manual (`apps/api/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Secret for signing JWTs |
| `PORT` | no | API port (default: `3001`) |

### Manual (`apps/web/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | yes | Fastify API base URL |
| `NEXT_PUBLIC_TMDB_API_KEY` | yes | TMDB API key |
| `AUTH_SECRET` | yes | Auth.js session secret |
| `AUTH_URL` | yes | Web app base URL (for OAuth callbacks) |
| `PORT` | no | Next.js dev server port (default: `3000`) |
| `GOOGLE_CLIENT_ID` | OAuth only | Google app client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth only | Google app client secret |
| `APPLE_ID` | OAuth only | Apple Services ID |
| `APPLE_SECRET` | OAuth only | Apple JWT secret |

## Data Model

### WatchlistItem

```typescript
{
  id: string             // UUID
  userId: string         // owner
  tmdbId: number         // TMDB media ID
  mediaType: 'movie' | 'tv'
  status: 'planned' | 'in_progress' | 'watched' | 'quit'
  progressSeason: number | null   // TV only
  progressEpisode: number | null  // TV only
  rating: number | null  // 1–10
  notes: string | null
  customPlatforms: string[]       // user-added streaming platforms (e.g. ["Jellyfin", "Cellcom"])
  addedAt: string        // ISO timestamp
  startedAt: string | null
  finishedAt: string | null
  quitAt: string | null
  updatedAt: string      // used for LWW conflict resolution
  deviceId: string       // source device
  deletedAt: string | null  // soft delete
}
```

### Playlist

```typescript
{
  id: string
  userId: string
  name: string
  description: string | null
  type: 'manual' | 'smart'
  smartRules: {
    statuses?: ('planned' | 'in_progress' | 'watched' | 'quit')[]
    mediaTypes?: ('movie' | 'tv')[]
    genres?: string[]
    minRating?: number
    maxRating?: number
  } | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  deviceId: string
  deletedAt: string | null
}
```

### Sync Strategy

- **Local-first**: IndexedDB (Dexie) is the source of truth for the UI
- **Push**: every write queues the item in `pendingPushes`; sync flushes the queue
- **Pull**: fetches items updated since last sync; resolves conflicts with Last-Write-Wins per field
- **Tombstones**: `deletedAt` propagates through sync — remote deletes are respected
