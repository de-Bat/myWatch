# Plan 2: Fastify API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `apps/api` Fastify server with PostgreSQL, email/password + OAuth auth (JWT), and sync push/pull endpoints.

**Architecture:** Fastify 5 app in `apps/api/`, structured as a factory function (`createApp`) that accepts optional repo dependencies for testability. Routes are registered via explicit functions; all DB access goes through repository interfaces, making routes unit-testable without a real database. PostgreSQL schema is managed via raw SQL migration files.

**Tech Stack:** Fastify 5, @fastify/jwt, postgres.js 3, bcryptjs, google-auth-library, apple-signin-auth, Vitest 2, tsup, TypeScript 5.5, pnpm workspaces

---

## Context

This is Plan 2 of the myWatch monorepo. Plan 1 already scaffolded:
- `packages/core` → `@mywatch/core`: MediaType, WatchStatus, User, WatchlistItem, MediaCache types + Zod schemas + status machine
- `packages/tmdb` → `@mywatch/tmdb`: TmdbClient, normalizeMovie, normalizeTv, isStale
- `packages/sync` → `@mywatch/sync`: resolveConflict, mergeItems, getOrCreateDeviceId, SyncPushPayload, SyncPullResponse

Root config: `tsconfig.base.json` (moduleResolution: "bundler"), `pnpm-workspace.yaml` includes `apps/*` and `packages/*`.

**Important type shapes from @mywatch/core:**
```typescript
// WatchlistItem (camelCase, ISO strings for dates):
{ id: string; userId: string; tmdbId: number; mediaType: 'movie'|'tv'; status: 'planned'|'in_progress'|'watched'|'quit';
  progressEpisode: number|null; progressSeason: number|null; rating: number|null; notes: string|null;
  addedAt: string; startedAt: string|null; finishedAt: string|null; quitAt: string|null;
  updatedAt: string; deviceId: string; deletedAt: string|null }

// SyncPushPayload / SyncPullResponse from @mywatch/sync:
interface SyncPushPayload { items: WatchlistItem[] }
interface SyncPullResponse { items: WatchlistItem[]; pulledAt: string }
```

---

## File Structure

```
apps/api/
  src/
    app.ts                        — Fastify factory; registers plugins + routes
    index.ts                      — server entry point (listen)
    auth.d.ts                     — @fastify/jwt type augmentation
    db/
      client.ts                   — postgres.js connection singleton
      migrate.ts                  — migration runner (reads SQL files, tracks versions)
      migrations/
        001_initial.sql           — users, oauth_accounts, watchlist_items, media_cache tables
    repos/
      user-repo.ts                — UserRepo interface + createUserRepo(sql)
      watchlist-repo.ts           — WatchlistRepo interface + createWatchlistRepo(sql)
    routes/
      auth.ts                     — POST /auth/register, POST /auth/login, GET /auth/me
      oauth.ts                    — POST /auth/oauth/google, POST /auth/oauth/apple
      sync.ts                     — POST /sync/push, GET /sync/pull
    middleware/
      authenticate.ts             — JWT preHandler hook
    utils/
      password.ts                 — hashPassword, verifyPassword (bcryptjs wrappers)
  tests/
    health.test.ts
    auth.test.ts
    oauth.test.ts
    sync.test.ts
  package.json
  tsconfig.json
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/tests/health.test.ts`

- [ ] **Step 1: Write the failing health test**

Create `apps/api/tests/health.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { createApp } from '../src/app.js'

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const app = await createApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mywatch/api test`
Expected: FAIL — `Cannot find module '../src/app.js'`

- [ ] **Step 3: Create package.json**

Create `apps/api/package.json`:
```json
{
  "name": "@mywatch/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup src/index.ts --format esm --dts",
    "start": "node dist/index.js",
    "test": "vitest run --reporter=verbose",
    "migrate": "tsx src/db/migrate.ts"
  },
  "dependencies": {
    "@fastify/jwt": "^9.0.0",
    "@mywatch/core": "workspace:*",
    "@mywatch/sync": "workspace:*",
    "apple-signin-auth": "^1.7.5",
    "bcryptjs": "^2.4.3",
    "fastify": "^5.0.0",
    "google-auth-library": "^9.14.0",
    "postgres": "^3.4.4"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "tsx": "^4.7.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

Create `apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 5: Create src/app.ts**

Create `apps/api/src/app.ts`:
```typescript
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'

export interface AppDeps {
  // populated by later tasks
}

export async function createApp(_deps?: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
```

- [ ] **Step 6: Create src/index.ts**

Create `apps/api/src/index.ts`:
```typescript
import { createApp } from './app.js'

const app = await createApp()
const port = parseInt(process.env.PORT ?? '3001', 10)

await app.listen({ port, host: '0.0.0.0' })
console.log(`API listening on http://0.0.0.0:${port}`)
```

- [ ] **Step 7: Install dependencies**

Run: `pnpm install`
Expected: packages installed, no errors

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @mywatch/api test`
Expected: PASS — `GET /health > returns 200 ok`

