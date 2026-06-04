import path from 'node:path'
import fs from 'node:fs/promises'
import type { FastifyInstance } from 'fastify'
import '@fastify/multipart'
import unzipper from 'unzipper'
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
  // GET /api/user/plugins
  app.get('/api/user/plugins', { preHandler: [authenticate] }, async (_req, reply) => {
    const dbRows = await pluginRepo.list()
    const dbMap = new Map(dbRows.map((r) => [r.id, r]))

    const builtins = BUILTIN_PLUGINS.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      source: 'builtin' as const,
      enabled: dbMap.get(p.id)?.enabled ?? false,
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

    const filesystems = dbRows
      .filter((r) => r.source === 'filesystem')
      .map((r) => ({
        id: r.id,
        displayName: r.displayName,
        source: 'filesystem' as const,
        enabled: r.enabled,
        installedAt: r.installedAt,
        path: r.path,
      }))

    return reply.send({ plugins: [...builtins, ...customs, ...filesystems] })
  })

  // PATCH /api/user/plugins/:id
  app.patch<{ Params: { id: string }; Body: { enabled: unknown } }>(
    '/api/user/plugins/:id',
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

  // DELETE /api/user/plugins/:id
  app.delete<{ Params: { id: string } }>(
    '/api/user/plugins/:id',
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

  // GET /api/user/plugins/:id/bundle.js — no auth, same-origin fetch via script tag
  app.get<{ Params: { id: string } }>(
    '/api/user/plugins/:id/bundle.js',
    async (req, reply) => {
      const { id } = req.params
      if (!ID_RE.test(id)) return reply.status(400).send({ error: 'Invalid plugin id' })
      
      const existing = await pluginRepo.getById(id)
      let bundlePath: string
      if (existing?.source === 'filesystem' && existing.path) {
        bundlePath = path.join(existing.path, 'bundle.js')
      } else {
        bundlePath = path.join(PLUGINS_DIR, id, 'bundle.js')
      }

      try {
        const content = await fs.readFile(bundlePath, 'utf-8')
        return reply.header('content-type', 'application/javascript; charset=utf-8').send(content)
      } catch {
        return reply.status(404).send({ error: 'Bundle not found' })
      }
    },
  )

  // POST /api/user/plugins/upload
  app.post('/api/user/plugins/upload', { preHandler: [authenticate] }, async (req, reply) => {
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
      return reply.status(400).send({ error: `Plugin id "${id}" conflicts with a builtin plugin` })
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

  // POST /api/user/plugins/local
  app.post<{ Body: { path: string } }>(
    '/api/user/plugins/local',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { path: localPath } = req.body
      if (typeof localPath !== 'string' || !localPath.trim()) {
        return reply.status(400).send({ error: 'path is required' })
      }

      const resolvedPath = path.resolve(localPath.trim())

      let manifestContent: string
      try {
        manifestContent = await fs.readFile(path.join(resolvedPath, 'manifest.json'), 'utf-8')
      } catch {
        return reply.status(400).send({ error: 'Could not read manifest.json from path' })
      }

      let manifest: { id?: unknown; displayName?: unknown }
      try {
        manifest = JSON.parse(manifestContent)
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
        return reply.status(400).send({ error: `Plugin id "${id}" conflicts with a builtin plugin` })
      }

      // Check bundle.js exists
      try {
        await fs.access(path.join(resolvedPath, 'bundle.js'))
      } catch {
        return reply.status(400).send({ error: 'Missing bundle.js in folder' })
      }

      await pluginRepo.upsert({
        id,
        displayName: displayName.trim(),
        source: 'filesystem',
        enabled: true,
        installedAt: new Date().toISOString(),
        path: resolvedPath,
      })

      return reply.status(201).send({ id, displayName: displayName.trim(), source: 'filesystem', enabled: true, path: resolvedPath })
    }
  )
}
