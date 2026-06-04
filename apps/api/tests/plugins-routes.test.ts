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

  it('returns 404 for unknown plugin id', async () => {
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

  it('calls setEnabled when builtin plugin already has DB record', async () => {
    const pluginRepo = makeMockPluginRepo({
      getById: vi.fn().mockResolvedValue({
        id: 'youtube', displayName: 'YouTube Links', source: 'builtin', enabled: true,
      }),
    })
    const app = await createApp({ pluginRepo })
    const res = await app.inject({
      method: 'PATCH', url: '/api/plugins/youtube',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      payload: { enabled: false },
    })
    expect(res.statusCode).toBe(200)
    expect(pluginRepo.setEnabled).toHaveBeenCalledWith('youtube', false)
    expect(pluginRepo.upsert).not.toHaveBeenCalled()
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

  it('returns 404 when custom plugin not found', async () => {
    const pluginRepo = makeMockPluginRepo({
      getById: vi.fn().mockResolvedValue(null),
    })
    const app = await createApp({ pluginRepo })
    const res = await app.inject({
      method: 'DELETE', url: '/api/plugins/unknown-custom', headers: AUTH_HEADER,
    })
    expect(res.statusCode).toBe(404)
  })
})
