import { describe, it, expect, vi } from 'vitest'
import { createApp } from '../src/app.js'
import type { UserRepo, UserRecord } from '../src/repos/user-repo.js'
import type { WatchlistRepo } from '../src/repos/watchlist-repo.js'
import type { PlaylistRepo } from '../src/repos/playlist-repo.js'
import type { WatchlistItem } from '@mywatch/core'
import { SseBus } from '../src/utils/sse-bus.js'

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
  customPlatforms: [],
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

function makePlaylistRepo(): PlaylistRepo {
  return {
    upsertPlaylists: vi.fn().mockResolvedValue(undefined),
    upsertPlaylistItems: vi.fn().mockResolvedValue(undefined),
    findPlaylistsSince: vi.fn().mockResolvedValue([]),
    findPlaylistItemsSince: vi.fn().mockResolvedValue([]),
  }
}

function getAuthToken(app: Awaited<ReturnType<typeof createApp>>) {
  return app.jwt.sign({ sub: mockUser.id, email: mockUser.email, isGuest: false })
}

describe('SseBus', () => {
  it('emits to all connections for a userId except excludeConnId', () => {
    const bus = new SseBus()
    const sent: string[] = []
    const fakeReply = (data: string) => { sent.push(data) }
    bus.subscribe('u1', 'conn-a', fakeReply)
    bus.subscribe('u1', 'conn-b', fakeReply)
    bus.subscribe('u2', 'conn-c', fakeReply)

    bus.emit('u1', 'conn-a', { pushedAt: '2024-01-01T00:00:00Z' })

    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain('event: sync')
    expect(sent[0]).toContain('"pushedAt"')
  })

  it('does nothing when no connections for userId', () => {
    const bus = new SseBus()
    expect(() => bus.emit('u1', 'conn-x', { pushedAt: '2024-01-01T00:00:00Z' })).not.toThrow()
  })

  it('unsubscribe removes connection', () => {
    const bus = new SseBus()
    const sent: string[] = []
    bus.subscribe('u1', 'conn-a', (data) => { sent.push(data) })
    bus.unsubscribe('u1', 'conn-a')
    bus.emit('u1', 'conn-b', { pushedAt: '2024-01-01T00:00:00Z' })
    expect(sent).toHaveLength(0)
  })

  it('continues emitting to remaining connections after one throws', () => {
    const bus = new SseBus()
    const sent: string[] = []
    bus.subscribe('u1', 'conn-broken', () => { throw new Error('gone') })
    bus.subscribe('u1', 'conn-ok', (data) => { sent.push(data) })

    expect(() => bus.emit('u1', 'conn-x', { pushedAt: '2024-01-01T00:00:00Z' })).not.toThrow()
    expect(sent).toHaveLength(1)
  })
})

describe('POST /sync/push', () => {
  it('upserts items and returns pushedAt', async () => {
    const watchlistRepo = makeWatchlistRepo()
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo, playlistRepo: makePlaylistRepo() })
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
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo: makeWatchlistRepo(), playlistRepo: makePlaylistRepo() })
    const res = await app.inject({
      method: 'POST',
      url: '/sync/push',
      payload: { items: [] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects items belonging to a different user', async () => {
    const watchlistRepo = makeWatchlistRepo()
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo, playlistRepo: makePlaylistRepo() })
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
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo, playlistRepo: makePlaylistRepo() })
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

describe('GET /sync/events', () => {
  it('returns 401 without token', async () => {
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo: makeWatchlistRepo(), playlistRepo: makePlaylistRepo() })
    const res = await app.inject({ method: 'GET', url: '/sync/events' })
    expect(res.statusCode).toBe(401)
  })

  it('returns SSE connected event with connId', async () => {
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo: makeWatchlistRepo(), playlistRepo: makePlaylistRepo() })
    const token = getAuthToken(app)

    const res = await app.inject({
      method: 'GET',
      url: `/sync/events?token=${encodeURIComponent(token)}`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.body).toContain('event: connected')
    expect(res.body).toContain('"connId"')
  })
})

describe('GET /sync/pull', () => {
  it('returns items updated since given timestamp', async () => {
    const watchlistRepo = makeWatchlistRepo()
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo, playlistRepo: makePlaylistRepo() })
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
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo: makeWatchlistRepo(), playlistRepo: makePlaylistRepo() })
    const res = await app.inject({
      method: 'GET',
      url: '/sync/pull?since=2024-01-01T00:00:00.000Z',
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 when since param is missing', async () => {
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo: makeWatchlistRepo(), playlistRepo: makePlaylistRepo() })
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
    const app = await createApp({ userRepo: makeUserRepo(), watchlistRepo, playlistRepo: makePlaylistRepo() })
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