- [ ] **Step 9: Commit**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/src/app.ts apps/api/src/index.ts apps/api/tests/health.test.ts
git commit -m "feat(api): scaffold Fastify app with health endpoint"
```

---

## Task 2: DB Client + Migrations

**Files:**
- Create: `apps/api/src/db/client.ts`
- Create: `apps/api/src/db/migrate.ts`
- Create: `apps/api/src/db/migrations/001_initial.sql`

No unit tests for this task — SQL migration correctness requires a live PostgreSQL instance. The migration runner is verified by running `pnpm --filter @mywatch/api migrate` against a real DB (instructions in step notes).

- [ ] **Step 1: Create DB client**

Create `apps/api/src/db/client.ts`:
```typescript
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/mywatch'

export const sql = postgres(connectionString)
```

- [ ] **Step 2: Create the initial SQL migration**

Create `apps/api/src/db/migrations/001_initial.sql`:
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  is_guest BOOLEAN NOT NULL DEFAULT true,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  UNIQUE(provider, provider_account_id)
);

CREATE TYPE media_type AS ENUM ('movie', 'tv');
CREATE TYPE watch_status AS ENUM ('planned', 'in_progress', 'watched', 'quit');

CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  tmdb_id INTEGER NOT NULL,
  media_type media_type NOT NULL,
  status watch_status NOT NULL,
  progress_episode INTEGER CHECK (progress_episode >= 0),
  progress_season INTEGER CHECK (progress_season >= 0),
  rating INTEGER CHECK (rating BETWEEN 1 AND 10),
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  quit_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  device_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, tmdb_id, media_type)
);

CREATE TABLE IF NOT EXISTS media_cache (
  tmdb_id INTEGER NOT NULL,
  media_type media_type NOT NULL,
  title TEXT NOT NULL,
  overview TEXT NOT NULL DEFAULT '',
  poster_path TEXT,
  backdrop_path TEXT,
  release_date DATE,
  genres JSONB NOT NULL DEFAULT '[]',
  vote_average NUMERIC(4,2) NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  runtime INTEGER,
  seasons_count INTEGER,
  show_status TEXT,
  cached_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tmdb_id, media_type)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Note: `gen_random_uuid()` requires PostgreSQL 13+. `media_type` and `watch_status` are PostgreSQL enum types. The `UNIQUE(user_id, tmdb_id, media_type)` constraint on watchlist_items prevents duplicates per user+media combination.

- [ ] **Step 3: Create migration runner**

Create `apps/api/src/db/migrate.ts`:
```typescript
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from './client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, 'migrations')

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  const applied = await sql<{ version: string }[]>`
    SELECT version FROM schema_migrations ORDER BY version
  `
  const appliedVersions = new Set(applied.map((r) => r.version))

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const version = file.replace('.sql', '')
    if (appliedVersions.has(version)) {
      console.log(`  skip  ${file}`)
      continue
    }

    const content = await readFile(join(MIGRATIONS_DIR, file), 'utf-8')
    await sql.unsafe(content)
    await sql`INSERT INTO schema_migrations (version) VALUES (${version})`
    console.log(`  apply ${file}`)
  }

  console.log('Migrations complete.')
  await sql.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/
git commit -m "feat(api): add postgres client and initial DB migration"
```

---

## Task 3: Password Utilities

**Files:**
- Create: `apps/api/src/utils/password.ts`
- Create: `apps/api/tests/password.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/password.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../src/utils/password.js'

