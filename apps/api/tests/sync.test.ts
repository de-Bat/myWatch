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
