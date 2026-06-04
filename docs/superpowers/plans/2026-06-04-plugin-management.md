# Plugin Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Plugins tab to Settings where users can view/toggle built-in plugins, upload custom plugins as compiled zip bundles, and remove custom plugins — all without an app restart.

**Architecture:** Plugin metadata lives in a PostgreSQL `installed_plugins` table. The API exposes CRUD endpoints and serves uploaded bundle files from `data/plugins/{id}/bundle.js`. The web client's `PluginRegistryProvider` fetches metadata, injects `<script>` tags for enabled custom bundles, and merges them with the build-time `PLUGINS` array (filtered by enabled state) into a React context. Existing `usePlugins()` and friends become real hooks reading from that context.

**Tech Stack:** Fastify 5, postgres.js, @fastify/multipart, unzipper, React context, Next.js App Router, Vitest

---

## File Map

**Create:**
- `apps/api/src/db/migrations/010_plugins.sql`
- `apps/api/src/repos/plugin-repo.ts`
- `apps/api/src/routes/plugins.ts`
- `apps/api/data/plugins/.gitkeep`
- `apps/web/src/plugins/official-catalog.ts`
- `apps/web/src/plugins/PluginRegistryProvider.tsx`
- `apps/web/src/components/settings/PluginsTab.tsx`
- `apps/api/tests/plugin-repo.test.ts`
- `apps/api/tests/plugins-routes.test.ts`

**Modify:**
- `packages/core/src/types.ts` — add `InstalledPluginMeta`
- `apps/api/src/app.ts` — add `pluginRepo` dep, register multipart + plugin routes
- `apps/api/src/index.ts` — instantiate `createPluginRepo`, pass to `createApp`
- `apps/web/src/plugins/index.ts` — read from context instead of static array
- `apps/web/src/app/layout.tsx` — wrap with `PluginRegistryProvider`
- `apps/web/src/app/profile/page.tsx` — add Plugins tab

---

## Task 1: DB migration — installed_plugins table

**Files:**
- Create: `apps/api/src/db/migrations/010_plugins.sql`

- [ ] **Step 1: Create migration file**

  Create `apps/api/src/db/migrations/010_plugins.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS installed_plugins (
    id          TEXT        PRIMARY KEY,
    display_name TEXT       NOT NULL,
    source      TEXT        NOT NULL CHECK (source IN ('builtin', 'custom')),
    enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
    installed_at TIMESTAMPTZ
  );
  ```

- [ ] **Step 2: Run migration**

  ```bash
  pnpm --filter @mywatch/api migrate
  ```
  Expected: `apply 010_plugins.sql` then `Migrations complete.`

- [ ] **Step 3: Commit**

  ```bash
  git add apps/api/src/db/migrations/010_plugins.sql
  git commit -m "feat(db): add installed_plugins table"
  ```

---

## Task 2: Add InstalledPluginMeta to @mywatch/core

**Files:**
- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: Append type to types.ts**

  At the end of `packages/core/src/types.ts`, add:
  ```typescript
  export interface InstalledPluginMeta {
    id: string
    displayName: string
    source: 'builtin' | 'custom'
    enabled: boolean
    installedAt?: string
  }
  ```

- [ ] **Step 2: Build core**

  ```bash
  pnpm --filter @mywatch/core build
  ```
  Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/core/src/types.ts
  git commit -m "feat(core): add InstalledPluginMeta type"
  ```

---

## Task 3: PluginRepo

**Files:**
- Create: `apps/api/src/repos/plugin-repo.ts`
- Create: `apps/api/tests/plugin-repo.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `apps/api/tests/plugin-repo.test.ts`:
  ```typescript
  import { describe, it, expect, beforeEach, vi } from 'vitest'
  import type { Sql } from 'postgres'
  import { createPluginRepo } from '../src/repos/plugin-repo.js'

  function makeSql(rows: unknown[] = []) {
    const sql = vi.fn().mockResolvedValue(rows) as unknown as Sql
    // Tagged template literal: sql`...` returns sql(...)
    return new Proxy(sql, {
      apply: (_t, _this, args) => sql(...args),
      get: (t, prop) => (prop === 'then' ? undefined : (t as Record<string, unknown>)[prop as string]),
    }) as unknown as Sql
  }

  describe('createPluginRepo', () => {
    it('list returns mapped rows', async () => {
      const sql = makeSql([
        { id: 'youtube', display_name: 'YouTube Links', source: 'builtin', enabled: true, installed_at: null },
      ])
      const repo = createPluginRepo(sql)
      const result = await repo.list()
      expect(result[0]).toEqual({
        id: 'youtube',
        displayName: 'YouTube Links',
        source: 'builtin',
        enabled: true,
        installedAt: undefined,
      })
    })

    it('getById returns null when no rows', async () => {
      const sql = makeSql([])
      const repo = createPluginRepo(sql)
      const result = await repo.getById('missing')
      expect(result).toBeNull()
    })

    it('upsert calls sql with correct params', async () => {
      const sql = makeSql()
      const repo = createPluginRepo(sql)
      await repo.upsert({ id: 'foo', displayName: 'Foo', source: 'custom', enabled: true, installedAt: '2026-01-01T00:00:00.000Z' })
      expect(sql).toHaveBeenCalled()
    })

    it('setEnabled calls sql', async () => {
      const sql = makeSql()
      const repo = createPluginRepo(sql)
      await repo.setEnabled('foo', false)
      expect(sql).toHaveBeenCalled()
    })

    it('remove calls sql', async () => {
      const sql = makeSql()
      const repo = createPluginRepo(sql)
      await repo.remove('foo')
      expect(sql).toHaveBeenCalled()
    })
  })
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  pnpm --filter @mywatch/api test tests/plugin-repo.test.ts
  ```
  Expected: FAIL — `createPluginRepo` not found.