describe('hashPassword', () => {
  it('produces a bcrypt hash different from the input', async () => {
    const hash = await hashPassword('secret123')
    expect(hash).not.toBe('secret123')
    expect(hash.startsWith('$2b$')).toBe(true)
  })

  it('produces different hashes for the same input', async () => {
    const hash1 = await hashPassword('secret123')
    const hash2 = await hashPassword('secret123')
    expect(hash1).not.toBe(hash2)
  })
})

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const hash = await hashPassword('mypassword')
    expect(await verifyPassword('mypassword', hash)).toBe(true)
  })

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('mypassword')
    expect(await verifyPassword('wrongpassword', hash)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mywatch/api test`
Expected: FAIL — `Cannot find module '../src/utils/password.js'`

- [ ] **Step 3: Implement password utilities**

Create `apps/api/src/utils/password.ts`:
```typescript
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mywatch/api test`
Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/password.ts apps/api/tests/password.test.ts
git commit -m "feat(api): add bcrypt password hash/verify utilities"
```

---

## Task 4: User Repository

**Files:**
- Create: `apps/api/src/repos/user-repo.ts`

No unit tests for the SQL implementation — tested indirectly via route tests in Tasks 5 and 6. The interface is the contract that mocks implement.

- [ ] **Step 1: Create UserRepo interface and implementation**

Create `apps/api/src/repos/user-repo.ts`:
```typescript
import type { Sql } from 'postgres'

export interface UserRecord {
  id: string
  email: string | null
  displayName: string
  avatarUrl: string | null
  isGuest: boolean
  passwordHash: string | null
  createdAt: string
  updatedAt: string
}

export interface UserRepo {
  findByEmail(email: string): Promise<UserRecord | null>
  findById(id: string): Promise<UserRecord | null>
  create(data: {
    email: string
    displayName: string
    passwordHash: string
  }): Promise<UserRecord>
  findOrCreateOAuth(data: {
    provider: string
    providerAccountId: string
    email: string | null
    displayName: string
    avatarUrl: string | null
  }): Promise<UserRecord>
}

interface UserRow {
  id: string
  email: string | null
  display_name: string
  avatar_url: string | null
  is_guest: boolean
  password_hash: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isGuest: row.is_guest,
    passwordHash: row.password_hash,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export function createUserRepo(sql: Sql): UserRepo {
  return {
    async findByEmail(email) {
      const rows = await sql<UserRow[]>`
        SELECT id, email, display_name, avatar_url, is_guest, password_hash, created_at, updated_at
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `
      return rows[0] ? mapRow(rows[0]) : null
    },

    async findById(id) {
      const rows = await sql<UserRow[]>`
        SELECT id, email, display_name, avatar_url, is_guest, password_hash, created_at, updated_at
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `
      return rows[0] ? mapRow(rows[0]) : null
    },

    async create({ email, displayName, passwordHash }) {
      const rows = await sql<UserRow[]>`
        INSERT INTO users (email, display_name, password_hash, is_guest)
        VALUES (${email}, ${displayName}, ${passwordHash}, false)
        RETURNING id, email, display_name, avatar_url, is_guest, password_hash, created_at, updated_at
      `
      return mapRow(rows[0])
    },

    async findOrCreateOAuth({ provider, providerAccountId, email, displayName, avatarUrl }) {
      return sql.begin(async (tx) => {
        // Check if oauth account already exists
        const existing = await tx<{ user_id: string }[]>`
          SELECT user_id FROM oauth_accounts
          WHERE provider = ${provider} AND provider_account_id = ${providerAccountId}
          LIMIT 1
        `
        if (existing[0]) {
          const rows = await tx<UserRow[]>`
            SELECT id, email, display_name, avatar_url, is_guest, password_hash, created_at, updated_at
            FROM users WHERE id = ${existing[0].user_id}
          `
          return mapRow(rows[0])
        }

        // Create new user + link oauth account
        const userRows = await tx<UserRow[]>`
          INSERT INTO users (email, display_name, avatar_url, is_guest)
          VALUES (${email}, ${displayName}, ${avatarUrl}, false)
          ON CONFLICT (email) DO UPDATE
            SET display_name = EXCLUDED.display_name,
                avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
                updated_at = NOW()
          RETURNING id, email, display_name, avatar_url, is_guest, password_hash, created_at, updated_at
        `
        const user = mapRow(userRows[0])

        await tx`
          INSERT INTO oauth_accounts (user_id, provider, provider_account_id)
          VALUES (${user.id}, ${provider}, ${providerAccountId})
          ON CONFLICT DO NOTHING
        `

        return user
      })
    },
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/repos/user-repo.ts
git commit -m "feat(api): add UserRepo interface and postgres implementation"
```

---

## Task 5: Auth Routes (Email/Password + JWT)

**Files:**
- Create: `apps/api/src/auth.d.ts`
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/auth.test.ts`

- [ ] **Step 1: Write the failing auth route tests**

Create `apps/api/tests/auth.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../src/app.js'
import type { UserRepo, UserRecord } from '../src/repos/user-repo.js'

vi.mock('../src/utils/password.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('$hashed$'),
  verifyPassword: vi.fn().mockResolvedValue(true),
}))

const mockUser: UserRecord = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  isGuest: false,
  passwordHash: '$hashed$',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

function makeMockUserRepo(overrides?: Partial<UserRepo>): UserRepo {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(mockUser),
    create: vi.fn().mockResolvedValue(mockUser),
    findOrCreateOAuth: vi.fn().mockResolvedValue(mockUser),
    ...overrides,
  }
}

describe('POST /auth/register', () => {
  it('creates user and returns token + user', async () => {
    const userRepo = makeMockUserRepo()
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'password123', displayName: 'Test User' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ token: string; user: { id: string; email: string } }>()
    expect(body.token).toBeDefined()
    expect(body.user.email).toBe('test@example.com')
  })

  it('returns 409 when email already registered', async () => {
    const userRepo = makeMockUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) })
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'password123', displayName: 'Test User' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 400 for missing fields', async () => {
    const app = await createApp({ userRepo: makeMockUserRepo() })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /auth/login', () => {
  it('returns token for valid credentials', async () => {
    const userRepo = makeMockUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) })
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ token: string; user: { id: string } }>()
    expect(body.token).toBeDefined()
  })

  it('returns 401 for unknown email', async () => {
    const userRepo = makeMockUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) })
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'password123' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for wrong password', async () => {
    const { verifyPassword } = await import('../src/utils/password.js')
    vi.mocked(verifyPassword).mockResolvedValueOnce(false)
    const userRepo = makeMockUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) })
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'wrongpassword' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /auth/me', () => {
  it('returns user for valid JWT', async () => {
    const userRepo = makeMockUserRepo()
    const app = await createApp({ userRepo })
    const token = app.jwt.sign({ sub: mockUser.id, email: mockUser.email, isGuest: false })
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ id: string }>().id).toBe(mockUser.id)
  })

  it('returns 401 without token', async () => {
    const app = await createApp({ userRepo: makeMockUserRepo() })
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mywatch/api test`
Expected: FAIL — routes not yet registered

- [ ] **Step 3: Create JWT type augmentation**

Create `apps/api/src/auth.d.ts`:
```typescript
import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string | null; isGuest: boolean }
    user: { sub: string; email: string | null; isGuest: boolean }
  }
}
```

- [ ] **Step 4: Create auth routes**

Create `apps/api/src/routes/auth.ts`:
```typescript
import type { FastifyInstance } from 'fastify'
import type { UserRepo } from '../repos/user-repo.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { authenticate } from '../middleware/authenticate.js'

