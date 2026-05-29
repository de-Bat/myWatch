import { beforeEach, describe, it, expect, vi } from 'vitest'
import { db } from '../src/lib/db'
import type { WatchlistItem } from '@mywatch/core'

vi.mock('../src/lib/api-client', () => ({
  apiClient: {
    sync: {
      push: vi.fn(),
      pull: vi.fn(),
    },
  },
}))

import { pushPendingItems, pullItems } from '../src/lib/sync'
import { apiClient } from '../src/lib/api-client'

const mockedPush = vi.mocked(apiClient.sync.push)
const mockedPull = vi.mocked(apiClient.sync.pull)

const baseItem: WatchlistItem = {
  id: 'i1',
  userId: 'u1',
  tmdbId: 550,
  mediaType: 'movie',
  status: 'planned',
  progressEpisode: null,
  progressSeason: null,
  rating: null,
  notes: null,
  addedAt: '2024-01-01T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  quitAt: null,
  updatedAt: '2024-01-01T00:00:00Z',
  deviceId: 'dev1',
  deletedAt: null,
}

beforeEach(async () => {
  await db.watchlistItems.clear()
  await db.pendingPushes.clear()
  vi.clearAllMocks()
})

describe('pushPendingItems', () => {
  it('pushes pending items and clears queue', async () => {
    await db.watchlistItems.put(baseItem)
    await db.pendingPushes.add({ itemId: 'i1', queuedAt: '2024-01-01T00:00:00Z' })
    mockedPush.mockResolvedValueOnce({ pushedAt: '2024-01-01T01:00:00Z' })

    await pushPendingItems('token123')

    expect(mockedPush).toHaveBeenCalledWith([baseItem], 'token123')
    expect(await db.pendingPushes.count()).toBe(0)
  })

  it('does nothing when queue is empty', async () => {
    await pushPendingItems('token123')
    expect(mockedPush).not.toHaveBeenCalled()
  })

  it('deduplicates when same itemId queued multiple times', async () => {
    await db.watchlistItems.put(baseItem)
    await db.pendingPushes.add({ itemId: 'i1', queuedAt: '2024-01-01T00:00:00Z' })
    await db.pendingPushes.add({ itemId: 'i1', queuedAt: '2024-01-01T00:01:00Z' })
    mockedPush.mockResolvedValueOnce({ pushedAt: '2024-01-01T01:00:00Z' })

    await pushPendingItems('token123')

    expect(mockedPush).toHaveBeenCalledWith([baseItem], 'token123')
    expect(await db.pendingPushes.count()).toBe(0)
  })
})

describe('pullItems', () => {
  it('stores incoming remote items and returns pulledAt', async () => {
    const remote = { ...baseItem, id: 'i2', status: 'watched' as const }
    mockedPull.mockResolvedValueOnce({ items: [remote], pulledAt: '2024-01-01T01:00:00Z' })

    const pulledAt = await pullItems('2024-01-01T00:00:00Z', 'token123')

    expect(pulledAt).toBe('2024-01-01T01:00:00Z')
    expect((await db.watchlistItems.get('i2'))?.status).toBe('watched')
  })

  it('last-write-wins: remote newer than local wins', async () => {
    await db.watchlistItems.put(baseItem)
    const newer = { ...baseItem, status: 'watched' as const, updatedAt: '2024-01-02T00:00:00Z' }
    mockedPull.mockResolvedValueOnce({ items: [newer], pulledAt: '2024-01-02T01:00:00Z' })

    await pullItems('2024-01-01T00:00:00Z', 'token123')

    expect((await db.watchlistItems.get('i1'))?.status).toBe('watched')
  })

  it('last-write-wins: local newer than remote keeps local', async () => {
    const localNewer = { ...baseItem, status: 'in_progress' as const, updatedAt: '2024-01-03T00:00:00Z' }
    await db.watchlistItems.put(localNewer)
    const olderRemote = { ...baseItem, status: 'watched' as const, updatedAt: '2024-01-02T00:00:00Z' }
    mockedPull.mockResolvedValueOnce({ items: [olderRemote], pulledAt: '2024-01-03T01:00:00Z' })

    await pullItems('2024-01-01T00:00:00Z', 'token123')

    expect((await db.watchlistItems.get('i1'))?.status).toBe('in_progress')
  })

  it('propagates remote soft-delete tombstone to local store', async () => {
    await db.watchlistItems.put(baseItem) // local: deletedAt null
    const tombstone = { ...baseItem, deletedAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z' }
    mockedPull.mockResolvedValueOnce({ items: [tombstone], pulledAt: '2024-01-02T01:00:00Z' })

    await pullItems('2024-01-01T00:00:00Z', 'token123')

    const stored = await db.watchlistItems.get('i1')
    expect(stored?.deletedAt).toBe('2024-01-02T00:00:00Z')
  })
})
