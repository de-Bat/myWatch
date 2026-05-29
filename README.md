# myWatch

A local-first media watchlist app. Track movies and TV shows across devices with offline support and background sync.

## Features

- **My List** — watchlist with status (Planned / In Progress / Watched / Quit), rating, notes, TV season+episode progress
- **Search** — real-time TMDB search with inline add
- **Discover** — trending, top rated, personalized recommendations based on what you've watched
- **Media Detail** — full metadata, status controls, rating 1–10, notes, soft delete
- **Sync** — push/pull sync to PostgreSQL backend; works offline, syncs when online
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
| Tests | Vitest — 103 tests |

## Monorepo Structure

```
myWatch/
├── apps/
│   ├── api/          — Fastify REST API (auth, sync)
│   └── web/          — Next.js 14 frontend
├── packages/
│   ├── core/         — shared types, Zod schemas, status machine
│   ├── tmdb/         — TMDB API client, normalization, cache utils
│   └── sync/         — conflict resolution (LWW), device ID
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
| POST | `/sync/push` | Bearer | Push local changes |
| GET | `/sync/pull?since=<ISO>` | Bearer | Pull remote changes |

## Quick Start

### Docker (zero setup)

```bash
cp .env.example .env   # fill in JWT_SECRET, NEXT_PUBLIC_TMDB_API_KEY, AUTH_SECRET
docker compose up --build
```

Open http://localhost:3000

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

# Run all 103 tests
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

### `apps/api/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Secret for signing JWTs |
| `PORT` | no | API port (default: 3001) |
| `GOOGLE_CLIENT_ID` | OAuth only | Google app client ID |
| `APPLE_BUNDLE_ID` | OAuth only | Apple Services ID |

### `apps/web/.env.local`

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | yes | Fastify API base URL |
| `NEXT_PUBLIC_TMDB_API_KEY` | yes | TMDB API key |
| `AUTH_SECRET` | yes | Auth.js session secret |
| `AUTH_URL` | yes | Web app base URL (for OAuth callbacks) |
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
  addedAt: string        // ISO timestamp
  startedAt: string | null
  finishedAt: string | null
  quitAt: string | null
  updatedAt: string      // used for LWW conflict resolution
  deviceId: string       // source device
  deletedAt: string | null  // soft delete
}
```

### Sync Strategy

- **Local-first**: IndexedDB (Dexie) is the source of truth for the UI
- **Push**: every write queues the item in `pendingPushes`; sync flushes the queue
- **Pull**: fetches items updated since last sync; resolves conflicts with Last-Write-Wins per field
- **Tombstones**: `deletedAt` propagates through sync — remote deletes are respected