interface RegisterBody {
  email: string
  password: string
  displayName: string
}

interface LoginBody {
  email: string
  password: string
}

function signToken(app: FastifyInstance, user: { id: string; email: string | null; isGuest: boolean }) {
  return app.jwt.sign({ sub: user.id, email: user.email, isGuest: user.isGuest })
}

function userResponse(user: { id: string; email: string | null; displayName: string; avatarUrl: string | null; isGuest: boolean }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isGuest: user.isGuest,
  }
}

export function registerAuthRoutes(app: FastifyInstance, userRepo: UserRepo) {
  app.post<{ Body: RegisterBody }>(
    '/auth/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'displayName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            displayName: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password, displayName } = req.body

      const existing = await userRepo.findByEmail(email)
      if (existing) {
        return reply.status(409).send({ error: 'Email already registered' })
      }

      const passwordHash = await hashPassword(password)
      const user = await userRepo.create({ email, displayName, passwordHash })
      const token = signToken(app, user)

      return reply.status(201).send({ token, user: userResponse(user) })
    },
  )

  app.post<{ Body: LoginBody }>(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body

      const user = await userRepo.findByEmail(email)
      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      const valid = await verifyPassword(password, user.passwordHash)
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      const token = signToken(app, user)
      return reply.send({ token, user: userResponse(user) })
    },
  )

  app.get(
    '/auth/me',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const user = await userRepo.findById(req.user.sub)
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }
      return reply.send(userResponse(user))
    },
  )
}
```

- [ ] **Step 5: Create authenticate middleware (needed by auth route)**

Create `apps/api/src/middleware/authenticate.ts`:
```typescript
import type { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}
```

- [ ] **Step 6: Update src/app.ts to register auth routes and accept userRepo**

Replace `apps/api/src/app.ts` entirely:
```typescript
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'
import type { UserRepo } from './repos/user-repo.js'
import type { WatchlistRepo } from './repos/watchlist-repo.js'
import { registerAuthRoutes } from './routes/auth.js'

export interface AppDeps {
  userRepo?: UserRepo
  watchlistRepo?: WatchlistRepo
}

export async function createApp(deps?: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  app.get('/health', async () => ({ status: 'ok' }))

  if (deps?.userRepo) {
    registerAuthRoutes(app, deps.userRepo)
  }

  return app
}
```

Note: `WatchlistRepo` is imported but used later. The TypeScript compiler will need the file to exist. Create a placeholder:

Create `apps/api/src/repos/watchlist-repo.ts` (placeholder, completed in Task 8):
```typescript
import type { WatchlistItem } from '@mywatch/core'
import type { Sql } from 'postgres'

export interface WatchlistRepo {
  upsertItems(userId: string, items: WatchlistItem[]): Promise<void>
  findSince(userId: string, since: string): Promise<WatchlistItem[]>
}

