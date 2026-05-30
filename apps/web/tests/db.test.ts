import { beforeEach, describe, it, expect } from 'vitest'
import { db } from '../src/lib/db'
import type { WatchlistItem } from '@mywatch/core'

const baseItem: WatchlistItem = {
  id: 'item-1',
  userId: 'user-1',
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
  deviceId: 'dev-1',
  deletedAt: null,
  customPlatforms: [],
}

beforeEach(async () => {
  await db.watchlistItems.clear()
  await db.pendingPushes.clear()
  await db.mediaCache.clear()
})

describe('watchlistItems', () => {
  it('stores and retrieves item by id', async () => {
    await db.watchlistItems.put(baseItem)
    const found = await db.watchlistItems.get('item-1')
    expect(found).toEqual(baseItem)
  })

  it('returns undefined for missing item', async () => {
    expect(await db.watchlistItems.get('nonexistent')).toBeUndefined()
  })

  it('bulkPut and query all', async () => {
    await db.watchlistItems.bulkPut([
      baseItem,
      { ...baseItem, id: 'item-2', status: 'watched' },
    ])
    expect(await db.watchlistItems.count()).toBe(2)
  })

  it('filters by status index', async () => {
    await db.watchlistItems.bulkPut([
      baseItem,
      { ...baseItem, id: 'item-2', status: 'watched' },
    ])
    const planned = await db.watchlistItems.where('status').equals('planned').toArray()
    expect(planned).toHaveLength(1)
    expect(planned[0].id).toBe('item-1')
  })
})

describe('pendingPushes', () => {
  it('auto-increments id and stores entries', async () => {
    const id = await db.pendingPushes.add({ itemId: 'item-1', queuedAt: '2024-01-01T00:00:00Z' })
    expect(id).toBeTypeOf('number')
    const all = await db.pendingPushes.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].itemId).toBe('item-1')
  })

  it('deletes entries by itemId', async () => {
    await db.pendingPushes.add({ itemId: 'item-1', queuedAt: '2024-01-01T00:00:00Z' })
    await db.pendingPushes.where('itemId').equals('item-1').delete()
    expect(await db.pendingPushes.count()).toBe(0)
  })
})

describe('mediaCache', () => {
  it('stores and retrieves by compound key [tmdbId, mediaType]', async () => {
    const entry = {
      tmdbId: 550,
      mediaType: 'movie' as const,
      title: 'Fight Club',
      overview: 'A man forms an underground fight club.',
      posterPath: '/poster.jpg',
      backdropPath: null,
      releaseDate: '1999-10-15',
      genres: [{ id: 18, name: 'Drama' }],
      voteAverage: 8.4,
      voteCount: 24000,
      runtime: 139,
      seasonsCount: null,
      showStatus: 'Released',
      cachedAt: '2024-01-01T00:00:00Z',
      watchProviders: null,
      watchProvidersRegion: null,
      watchProvidersCachedAt: null,
    }
    await db.mediaCache.put(entry)
    const found = await db.mediaCache.get([550, 'movie'])
    expect(found?.title).toBe('Fight Club')
  })

  it('overwrites existing entry on put with same compound key', async () => {
    const entry = {
      tmdbId: 550,
      mediaType: 'movie' as const,
      title: 'Original',
      overview: '',
      posterPath: null,
      backdropPath: null,
      releaseDate: null,
      genres: [],
      voteAverage: 0,
      voteCount: 0,
      runtime: null,
      seasonsCount: null,
      showStatus: null,
      cachedAt: '2024-01-01T00:00:00Z',
      watchProviders: null,
      watchProvidersRegion: null,
      watchProvidersCachedAt: null,
    }
    await db.mediaCache.put(entry)
    await db.mediaCache.put({ ...entry, title: 'Updated' })
    expect(await db.mediaCache.count()).toBe(1)
    const found = await db.mediaCache.get([550, 'movie'])
    expect(found?.title).toBe('Updated')
  })
})
