import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../src/app.js'
import type { PluginRepo } from '../src/repos/plugin-repo.js'
import type { InstalledPluginMeta } from '@mywatch/core'
import fs from 'node:fs/promises'

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    access: vi.fn(),
    rm: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
})

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

describe('GET /api/user/plugins', () => {
  it('returns built-in plugins with default enabled=false when no DB record', async () => {
    const pluginRepo = makeMockPluginRepo({ list: vi.fn().mockResolvedValue([]) })
    const app = await createApp({ pluginRepo })
    const res = await app.inject({ method: 'GET', url: '/api/user/plugins', headers: AUTH_HEADER })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ plugins: InstalledPluginMeta[] }>()
    const youtube = body.plugins.find((p) => p.id === 'youtube')
    expect(youtube).toBeDefined()
    expect(youtube?.enabled).toBe(false)
    expect(youtube?.source).toBe('builtin')
  })

  it('returns built-in plugin with enabled=false when DB record says so', async () => {
    const pluginRepo = makeMockPluginRepo({
      list: vi.fn().mockResolvedValue([
        { id: 'youtube', displayName: 'YouTube Links', source: 'builtin', enabled: false },
      ]),
    })
    const app = await createApp({ pluginRepo })
    const res = await app.inject({ method: 'GET', url: '/api/user/plugins', headers: AUTH_HEADER })
    const body = res.json<{ plugins: InstalledPluginMeta[] }>()
    expect(body.plugins.find((p) => p.id === 'youtube')?.enabled).toBe(false)
  })
})

describe('PATCH /api/user/plugins/:id', () => {
  it('upserts builtin plugin record with new enabled value', async () => {
    const pluginRepo = makeMockPluginRepo({ getById: vi.fn().mockResolvedValue(null) })
    const app = await createApp({ pluginRepo })
    const res = await app.inject({
      method: 'PATCH', url: '/api/user/plugins/youtube',
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
      method: 'PATCH', url: '/api/user/plugins/nonexistent',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      payload: { enabled: false },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when enabled is not boolean', async () => {
    const app = await createApp({ pluginRepo: makeMockPluginRepo() })
    const res = await app.inject({
      method: 'PATCH', url: '/api/user/plugins/youtube',
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
      method: 'PATCH', url: '/api/user/plugins/youtube',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      payload: { enabled: false },
    })
    expect(res.statusCode).toBe(200)
    expect(pluginRepo.setEnabled).toHaveBeenCalledWith('youtube', false)
    expect(pluginRepo.upsert).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/user/plugins/:id', () => {
  it('returns 400 when trying to remove a built-in plugin', async () => {
    const app = await createApp({ pluginRepo: makeMockPluginRepo() })
    const res = await app.inject({
      method: 'DELETE', url: '/api/user/plugins/youtube', headers: AUTH_HEADER,
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
      method: 'DELETE', url: '/api/user/plugins/my-plugin', headers: AUTH_HEADER,
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
      method: 'DELETE', url: '/api/user/plugins/unknown-custom', headers: AUTH_HEADER,
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/user/plugins/upload', () => {
  it('returns 400 when no file uploaded', async () => {
    const app = await createApp({ pluginRepo: makeMockPluginRepo() })
    const boundary = 'boundary123'
    const res = await app.inject({
      method: 'POST',
      url: '/api/user/plugins/upload',
      headers: {
        ...AUTH_HEADER,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: `--${boundary}--\r\n`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when zip missing bundle.js', async () => {
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
      url: '/api/user/plugins/upload',
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
      url: '/api/user/plugins/upload',
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

describe('POST /api/user/plugins/local', () => {
  it('loads and registers a local plugin successfully', async () => {
    const pluginRepo = makeMockPluginRepo()
    const app = await createApp({ pluginRepo })
    
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ id: 'my-local-plugin', displayName: 'My Local' })
    )
    vi.mocked(fs.access).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/api/user/plugins/local',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      payload: { path: '/path/to/my-plugin' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json<{ id: string; displayName: string; source: string; path: string }>()
    expect(body.id).toBe('my-local-plugin')
    expect(body.source).toBe('filesystem')
    expect(body.path).toContain('my-plugin')
    expect(pluginRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'my-local-plugin',
        source: 'filesystem',
        enabled: true,
      })
    )
  })

  it('returns 400 when path is missing', async () => {
    const app = await createApp({ pluginRepo: makeMockPluginRepo() })
    const res = await app.inject({
      method: 'POST',
      url: '/api/user/plugins/local',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    expect(res.json<{ error: string }>().error).toMatch(/path/)
  })

  it('returns 400 when manifest.json does not exist or is invalid', async () => {
    const app = await createApp({ pluginRepo: makeMockPluginRepo() })
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

    const res = await app.inject({
      method: 'POST',
      url: '/api/user/plugins/local',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      payload: { path: '/invalid' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json<{ error: string }>().error).toMatch(/manifest\.json/)
  })

  it('returns 400 when bundle.js does not exist', async () => {
    const app = await createApp({ pluginRepo: makeMockPluginRepo() })
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ id: 'test', displayName: 'Test' })
    )
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'))

    const res = await app.inject({
      method: 'POST',
      url: '/api/user/plugins/local',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      payload: { path: '/invalid' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json<{ error: string }>().error).toMatch(/bundle\.js/)
  })
})