export function createWatchlistRepo(_sql: Sql): WatchlistRepo {
  throw new Error('WatchlistRepo not yet implemented')
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @mywatch/api test`
Expected: PASS — all auth tests and health test passing

If GET /auth/me test fails with a signing error, check that `app.jwt.sign` is available on the Fastify instance. The `@fastify/jwt` plugin decorates `app.jwt` after `await app.register(jwt, ...)`. In tests, the app is awaited via `createApp()`, so `app.jwt` is available.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/auth.d.ts apps/api/src/routes/auth.ts apps/api/src/middleware/authenticate.ts apps/api/src/repos/watchlist-repo.ts apps/api/src/app.ts apps/api/tests/auth.test.ts
git commit -m "feat(api): add email/password auth routes and JWT middleware"
```

---

## Task 6: OAuth Routes (Google + Apple)

**Files:**
- Create: `apps/api/src/routes/oauth.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/oauth.test.ts`

- [ ] **Step 1: Write failing OAuth tests**

Create `apps/api/tests/oauth.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { createApp } from '../src/app.js'
import type { UserRepo, UserRecord } from '../src/repos/user-repo.js'

const mockUser: UserRecord = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'oauth@example.com',
  displayName: 'OAuth User',
  avatarUrl: 'https://example.com/photo.jpg',
  isGuest: false,
  passwordHash: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-uid-123',
        email: 'oauth@example.com',
        name: 'OAuth User',
        picture: 'https://example.com/photo.jpg',
      }),
    }),
  })),
}))

vi.mock('apple-signin-auth', () => ({
  default: {
    verifyIdToken: vi.fn().mockResolvedValue({
      sub: 'apple-uid-456',
      email: 'oauth@example.com',
    }),
  },
}))

function makeMockUserRepo(): UserRepo {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(mockUser),
    create: vi.fn().mockResolvedValue(mockUser),
    findOrCreateOAuth: vi.fn().mockResolvedValue(mockUser),
  }
}

describe('POST /auth/oauth/google', () => {
  it('verifies Google token and returns JWT', async () => {
    const userRepo = makeMockUserRepo()
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oauth/google',
      payload: { idToken: 'google-id-token-value' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ token: string; user: { id: string } }>()
    expect(body.token).toBeDefined()
    expect(body.user.id).toBe(mockUser.id)
  })

  it('returns 400 when idToken is missing', async () => {
    const app = await createApp({ userRepo: makeMockUserRepo() })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oauth/google',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 when Google token is invalid', async () => {
    const { OAuth2Client } = await import('google-auth-library')
    vi.mocked(OAuth2Client).mockImplementationOnce(
      () => ({
        verifyIdToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
      }) as unknown as InstanceType<typeof OAuth2Client>,
    )
    const app = await createApp({ userRepo: makeMockUserRepo() })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oauth/google',
      payload: { idToken: 'bad-token' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /auth/oauth/apple', () => {
  it('verifies Apple token and returns JWT', async () => {
    const userRepo = makeMockUserRepo()
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oauth/apple',
      payload: { identityToken: 'apple-id-token-value' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ token: string; user: { id: string } }>()
    expect(body.token).toBeDefined()
  })

  it('returns 401 when Apple token is invalid', async () => {
    const appleSignin = await import('apple-signin-auth')
    vi.mocked(appleSignin.default.verifyIdToken).mockRejectedValueOnce(
      new Error('Invalid token'),
    )
    const app = await createApp({ userRepo: makeMockUserRepo() })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oauth/apple',
      payload: { identityToken: 'bad-token' },
    })
    expect(res.statusCode).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mywatch/api test`
Expected: FAIL — `/auth/oauth/google` and `/auth/oauth/apple` routes not found (404)

- [ ] **Step 3: Create OAuth routes**

Create `apps/api/src/routes/oauth.ts`:
```typescript
import type { FastifyInstance } from 'fastify'
import { OAuth2Client } from 'google-auth-library'
import appleSignin from 'apple-signin-auth'
import type { UserRepo } from '../repos/user-repo.js'

function userResponse(user: {
  id: string; email: string | null; displayName: string; avatarUrl: string | null; isGuest: boolean
}) {
  return { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, isGuest: user.isGuest }
}

export function registerOAuthRoutes(app: FastifyInstance, userRepo: UserRepo) {
  app.post<{ Body: { idToken: string } }>(
    '/auth/oauth/google',
    {
      schema: {
        body: {
          type: 'object',
          required: ['idToken'],
          properties: { idToken: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const { idToken } = req.body
      try {
        const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
        const client = new OAuth2Client(clientId)
        const ticket = await client.verifyIdToken({ idToken, audience: clientId })
        const payload = ticket.getPayload()
        if (!payload) throw new Error('Empty payload')

        const user = await userRepo.findOrCreateOAuth({
          provider: 'google',
          providerAccountId: payload.sub!,
          email: payload.email ?? null,
          displayName: payload.name ?? payload.email ?? 'Google User',
          avatarUrl: payload.picture ?? null,
        })

        const token = app.jwt.sign({ sub: user.id, email: user.email, isGuest: false })
        return reply.send({ token, user: userResponse(user) })
      } catch {
        return reply.status(401).send({ error: 'Invalid Google token' })
      }
    },
  )

  app.post<{ Body: { identityToken: string; fullName?: { firstName?: string; lastName?: string } } }>(
    '/auth/oauth/apple',
    {
      schema: {
        body: {
          type: 'object',
          required: ['identityToken'],
          properties: {
            identityToken: { type: 'string' },
            fullName: {
              type: 'object',
              properties: {
                firstName: { type: 'string' },
                lastName: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { identityToken, fullName } = req.body
      try {
        const decodedToken = await appleSignin.verifyIdToken(identityToken, {
          audience: process.env.APPLE_BUNDLE_ID ?? '',
          ignoreExpiration: false,
        })

        const displayName = fullName
          ? [fullName.firstName, fullName.lastName].filter(Boolean).join(' ') || 'Apple User'
          : 'Apple User'

        const user = await userRepo.findOrCreateOAuth({
          provider: 'apple',
          providerAccountId: decodedToken.sub,
          email: decodedToken.email ?? null,
          displayName,
          avatarUrl: null,
        })

        const token = app.jwt.sign({ sub: user.id, email: user.email, isGuest: false })
        return reply.send({ token, user: userResponse(user) })
      } catch {
        return reply.status(401).send({ error: 'Invalid Apple token' })
      }
    },
  )
}
```

- [ ] **Step 4: Register OAuth routes in app.ts**

Replace `apps/api/src/app.ts` entirely:
```typescript
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'
import type { UserRepo } from './repos/user-repo.js'
import type { WatchlistRepo } from './repos/watchlist-repo.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerOAuthRoutes } from './routes/oauth.js'

export interface AppDeps {
  userRepo?: UserRepo
  watchlistRepo?: WatchlistRepo
}

export async function createApp(deps?: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  app.get('/health', async () => ({ status: 'ok' }))

  if (deps?.userRepo) {
    registerAuthRoutes(app, deps.userRepo)
    registerOAuthRoutes(app, deps.userRepo)
  }

  return app
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @mywatch/api test`
Expected: PASS — all tests passing (health + auth + oauth)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/oauth.ts apps/api/src/app.ts apps/api/tests/oauth.test.ts
git commit -m "feat(api): add Google and Apple OAuth routes"
```

---

## Task 7: Watchlist Repository

**Files:**
- Modify: `apps/api/src/repos/watchlist-repo.ts` (replace placeholder)

No unit tests — tested indirectly via sync route tests in Tasks 8 and 9.

- [ ] **Step 1: Replace watchlist-repo.ts placeholder with full implementation**

Replace `apps/api/src/repos/watchlist-repo.ts` entirely:
```typescript
import type { WatchlistItem } from '@mywatch/core'
import type { Sql } from 'postgres'

export interface WatchlistRepo {
  upsertItems(userId: string, items: WatchlistItem[]): Promise<void>
  findSince(userId: string, since: string): Promise<WatchlistItem[]>
}

interface WatchlistRow {
  id: string
  user_id: string
  tmdb_id: number
  media_type: 'movie' | 'tv'
  status: 'planned' | 'in_progress' | 'watched' | 'quit'
  progress_episode: number | null
  progress_season: number | null
  rating: number | null
  notes: string | null
  added_at: Date
  started_at: Date | null
  finished_at: Date | null
  quit_at: Date | null
  updated_at: Date
  device_id: string
  deleted_at: Date | null
}

function mapRow(row: WatchlistRow): WatchlistItem {
  return {
    id: row.id,
    userId: row.user_id,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    status: row.status,
    progressEpisode: row.progress_episode,
    progressSeason: row.progress_season,
    rating: row.rating,
    notes: row.notes,
    addedAt: row.added_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    finishedAt: row.finished_at?.toISOString() ?? null,
    quitAt: row.quit_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
    deviceId: row.device_id,
    deletedAt: row.deleted_at?.toISOString() ?? null,
  }
}

export function createWatchlistRepo(sql: Sql): WatchlistRepo {
  return {
    async upsertItems(userId, items) {
      if (items.length === 0) return

      for (const item of items) {
        await sql`
          INSERT INTO watchlist_items (
            id, user_id, tmdb_id, media_type, status,
            progress_episode, progress_season, rating, notes,
            added_at, started_at, finished_at, quit_at,
            updated_at, device_id, deleted_at
          ) VALUES (
            ${item.id}, ${userId}, ${item.tmdbId}, ${item.mediaType}, ${item.status},
            ${item.progressEpisode}, ${item.progressSeason}, ${item.rating}, ${item.notes},
            ${item.addedAt}, ${item.startedAt}, ${item.finishedAt}, ${item.quitAt},
            ${item.updatedAt}, ${item.deviceId}, ${item.deletedAt}
          )
          ON CONFLICT (user_id, tmdb_id, media_type) DO UPDATE SET
            id = EXCLUDED.id,
            status = EXCLUDED.status,
            progress_episode = EXCLUDED.progress_episode,
            progress_season = EXCLUDED.progress_season,
            rating = EXCLUDED.rating,
            notes = EXCLUDED.notes,
            started_at = EXCLUDED.started_at,
            finished_at = EXCLUDED.finished_at,
            quit_at = EXCLUDED.quit_at,
            updated_at = EXCLUDED.updated_at,
            device_id = EXCLUDED.device_id,
            deleted_at = EXCLUDED.deleted_at
          WHERE EXCLUDED.updated_at > watchlist_items.updated_at
        `
      }
    },

    async findSince(userId, since) {
      const rows = await sql<WatchlistRow[]>`
        SELECT id, user_id, tmdb_id, media_type, status,
               progress_episode, progress_season, rating, notes,
               added_at, started_at, finished_at, quit_at,
               updated_at, device_id, deleted_at
        FROM watchlist_items
        WHERE user_id = ${userId}
          AND updated_at > ${since}::timestamptz
        ORDER BY updated_at ASC
      `
      return rows.map(mapRow)
    },
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/repos/watchlist-repo.ts
git commit -m "feat(api): implement WatchlistRepo with upsert and findSince"
```

---

## Task 8: Sync Push Endpoint

**Files:**
- Create: `apps/api/src/routes/sync.ts` (push only, pull added in Task 9)
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/sync.test.ts`

- [ ] **Step 1: Write failing sync push test**

Create `apps/api/tests/sync.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { createApp } from '../src/app.js'
import type { UserRepo, UserRecord } from '../src/repos/user-repo.js'
import type { WatchlistRepo } from '../src/repos/watchlist-repo.js'
import type { WatchlistItem } from '@mywatch/core'

const mockUser: UserRecord = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  isGuest: false,
  passwordHash: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const mockItem: WatchlistItem = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  userId: mockUser.id,
  tmdbId: 1234,
  mediaType: 'movie',
  status: 'planned',
  progressEpisode: null,
  progressSeason: null,
  rating: null,
  notes: null,
  addedAt: '2024-01-01T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  quitAt: null,
  updatedAt: '2024-01-01T00:00:00.000Z',
  deviceId: 'device-abc',
  deletedAt: null,
}

function makeUserRepo(): UserRepo {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(mockUser),
    create: vi.fn().mockResolvedValue(mockUser),
    findOrCreateOAuth: vi.fn().mockResolvedValue(mockUser),
  }
}

function makeWatchlistRepo(): WatchlistRepo {
  return {
    upsertItems: vi.fn().mockResolvedValue(undefined),
    findSince: vi.fn().mockResolvedValue([mockItem]),
  }
}

function getAuthToken(app: Awaited<ReturnType<typeof createApp>>) {
  return app.jwt.sign({ sub: mockUser.id, email: mockUser.email, isGuest: false })
}

describe('POST /sync/push', () => {
  it('upserts items and returns pushedAt', async () => {
    const watchlistRepo = makeWatchlistRepo()
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo })
    const token = getAuthToken(app)

    const res = await app.inject({
      method: 'POST',
      url: '/sync/push',
      headers: { authorization: `Bearer ${token}` },
      payload: { items: [mockItem] },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ pushedAt: string }>()
    expect(body.pushedAt).toBeDefined()
    expect(new Date(body.pushedAt).getTime()).toBeGreaterThan(0)
    expect(watchlistRepo.upsertItems).toHaveBeenCalledWith(mockUser.id, [mockItem])
  })

  it('returns 401 without token', async () => {
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo: makeWatchlistRepo() })
    const res = await app.inject({
      method: 'POST',
      url: '/sync/push',
      payload: { items: [] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects items belonging to a different user', async () => {
    const watchlistRepo = makeWatchlistRepo()
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo })
    const token = getAuthToken(app)

    const foreignItem: WatchlistItem = { ...mockItem, userId: 'ffffffff-ffff-ffff-ffff-ffffffffffff' }
    const res = await app.inject({
      method: 'POST',
      url: '/sync/push',
      headers: { authorization: `Bearer ${token}` },
      payload: { items: [foreignItem] },
    })
    expect(res.statusCode).toBe(403)
  })

  it('accepts empty items array', async () => {
    const watchlistRepo = makeWatchlistRepo()
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo })
    const token = getAuthToken(app)

    const res = await app.inject({
      method: 'POST',
      url: '/sync/push',
      headers: { authorization: `Bearer ${token}` },
      payload: { items: [] },
    })
    expect(res.statusCode).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mywatch/api test`
Expected: FAIL — `/sync/push` returns 404

- [ ] **Step 3: Create sync routes file (push only)**

Create `apps/api/src/routes/sync.ts`:
```typescript
import type { FastifyInstance } from 'fastify'
import type { WatchlistItem } from '@mywatch/core'
import type { WatchlistRepo } from '../repos/watchlist-repo.js'
import { authenticate } from '../middleware/authenticate.js'

export function registerSyncRoutes(app: FastifyInstance, watchlistRepo: WatchlistRepo) {
  app.post<{ Body: { items: WatchlistItem[] } }>(
    '/sync/push',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: { type: 'array' },
          },
        },
      },
    },
    async (req, reply) => {
      const { items } = req.body
      const userId = req.user.sub

      const foreign = items.find((item) => item.userId !== userId)
      if (foreign) {
        return reply.status(403).send({ error: 'Cannot push items for another user' })
      }

      await watchlistRepo.upsertItems(userId, items)
      return reply.send({ pushedAt: new Date().toISOString() })
    },
  )
}
```

- [ ] **Step 4: Register sync routes in app.ts**

Replace `apps/api/src/app.ts` entirely:
```typescript
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'
import type { UserRepo } from './repos/user-repo.js'
import type { WatchlistRepo } from './repos/watchlist-repo.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerOAuthRoutes } from './routes/oauth.js'
import { registerSyncRoutes } from './routes/sync.js'

export interface AppDeps {
  userRepo?: UserRepo
  watchlistRepo?: WatchlistRepo
}

export async function createApp(deps?: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  app.get('/health', async () => ({ status: 'ok' }))

  if (deps?.userRepo) {
    registerAuthRoutes(app, deps.userRepo)
    registerOAuthRoutes(app, deps.userRepo)
  }

  if (deps?.watchlistRepo) {
    registerSyncRoutes(app, deps.watchlistRepo)
  }

  return app
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @mywatch/api test`
Expected: PASS — all tests pass including the 4 sync push tests

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/sync.ts apps/api/src/app.ts apps/api/tests/sync.test.ts
git commit -m "feat(api): add POST /sync/push endpoint"
```

---

## Task 9: Sync Pull Endpoint

**Files:**
- Modify: `apps/api/src/routes/sync.ts`
- Modify: `apps/api/tests/sync.test.ts`

- [ ] **Step 1: Add failing sync pull tests**

Append to `apps/api/tests/sync.test.ts` (after the existing push describe block):
```typescript
describe('GET /sync/pull', () => {
  it('returns items updated since given timestamp', async () => {
    const watchlistRepo = makeWatchlistRepo()
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo })
    const token = getAuthToken(app)
    const since = '2024-01-01T00:00:00.000Z'

    const res = await app.inject({
      method: 'GET',
      url: `/sync/pull?since=${encodeURIComponent(since)}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ items: WatchlistItem[]; pulledAt: string }>()
    expect(body.pulledAt).toBeDefined()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].id).toBe(mockItem.id)
    expect(watchlistRepo.findSince).toHaveBeenCalledWith(mockUser.id, since)
  })

  it('returns 401 without token', async () => {
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo: makeWatchlistRepo() })
    const res = await app.inject({
      method: 'GET',
      url: '/sync/pull?since=2024-01-01T00:00:00.000Z',
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 when since param is missing', async () => {
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo: makeWatchlistRepo() })
    const token = getAuthToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/sync/pull',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('uses epoch (1970) when since=0 to pull all items', async () => {
    const watchlistRepo = makeWatchlistRepo()
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo })
    const token = getAuthToken(app)

    const res = await app.inject({
      method: 'GET',
      url: '/sync/pull?since=1970-01-01T00:00:00.000Z',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(watchlistRepo.findSince).toHaveBeenCalledWith(
      mockUser.id,
      '1970-01-01T00:00:00.000Z',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mywatch/api test`
Expected: FAIL — `GET /sync/pull` returns 404

- [ ] **Step 3: Add pull endpoint to sync routes**

Replace `apps/api/src/routes/sync.ts` entirely:
```typescript
import type { FastifyInstance } from 'fastify'
import type { WatchlistItem } from '@mywatch/core'
import type { WatchlistRepo } from '../repos/watchlist-repo.js'
import { authenticate } from '../middleware/authenticate.js'

export function registerSyncRoutes(app: FastifyInstance, watchlistRepo: WatchlistRepo) {
  app.post<{ Body: { items: WatchlistItem[] } }>(
    '/sync/push',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: { type: 'array' },
          },
        },
      },
    },
    async (req, reply) => {
      const { items } = req.body
      const userId = req.user.sub

      const foreign = items.find((item) => item.userId !== userId)
      if (foreign) {
        return reply.status(403).send({ error: 'Cannot push items for another user' })
      }

      await watchlistRepo.upsertItems(userId, items)
      return reply.send({ pushedAt: new Date().toISOString() })
    },
  )

  app.get<{ Querystring: { since?: string } }>(
    '/sync/pull',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { since } = req.query

      if (!since) {
        return reply.status(400).send({ error: 'Missing required query param: since' })
      }

      if (isNaN(Date.parse(since))) {
        return reply.status(400).send({ error: 'Invalid since: must be an ISO 8601 timestamp' })
      }

      const userId = req.user.sub
      const items = await watchlistRepo.findSince(userId, since)
      const pulledAt = new Date().toISOString()

      return reply.send({ items, pulledAt })
    },
  )
}
```

- [ ] **Step 4: Run full test suite to verify all tests pass**

Run: `pnpm --filter @mywatch/api test`
Expected: PASS — all tests passing (health + auth + oauth + sync)

Then run from repo root to confirm no regressions:
Run: `pnpm test`
Expected: All tests pass across all packages (54 existing + new API tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/sync.ts apps/api/tests/sync.test.ts
git commit -m "feat(api): add GET /sync/pull endpoint"
```

---

## Production Wiring (Final Step)

After all tasks are complete, wire up the real DB in `src/index.ts`:

- [ ] **Replace `apps/api/src/index.ts` with production wiring**

```typescript
import { sql } from './db/client.js'
import { createUserRepo } from './repos/user-repo.js'
import { createWatchlistRepo } from './repos/watchlist-repo.js'
import { createApp } from './app.js'

const app = await createApp({
  userRepo: createUserRepo(sql),
  watchlistRepo: createWatchlistRepo(sql),
})

const port = parseInt(process.env.PORT ?? '3001', 10)
await app.listen({ port, host: '0.0.0.0' })
console.log(`API listening on http://0.0.0.0:${port}`)
```

- [ ] **Verify TypeScript compiles**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): wire real DB repos in production entry point"
```

---

## Environment Variables

The API requires these env vars (create a `.env` file in `apps/api/` for local dev):

```
DATABASE_URL=postgresql://localhost:5432/mywatch
JWT_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
APPLE_BUNDLE_ID=com.yourcompany.mywatch
PORT=3001
```