- [ ] **Step 3: Create plugin-repo.ts**

  Create `apps/api/src/repos/plugin-repo.ts`:
  ```typescript
  import type { Sql } from 'postgres'
  import type { InstalledPluginMeta } from '@mywatch/core'

  export interface PluginRepo {
    list(): Promise<InstalledPluginMeta[]>
    getById(id: string): Promise<InstalledPluginMeta | null>
    upsert(meta: InstalledPluginMeta): Promise<void>
    setEnabled(id: string, enabled: boolean): Promise<void>
    remove(id: string): Promise<void>
  }

  interface PluginRow {
    id: string
    display_name: string
    source: 'builtin' | 'custom'
    enabled: boolean
    installed_at: Date | null
  }

  function rowToMeta(row: PluginRow): InstalledPluginMeta {
    return {
      id: row.id,
      displayName: row.display_name,
      source: row.source,
      enabled: row.enabled,
      installedAt: row.installed_at?.toISOString(),
    }
  }

  export function createPluginRepo(sql: Sql): PluginRepo {
    return {
      async list() {
        const rows = await sql<PluginRow[]>`
          SELECT id, display_name, source, enabled, installed_at
          FROM installed_plugins
          ORDER BY source, id
        `
        return rows.map(rowToMeta)
      },

      async getById(id) {
        const rows = await sql<PluginRow[]>`
          SELECT id, display_name, source, enabled, installed_at
          FROM installed_plugins WHERE id = ${id}
        `
        return rows[0] ? rowToMeta(rows[0]) : null
      },

      async upsert(meta) {
        await sql`
          INSERT INTO installed_plugins (id, display_name, source, enabled, installed_at)
          VALUES (
            ${meta.id}, ${meta.displayName}, ${meta.source}, ${meta.enabled},
            ${meta.installedAt ? new Date(meta.installedAt) : null}
          )
          ON CONFLICT (id) DO UPDATE SET
            display_name  = EXCLUDED.display_name,
            source        = EXCLUDED.source,
            enabled       = EXCLUDED.enabled,
            installed_at  = EXCLUDED.installed_at
        `
      },

      async setEnabled(id, enabled) {
        await sql`
          UPDATE installed_plugins SET enabled = ${enabled} WHERE id = ${id}
        `
      },

      async remove(id) {
        await sql`DELETE FROM installed_plugins WHERE id = ${id}`
      },
    }
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  pnpm --filter @mywatch/api test tests/plugin-repo.test.ts
  ```
  Expected: 5 passing.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/repos/plugin-repo.ts apps/api/tests/plugin-repo.test.ts
  git commit -m "feat(api): add PluginRepo for installed_plugins table"
  ```

---

## Task 4: Plugin bundle storage directory

**Files:**
- Create: `apps/api/data/plugins/.gitkeep`
- Modify: `apps/api/.gitignore`

- [ ] **Step 1: Create directory and gitkeep**

  ```bash
  mkdir -p apps/api/data/plugins
  touch apps/api/data/plugins/.gitkeep
  ```

- [ ] **Step 2: Gitignore uploaded bundle subdirectories**

  Create or append to `apps/api/.gitignore`:
  ```
  # uploaded plugin bundles
  data/plugins/*/
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/api/data/plugins/.gitkeep apps/api/.gitignore
  git commit -m "chore(api): add plugin bundle storage directory"
  ```

---

## Task 5: Plugin routes — list, toggle, delete, serve bundle

**Files:**
- Create: `apps/api/src/routes/plugins.ts`
- Create: `apps/api/tests/plugins-routes.test.ts`

- [ ] **Step 1: Write failing tests**

  Create `apps/api/tests/plugins-routes.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { createApp } from '../src/app.js'
  import type { PluginRepo } from '../src/repos/plugin-repo.js'
  import type { InstalledPluginMeta } from '@mywatch/core'

  function makeMockPluginRepo(overrides?: Partial<PluginRepo>): PluginRepo {
    return {
      list: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
      setEnabled: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }
  }

  const AUTH_HEADER = { authorization: 'Bearer test-token' }

  // Mock authenticate middleware to always pass
  vi.mock('../src/middleware/authenticate.js', () => ({
    authenticate: vi.fn().mockImplementation(async (req: { user: { sub: string } }) => {
      req.user = { sub: 'user-123' }
    }),
  }))

  describe('GET /api/plugins', () => {
    it('returns built-in plugins with default enabled=true when no DB record', async () => {
      const pluginRepo = makeMockPluginRepo({ list: vi.fn().mockResolvedValue([]) })
      const app = await createApp({ pluginRepo })
      const res = await app.inject({ method: 'GET', url: '/api/plugins', headers: AUTH_HEADER })
      expect(res.statusCode).toBe(200)
      const body = res.json<{ plugins: InstalledPluginMeta[] }>()
      const youtube = body.plugins.find((p) => p.id === 'youtube')
      expect(youtube).toBeDefined()
      expect(youtube?.enabled).toBe(true)
      expect(youtube?.source).toBe('builtin')
    })

    it('returns built-in plugin with enabled=false when DB record says so', async () => {
      const pluginRepo = makeMockPluginRepo({
        list: vi.fn().mockResolvedValue([
          { id: 'youtube', displayName: 'YouTube Links', source: 'builtin', enabled: false },
        ]),
      })
      const app = await createApp({ pluginRepo })
      const res = await app.inject({ method: 'GET', url: '/api/plugins', headers: AUTH_HEADER })
      const body = res.json<{ plugins: InstalledPluginMeta[] }>()
      expect(body.plugins.find((p) => p.id === 'youtube')?.enabled).toBe(false)
    })
  })

  describe('PATCH /api/plugins/:id', () => {
    it('upserts builtin plugin record with new enabled value', async () => {
      const pluginRepo = makeMockPluginRepo({ getById: vi.fn().mockResolvedValue(null) })
      const app = await createApp({ pluginRepo })
      const res = await app.inject({
        method: 'PATCH', url: '/api/plugins/youtube',
        headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
        payload: { enabled: false },
      })
      expect(res.statusCode).toBe(200)
      expect(pluginRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'youtube', enabled: false, source: 'builtin' })
      )
    })

    it('returns 400 for unknown plugin id', async () => {
      const pluginRepo = makeMockPluginRepo({ getById: vi.fn().mockResolvedValue(null) })
      const app = await createApp({ pluginRepo })
      const res = await app.inject({
        method: 'PATCH', url: '/api/plugins/nonexistent',
        headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
        payload: { enabled: false },
      })
      expect(res.statusCode).toBe(404)
    })

    it('returns 400 when enabled is not boolean', async () => {
      const app = await createApp({ pluginRepo: makeMockPluginRepo() })
      const res = await app.inject({
        method: 'PATCH', url: '/api/plugins/youtube',
        headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
        payload: { enabled: 'yes' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('DELETE /api/plugins/:id', () => {
    it('returns 400 when trying to remove a built-in plugin', async () => {
      const app = await createApp({ pluginRepo: makeMockPluginRepo() })
      const res = await app.inject({
        method: 'DELETE', url: '/api/plugins/youtube', headers: AUTH_HEADER,
      })
      expect(res.statusCode).toBe(400)
    })

    it('removes a custom plugin', async () => {
      const pluginRepo = makeMockPluginRepo({
        getById: vi.fn().mockResolvedValue({
          id: 'my-plugin', displayName: 'My Plugin', source: 'custom', enabled: true,
        }),
      })
      const app = await createApp({ pluginRepo })
      const res = await app.inject({
        method: 'DELETE', url: '/api/plugins/my-plugin', headers: AUTH_HEADER,
      })
      expect(res.statusCode).toBe(200)
      expect(pluginRepo.remove).toHaveBeenCalledWith('my-plugin')
    })
  })
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  pnpm --filter @mywatch/api test tests/plugins-routes.test.ts
  ```
  Expected: FAIL — routes not registered.

- [ ] **Step 3: Create plugins.ts routes file**

  Create `apps/api/src/routes/plugins.ts`:
  ```typescript
  import path from 'node:path'
  import fs from 'node:fs/promises'
  import type { FastifyInstance } from 'fastify'
  import { authenticate } from '../middleware/authenticate.js'
  import type { PluginRepo } from '../repos/plugin-repo.js'

  const BUILTIN_PLUGINS = [
    { id: 'youtube', displayName: 'YouTube Links' },
  ] as const

  type BuiltinId = (typeof BUILTIN_PLUGINS)[number]['id']
  const BUILTIN_IDS = new Set<string>(BUILTIN_PLUGINS.map((p) => p.id))

  const DATA_DIR = path.resolve(process.cwd(), 'data')
  export const PLUGINS_DIR = path.join(DATA_DIR, 'plugins')

  const ID_RE = /^[a-z0-9-]+$/

  export function registerPluginRoutes(app: FastifyInstance, pluginRepo: PluginRepo) {
    // GET /api/plugins
    app.get('/api/plugins', { preHandler: [authenticate] }, async (_req, reply) => {
      const dbRows = await pluginRepo.list()
      const dbMap = new Map(dbRows.map((r) => [r.id, r]))

      const builtins = BUILTIN_PLUGINS.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        source: 'builtin' as const,
        enabled: dbMap.get(p.id)?.enabled ?? true,
      }))

      const customs = dbRows
        .filter((r) => r.source === 'custom')
        .map((r) => ({
          id: r.id,
          displayName: r.displayName,
          source: 'custom' as const,
          enabled: r.enabled,
          installedAt: r.installedAt,
        }))

      return reply.send({ plugins: [...builtins, ...customs] })
    })

    // PATCH /api/plugins/:id
    app.patch<{ Params: { id: string }; Body: { enabled: unknown } }>(
      '/api/plugins/:id',
      { preHandler: [authenticate] },
      async (req, reply) => {
        const { id } = req.params
        const { enabled } = req.body
        if (typeof enabled !== 'boolean') {
          return reply.status(400).send({ error: 'enabled must be boolean' })
        }
        const existing = await pluginRepo.getById(id)
        if (!existing) {
          const builtin = BUILTIN_PLUGINS.find((p) => p.id === id)
          if (!builtin) return reply.status(404).send({ error: 'Plugin not found' })
          await pluginRepo.upsert({ id: builtin.id, displayName: builtin.displayName, source: 'builtin', enabled })
        } else {
          await pluginRepo.setEnabled(id, enabled)
        }
        return reply.send({ ok: true })
      },
    )

    // DELETE /api/plugins/:id
    app.delete<{ Params: { id: string } }>(
      '/api/plugins/:id',
      { preHandler: [authenticate] },
      async (req, reply) => {
        const { id } = req.params
        if (BUILTIN_IDS.has(id)) {
          return reply.status(400).send({ error: 'Cannot remove built-in plugins' })
        }
        const existing = await pluginRepo.getById(id)
        if (!existing) return reply.status(404).send({ error: 'Plugin not found' })
        const pluginDir = path.join(PLUGINS_DIR, id)
        await fs.rm(pluginDir, { recursive: true, force: true })
        await pluginRepo.remove(id)
        return reply.send({ ok: true })
      },
    )

    // GET /api/plugins/:id/bundle.js — no auth, same-origin fetch via script tag
    app.get<{ Params: { id: string } }>(
      '/api/plugins/:id/bundle.js',
      async (req, reply) => {
        const { id } = req.params
        if (!ID_RE.test(id)) return reply.status(400).send({ error: 'Invalid plugin id' })
        const bundlePath = path.join(PLUGINS_DIR, id, 'bundle.js')
        try {
          const content = await fs.readFile(bundlePath, 'utf-8')
          return reply.header('content-type', 'application/javascript; charset=utf-8').send(content)
        } catch {
          return reply.status(404).send({ error: 'Bundle not found' })
        }
      },
    )
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  These will still fail until routes are wired in app.ts (Task 7). Proceed to Task 6 first, then run all plugin tests together after Task 7.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/routes/plugins.ts apps/api/tests/plugins-routes.test.ts
  git commit -m "feat(api): add plugin list/toggle/delete/bundle-serve routes"
  ```

---

## Task 6: Plugin upload route

**Files:**
- Modify: `apps/api/src/routes/plugins.ts` — add POST /api/plugins/upload
- Modify: `apps/api/package.json` — add @fastify/multipart + unzipper

- [ ] **Step 1: Install dependencies**

  ```bash
  pnpm --filter @mywatch/api add @fastify/multipart unzipper
  pnpm --filter @mywatch/api add -D @types/unzipper
  ```

- [ ] **Step 2: Write upload validation tests**

  Add to `apps/api/tests/plugins-routes.test.ts` (inside the existing file, before the last `}`):
  ```typescript
  describe('POST /api/plugins/upload', () => {
    it('returns 400 when no file uploaded', async () => {
      const app = await createApp({ pluginRepo: makeMockPluginRepo() })
      const boundary = 'boundary123'
      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/upload',
        headers: {
          ...AUTH_HEADER,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: `--${boundary}--\r\n`,
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when zip missing bundle.js', async () => {
      // Build a zip buffer containing only manifest.json
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      zip.file('manifest.json', JSON.stringify({ id: 'test-plugin', displayName: 'Test' }))
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const app = await createApp({ pluginRepo: makeMockPluginRepo() })
      const boundary = 'boundary456'
      const header = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.zip"\r\nContent-Type: application/zip\r\n\r\n`
      )
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
      const payload = Buffer.concat([header, zipBuffer, footer])

      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/upload',
        headers: {
          ...AUTH_HEADER,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      })
      expect(res.statusCode).toBe(400)
      expect(res.json<{ error: string }>().error).toMatch(/bundle\.js/)
    })

    it('returns 400 when plugin id collides with builtin', async () => {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      zip.file('manifest.json', JSON.stringify({ id: 'youtube', displayName: 'Test' }))
      zip.file('bundle.js', '(function(){window.__mywatchPlugins=window.__mywatchPlugins||[];})();')
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const app = await createApp({ pluginRepo: makeMockPluginRepo() })
      const boundary = 'boundary789'
      const header = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.zip"\r\nContent-Type: application/zip\r\n\r\n`
      )
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
      const payload = Buffer.concat([header, zipBuffer, footer])

      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/upload',
        headers: {
          ...AUTH_HEADER,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      })
      expect(res.statusCode).toBe(400)
      expect(res.json<{ error: string }>().error).toMatch(/builtin/)
    })
  })
  ```

  Install jszip as dev dep for tests:
  ```bash
  pnpm --filter @mywatch/api add -D jszip
  ```

- [ ] **Step 3: Run tests to verify new ones fail**

  ```bash
  pnpm --filter @mywatch/api test tests/plugins-routes.test.ts
  ```
  Expected: upload tests FAIL — route not found yet.

- [ ] **Step 4: Add upload route to plugins.ts**

  Replace the imports at the top of `apps/api/src/routes/plugins.ts` with:
  ```typescript
  import path from 'node:path'
  import fs from 'node:fs/promises'
  import type { FastifyInstance } from 'fastify'
  import '@fastify/multipart'  // adds .file() to FastifyRequest type
  import unzipper from 'unzipper'
  import { authenticate } from '../middleware/authenticate.js'
  import type { PluginRepo } from '../repos/plugin-repo.js'
  ```

  Add this route inside `registerPluginRoutes`, after the bundle-serve route:
  ```typescript
    // POST /api/plugins/upload
    app.post('/api/plugins/upload', { preHandler: [authenticate] }, async (req, reply) => {
      const data = await req.file()
      if (!data) return reply.status(400).send({ error: 'No file uploaded' })

      let buffer: Buffer
      try {
        buffer = await data.toBuffer()
      } catch {
        return reply.status(400).send({ error: 'Failed to read uploaded file' })
      }

      let directory: unzipper.CentralDirectory
      try {
        directory = await unzipper.Open.buffer(buffer)
      } catch {
        return reply.status(400).send({ error: 'Invalid zip file' })
      }

      const manifestFile = directory.files.find((f) => f.path === 'manifest.json')
      const bundleFile = directory.files.find((f) => f.path === 'bundle.js')

      if (!manifestFile) return reply.status(400).send({ error: 'Missing manifest.json in zip' })
      if (!bundleFile) return reply.status(400).send({ error: 'Missing bundle.js in zip' })

      let manifest: { id?: unknown; displayName?: unknown }
      try {
        manifest = JSON.parse((await manifestFile.buffer()).toString())
      } catch {
        return reply.status(400).send({ error: 'manifest.json is not valid JSON' })
      }

      const { id, displayName } = manifest
      if (typeof id !== 'string' || !ID_RE.test(id) || id.length > 64) {
        return reply.status(400).send({ error: 'manifest id must be lowercase alphanumeric/dash, max 64 chars' })
      }
      if (typeof displayName !== 'string' || !displayName.trim()) {
        return reply.status(400).send({ error: 'manifest displayName is required' })
      }
      if (BUILTIN_IDS.has(id)) {
        return reply.status(400).send({ error: `Plugin id "${id}" conflicts with a built-in plugin` })
      }

      const bundleBuffer = await bundleFile.buffer()
      if (bundleBuffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({ error: 'bundle.js exceeds 5 MB limit' })
      }

      const pluginDir = path.join(PLUGINS_DIR, id)
      await fs.mkdir(pluginDir, { recursive: true })
      await fs.writeFile(path.join(pluginDir, 'bundle.js'), bundleBuffer)

      await pluginRepo.upsert({
        id,
        displayName: displayName.trim(),
        source: 'custom',
        enabled: true,
        installedAt: new Date().toISOString(),
      })

      return reply.status(201).send({ id, displayName: displayName.trim(), source: 'custom', enabled: true })
    })
  ```

  (The `import '@fastify/multipart'` added above handles TS augmentation for `req.file()`.)

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/routes/plugins.ts
  git commit -m "feat(api): add plugin upload route with zip validation"
  ```

---

## Task 7: Wire plugin routes into app.ts and index.ts

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Update AppDeps and app.ts**

  In `apps/api/src/app.ts`, add:

  ```typescript
  // Add to imports:
  import multipart from '@fastify/multipart'
  import type { PluginRepo } from './repos/plugin-repo.js'
  import { registerPluginRoutes } from './routes/plugins.js'

  // Add pluginRepo to AppDeps interface:
  export interface AppDeps {
    userRepo?: UserRepo
    watchlistRepo?: WatchlistRepo
    playlistRepo?: PlaylistRepo
    jellyfinRepo?: JellyfinRepo
    recapRepo?: RecapRepo
    pluginRepo?: PluginRepo                          // ← add this
    triggerBackgroundRecap?: (userId: string, tmdbId: number, mediaType: 'movie' | 'tv') => Promise<void>
    arrService?: any
  }

  // Register multipart after cors+jwt registrations (before routes):
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })

  // Register plugin routes after health route:
  if (deps?.pluginRepo) {
    registerPluginRoutes(app, deps.pluginRepo)
  }
  ```

- [ ] **Step 2: Instantiate PluginRepo in index.ts**

  In `apps/api/src/index.ts`, add:
  ```typescript
  import { createPluginRepo } from './repos/plugin-repo.js'

  // After other repo instantiations:
  const pluginRepo = createPluginRepo(sql)

  // Pass to createApp:
  const app = await createApp({
    userRepo,
    watchlistRepo,
    playlistRepo,
    jellyfinRepo,
    recapRepo,
    pluginRepo,                      // ← add
    triggerBackgroundRecap: recapGenerator.triggerBackgroundRecap,
    arrService,
  })
  ```

- [ ] **Step 3: Run all API tests**

  ```bash
  pnpm --filter @mywatch/api test
  ```
  Expected: all tests pass.

- [ ] **Step 4: Verify API starts**

  ```bash
  pnpm --filter @mywatch/api dev
  ```
  Expected: `API listening on http://0.0.0.0:3001`. Ctrl+C to stop.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/app.ts apps/api/src/index.ts
  git commit -m "feat(api): wire PluginRepo and plugin routes into app"
  ```

---

## Task 8: Official plugin catalog (web)

**Files:**
- Create: `apps/web/src/plugins/official-catalog.ts`

- [ ] **Step 1: Write failing test**

  Create `apps/web/tests/official-catalog.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import { OFFICIAL_CATALOG, isInCatalog } from '../src/plugins/official-catalog'

  describe('OFFICIAL_CATALOG', () => {
    it('includes youtube entry', () => {
      expect(OFFICIAL_CATALOG.find((p) => p.id === 'youtube')).toBeDefined()
    })
  })

  describe('isInCatalog', () => {
    it('returns true for youtube', () => {
      expect(isInCatalog('youtube')).toBe(true)
    })

    it('returns false for unknown id', () => {
      expect(isInCatalog('does-not-exist')).toBe(false)
    })
  })
  ```

- [ ] **Step 2: Run to verify it fails**

  ```bash
  pnpm --filter @mywatch/web test tests/official-catalog.test.ts
  ```
  Expected: FAIL — module not found.

- [ ] **Step 3: Create official-catalog.ts**

  Create `apps/web/src/plugins/official-catalog.ts`:
  ```typescript
  export interface OfficialPluginEntry {
    id: string
    displayName: string
    description: string
  }

  export const OFFICIAL_CATALOG: OfficialPluginEntry[] = [
    {
      id: 'youtube',
      displayName: 'YouTube Links',
      description: 'Add YouTube videos and playlists to your watch lists.',
    },
  ]

  export function isInCatalog(id: string): boolean {
    return OFFICIAL_CATALOG.some((p) => p.id === id)
  }
  ```

- [ ] **Step 4: Run to verify it passes**

  ```bash
  pnpm --filter @mywatch/web test tests/official-catalog.test.ts
  ```
  Expected: 3 passing.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/plugins/official-catalog.ts apps/web/tests/official-catalog.test.ts
  git commit -m "feat(web): add official plugin catalog"
  ```

---

## Task 9: PluginRegistryProvider

**Files:**
- Create: `apps/web/src/plugins/PluginRegistryProvider.tsx`

This provider fetches `/api/plugins`, filters built-in `PLUGINS` by enabled state, injects `<script>` tags for enabled custom plugins, and exposes the merged array via context.

- [ ] **Step 1: Install testing library**

  Check if already installed:
  ```bash
  pnpm --filter @mywatch/web list @testing-library/react
  ```
  If not found:
  ```bash
  pnpm --filter @mywatch/web add -D @testing-library/react @testing-library/dom
  ```

- [ ] **Step 2: Update vitest config to use jsdom environment**

  Check `apps/web/vitest.config.ts`. If `environment` is not `'jsdom'`, update it:
  ```typescript
  import { defineConfig } from 'vitest/config'
  export default defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
    },
  })
  ```

  Create `apps/web/tests/setup.ts` if it doesn't exist:
  ```typescript
  import '@testing-library/react'
  ```

- [ ] **Step 3: Write failing tests**

  Create `apps/web/tests/plugin-registry.test.tsx`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { renderHook, waitFor } from '@testing-library/react'
  import { PluginRegistryProvider, usePluginRegistryContext } from '../src/plugins/PluginRegistryProvider'
  import { PLUGINS } from '../src/plugins/registry'

  const mockFetch = vi.fn()
  vi.stubGlobal('fetch', mockFetch)

  // next-auth/react mock
  vi.mock('next-auth/react', () => ({
    useSession: () => ({ data: { accessToken: 'test-token', user: { id: '1' } } }),
  }))

  beforeEach(() => {
    mockFetch.mockReset()
    ;(window as Window & { __mywatchPlugins?: unknown[] }).__mywatchPlugins = []
  })

  describe('PluginRegistryProvider', () => {
    it('returns all built-in plugins when all enabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plugins: PLUGINS.map((p) => ({ id: p.id, source: 'builtin', enabled: true, displayName: p.displayName })),
        }),
      })
      const { result } = renderHook(() => usePluginRegistryContext(), {
        wrapper: PluginRegistryProvider,
      })
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.plugins.length).toBe(PLUGINS.length)
    })

    it('excludes disabled built-in plugin', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plugins: [{ id: 'youtube', source: 'builtin', enabled: false, displayName: 'YouTube Links' }],
        }),
      })
      const { result } = renderHook(() => usePluginRegistryContext(), {
        wrapper: PluginRegistryProvider,
      })
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.plugins.find((p) => p.id === 'youtube')).toBeUndefined()
    })

    it('includes installedMeta in context', async () => {
      const meta = [{ id: 'youtube', source: 'builtin', enabled: true, displayName: 'YouTube Links' }]
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plugins: meta }) })
      const { result } = renderHook(() => usePluginRegistryContext(), {
        wrapper: PluginRegistryProvider,
      })
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.installedMeta).toEqual(meta)
    })
  })
  ```

- [ ] **Step 4: Run to verify they fail**

  ```bash
  pnpm --filter @mywatch/web test tests/plugin-registry.test.tsx
  ```
  Expected: FAIL — module not found.

- [ ] **Step 5: Create PluginRegistryProvider.tsx**

  Create `apps/web/src/plugins/PluginRegistryProvider.tsx`:
  ```tsx
  'use client'

  import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
  } from 'react'
  import { useSession } from 'next-auth/react'
  import type { MyWatchPlugin } from '@mywatch/plugin-sdk'
  import type { InstalledPluginMeta } from '@mywatch/core'
  import { PLUGINS } from './registry'

  interface RegistryState {
    plugins: MyWatchPlugin[]
    installedMeta: InstalledPluginMeta[]
    isLoading: boolean
    error: string | null
    failedIds: Set<string>
    refresh: () => void
  }

  const PluginRegistryCtx = createContext<RegistryState>({
    plugins: PLUGINS,
    installedMeta: [],
    isLoading: false,
    error: null,
    failedIds: new Set(),
    refresh: () => {},
  })

  export function usePluginRegistryContext(): RegistryState {
    return useContext(PluginRegistryCtx)
  }

  const loadedScripts = new Set<string>()

  function injectScript(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (loadedScripts.has(id)) { resolve(); return }
      const script = document.createElement('script')
      script.src = `/api/plugins/${id}/bundle.js`
      script.onload = () => { loadedScripts.add(id); resolve() }
      script.onerror = () => reject(new Error(`Failed to load plugin: ${id}`))
      document.head.appendChild(script)
    })
  }

  export function PluginRegistryProvider({ children }: { children: ReactNode }) {
    const { data: session } = useSession()
    const [installedMeta, setInstalledMeta] = useState<InstalledPluginMeta[]>([])
    const [plugins, setPlugins] = useState<MyWatchPlugin[]>(PLUGINS)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [failedIds, setFailedIds] = useState<Set<string>>(new Set())
    const [refreshCount, setRefreshCount] = useState(0)

    function refresh() { setRefreshCount((c) => c + 1) }

    useEffect(() => {
      if (!session?.user) { setIsLoading(false); return }
      let cancelled = false

      async function load() {
        setIsLoading(true)
        setError(null)
        try {
          const token = (session as unknown as { accessToken?: string })?.accessToken ?? ''
          const res = await fetch('/api/plugins', {
            headers: { authorization: `Bearer ${token}` },
          })
          if (!res.ok) throw new Error('Failed to fetch plugins')
          const { plugins: meta }: { plugins: InstalledPluginMeta[] } = await res.json()
          if (cancelled) return

          setInstalledMeta(meta)

          // Built-ins: include unless explicitly disabled in meta
          const disabledBuiltins = new Set(
            meta.filter((m) => m.source === 'builtin' && !m.enabled).map((m) => m.id)
          )
          const filteredBuiltins = PLUGINS.filter((p) => !disabledBuiltins.has(p.id))

          // Custom: load enabled ones via script tag
          const enabledCustom = meta.filter((m) => m.source === 'custom' && m.enabled)
          const newFailed = new Set<string>()
          await Promise.all(
            enabledCustom.map((m) =>
              injectScript(m.id).catch(() => { newFailed.add(m.id) })
            )
          )
          if (cancelled) return

          const runtimePlugins: MyWatchPlugin[] = (
            (window as unknown as { __mywatchPlugins?: MyWatchPlugin[] }).__mywatchPlugins ?? []
          ).filter((p) => !newFailed.has(p.id))

          setFailedIds(newFailed)
          setPlugins([...filteredBuiltins, ...runtimePlugins])
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
          if (!cancelled) setIsLoading(false)
        }
      }

      load()
      return () => { cancelled = true }
    }, [session, refreshCount])

    return (
      <PluginRegistryCtx.Provider value={{ plugins, installedMeta, isLoading, error, failedIds, refresh }}>
        {children}
      </PluginRegistryCtx.Provider>
    )
  }
  ```

- [ ] **Step 6: Run tests to verify they pass**

  ```bash
  pnpm --filter @mywatch/web test tests/plugin-registry.test.tsx
  ```
  Expected: 3 passing.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/src/plugins/PluginRegistryProvider.tsx apps/web/tests/plugin-registry.test.tsx
  git commit -m "feat(web): add PluginRegistryProvider with dynamic script loading"
  ```

---

## Task 10: Update plugins/index.ts to use context

**Files:**
- Modify: `apps/web/src/plugins/index.ts`

- [ ] **Step 1: Write failing test**

  Create `apps/web/tests/use-plugins.test.ts`:
  ```typescript
  import { describe, it, expect, vi } from 'vitest'
  import { renderHook } from '@testing-library/react'
  import { usePlugins, isPluginListType } from '../src/plugins/index'
  import { PluginRegistryProvider } from '../src/plugins/PluginRegistryProvider'

  vi.mock('../src/plugins/PluginRegistryProvider', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/plugins/PluginRegistryProvider')>()
    return {
      ...actual,
      usePluginRegistryContext: () => ({
        plugins: [{ id: 'youtube', displayName: 'YouTube Links', listTypes: [{ id: 'youtube', label: 'YouTube' }] }],
        installedMeta: [],
        isLoading: false,
        error: null,
        failedIds: new Set(),
        refresh: vi.fn(),
      }),
    }
  })

  vi.mock('next-auth/react', () => ({
    useSession: () => ({ data: null }),
  }))

  describe('usePlugins', () => {
    it('returns plugins from context', () => {
      const { result } = renderHook(() => usePlugins(), { wrapper: PluginRegistryProvider })
      expect(result.current.find((p) => p.id === 'youtube')).toBeDefined()
    })
  })

  describe('isPluginListType', () => {
    it('returns false for manual', () => expect(isPluginListType('manual')).toBe(false))
    it('returns false for smart', () => expect(isPluginListType('smart')).toBe(false))
    it('returns true for youtube', () => expect(isPluginListType('youtube')).toBe(true))
  })
  ```

- [ ] **Step 2: Run to verify it fails**

  ```bash
  pnpm --filter @mywatch/web test tests/use-plugins.test.ts
  ```
  Expected: FAIL.

- [ ] **Step 3: Replace contents of plugins/index.ts**

  Replace full contents of `apps/web/src/plugins/index.ts`:
  ```typescript
  import type { PluginListType } from '@mywatch/plugin-sdk'
  import { usePluginRegistryContext } from './PluginRegistryProvider'

  export function usePlugins() {
    return usePluginRegistryContext().plugins
  }

  export function useListTypePlugin(listTypeId: string | undefined): PluginListType | undefined {
    const plugins = usePlugins()
    if (!listTypeId) return undefined
    for (const plugin of plugins) {
      const lt = plugin.listTypes?.find((l) => l.id === listTypeId)
      if (lt) return lt
    }
    return undefined
  }

  export function useUrlMatchPlugin(url: string): PluginListType | undefined {
    const plugins = usePlugins()
    for (const plugin of plugins) {
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

- [ ] **Step 4: Run tests**

  ```bash
  pnpm --filter @mywatch/web test tests/use-plugins.test.ts
  ```
  Expected: 4 passing.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/plugins/index.ts apps/web/tests/use-plugins.test.ts
  git commit -m "feat(web): usePlugins reads from dynamic PluginRegistryContext"
  ```

---

## Task 11: Wrap layout with PluginRegistryProvider

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Add PluginRegistryProvider to layout**

  In `apps/web/src/app/layout.tsx`, add the import and wrap children. The provider needs `SessionProvider` to already be mounted (it calls `useSession`), so place it inside `SessionProvider`:

  ```tsx
  // Add import:
  import { PluginRegistryProvider } from '@/plugins/PluginRegistryProvider'

  // Update the JSX — wrap ToastProvider contents:
  <SessionProvider>
    <SettingsProvider>
      <PluginRegistryProvider>
        <ToastProvider>
          <AutoSync />
          <OfflineIndicator />
          <PwaUpdater />
          {children}
        </ToastProvider>
      </PluginRegistryProvider>
    </SettingsProvider>
  </SessionProvider>
  ```

- [ ] **Step 2: Type-check**

  ```bash
  pnpm --filter @mywatch/web tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/layout.tsx
  git commit -m "feat(web): wrap layout with PluginRegistryProvider"
  ```

---

## Task 12: PluginsTab component

**Files:**
- Create: `apps/web/src/components/settings/PluginsTab.tsx`

- [ ] **Step 1: Create the component**

  Create `apps/web/src/components/settings/PluginsTab.tsx`:
  ```tsx
  'use client'

  import { useRef, useState } from 'react'
  import { useSession } from 'next-auth/react'
  import type { InstalledPluginMeta } from '@mywatch/core'
  import { usePluginRegistryContext } from '@/plugins/PluginRegistryProvider'
  import { OFFICIAL_CATALOG } from '@/plugins/official-catalog'

  export function PluginsTab() {
    const { data: session } = useSession()
    const { installedMeta, isLoading, error, failedIds, refresh } = usePluginRegistryContext()
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const token = (session as unknown as { accessToken?: string })?.accessToken ?? ''

    async function togglePlugin(id: string, currentlyEnabled: boolean) {
      await fetch(`/api/plugins/${id}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: !currentlyEnabled }),
      })
      refresh()
    }

    async function removePlugin(id: string, displayName: string) {
      if (!confirm(`Remove plugin "${displayName}"? Playlists using it will stop working.`)) return
      await fetch(`/api/plugins/${id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      })
      refresh()
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      if (!file) return
      setUploadError(null)
      setUploading(true)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/plugins/upload', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          body: form,
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'Upload failed')
        refresh()
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }

    const installedIds = new Set(installedMeta.map((m) => m.id))
    const availableOfficial = OFFICIAL_CATALOG.filter((c) => !installedIds.has(c.id))

    if (isLoading) {
      return <div className="px-4 py-6 text-[var(--text-13)]" style={{ color: 'var(--muted2)' }}>Loading plugins…</div>
    }

    return (
      <div className="space-y-6 pb-8">
        {error && (
          <div className="px-4 py-3 text-sm" style={{ color: 'var(--red)' }}>{error}</div>
        )}

        {/* Installed plugins */}
        <section className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
          <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
            <span className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
              Installed
            </span>
          </div>
          {installedMeta.length === 0 ? (
            <div className="px-4 py-3 text-[var(--text-13)]" style={{ color: 'var(--muted2)' }}>
              No plugins installed.
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border2)' }}>
              {installedMeta.map((plugin) => (
                <PluginRow
                  key={plugin.id}
                  plugin={plugin}
                  hasFailed={failedIds.has(plugin.id)}
                  onToggle={() => togglePlugin(plugin.id, plugin.enabled)}
                  onRemove={plugin.source === 'custom' ? () => removePlugin(plugin.id, plugin.displayName) : undefined}
                  onRetry={failedIds.has(plugin.id) ? refresh : undefined}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Official plugins not yet installed */}
        <section className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
          <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
            <span className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
              Available
            </span>
          </div>
          {availableOfficial.length === 0 ? (
            <div className="px-4 py-3 text-[var(--text-13)]" style={{ color: 'var(--muted2)' }}>
              No additional plugins available yet.
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border2)' }}>
              {availableOfficial.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div>
                    <p className="text-[var(--text-13)]">{entry.displayName}</p>
                    <p className="text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>{entry.description}</p>
                  </div>
                  <span className="text-[var(--text-11)] uppercase tracking-wide" style={{ color: 'var(--muted2)' }}>
                    Built-in
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Upload custom plugin */}
        <section className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
          <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
            <span className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
              Install Custom Plugin
            </span>
          </div>
          <div className="px-4 py-3 space-y-3">
            <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>
              Upload a compiled plugin <code>.zip</code> containing{' '}
              <code>manifest.json</code> and <code>bundle.js</code>.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded px-3 py-1.5 text-[var(--text-13)]"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.5 : 1,
              }}
            >
              {uploading ? 'Uploading…' : 'Upload .zip'}
            </button>
            {uploadError && (
              <p className="text-[var(--text-12)]" style={{ color: 'var(--red)' }}>{uploadError}</p>
            )}
          </div>
        </section>
      </div>
    )
  }

  function PluginRow({
    plugin,
    hasFailed,
    onToggle,
    onRemove,
    onRetry,
  }: {
    plugin: InstalledPluginMeta
    hasFailed: boolean
    onToggle: () => void
    onRemove?: () => void
    onRetry?: () => void
  }) {
    return (
      <li className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="min-w-0">
          <p className="text-[var(--text-13)] truncate">{plugin.displayName}</p>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-10)] uppercase tracking-wide" style={{ color: 'var(--muted2)' }}>
              {plugin.source}
            </span>
            {hasFailed && (
              <span className="text-[var(--text-10)]" style={{ color: 'var(--red)' }}>
                Load error
                {onRetry && (
                  <button onClick={onRetry} className="ml-1 underline" style={{ color: 'var(--accent)' }}>
                    Retry
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Toggle — reuse exact same Toggle pattern from profile/page.tsx */}
          <button
            onClick={onToggle}
            aria-label="toggle plugin"
            className="flex-shrink-0 relative transition-colors duration-150"
            style={{
              width: 40,
              height: 22,
              borderRadius: 'var(--pill)',
              background: plugin.enabled ? 'var(--accent)' : 'var(--border)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span
              className="absolute top-[2px] transition-transform duration-150"
              style={{
                left: 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                display: 'block',
                transform: plugin.enabled ? 'translateX(18px)' : 'translateX(0)',
                boxShadow: '0 1px 3px rgba(0,0,0,.3)',
              }}
            />
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-[var(--text-12)]"
              style={{ color: 'var(--red)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
            >
              Remove
            </button>
          )}
        </div>
      </li>
    )
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  pnpm --filter @mywatch/web tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/components/settings/PluginsTab.tsx
  git commit -m "feat(web): add PluginsTab settings component"
  ```

---

## Task 13: Add Plugins tab to Settings page

**Files:**
- Modify: `apps/web/src/app/profile/page.tsx`

The tab bar is at line ~749. The `activeTab` state is typed as `'server' | 'client' | 'logs'`.

- [ ] **Step 1: Update activeTab type**

  In `apps/web/src/app/profile/page.tsx`, find line ~147:
  ```typescript
  const [activeTab, setActiveTab] = useState<'server' | 'client' | 'logs'>('server')
  ```
  Change to:
  ```typescript
  const [activeTab, setActiveTab] = useState<'server' | 'client' | 'logs' | 'plugins'>('server')
  ```

- [ ] **Step 2: Add Plugins to tab bar array**

  Find line ~749:
  ```tsx
  {(['server', 'client', 'logs'] as const).map(tab => (
  ```
  Change to:
  ```tsx
  {(['server', 'client', 'logs', 'plugins'] as const).map(tab => (
  ```

- [ ] **Step 3: Add PluginsTab import and content**

  At the top of the file, add import alongside other imports:
  ```typescript
  import { PluginsTab } from '@/components/settings/PluginsTab'
  ```

  Find the logs tab content section (around line ~1371):
  ```tsx
  {activeTab === 'logs' && (
  ```
  After the entire logs tab closing `)}`, add:
  ```tsx
  {/* ── Plugins tab ── */}
  {activeTab === 'plugins' && <PluginsTab />}
  ```

- [ ] **Step 4: Type-check and build**

  ```bash
  pnpm --filter @mywatch/web tsc --noEmit
  pnpm --filter @mywatch/web build
  ```
  Expected: no errors, build succeeds.

- [ ] **Step 5: Run all web tests**

  ```bash
  pnpm --filter @mywatch/web test
  ```
  Expected: all passing.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/src/app/profile/page.tsx
  git commit -m "feat(web): add Plugins tab to Settings page"
  ```
