import { describe, it, expect } from 'vitest'
import type { WatchlistItem } from '@mywatch/core'
import { fuzzyFilterItems } from '../src/lib/fuzzySearch'

const base: WatchlistItem = {
  id: 'a',
  userId: 'u1',
  tmdbId: 1,
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

const items: WatchlistItem[] = [
  { ...base, id: '1', tmdbId: 1, mediaType: 'movie' },
  { ...base, id: '2', tmdbId: 2, mediaType: 'tv' },
  { ...base, id: '3', tmdbId: 3, mediaType: 'movie' },
]

const titleMap = new Map<string, string>([
  ['1-movie', 'The Dark Knight'],
  ['2-tv',    'Breaking Bad'],
  ['3-movie', 'Inception'],
])

describe('fuzzyFilterItems', () => {
  it('returns all items when query is empty', () => {
    expect(fuzzyFilterItems(items, titleMap, '')).toEqual(items)
  })

  it('returns all items when query is only whitespace', () => {
    expect(fuzzyFilterItems(items, titleMap, '   ')).toEqual(items)
  })

  it('exact match returns correct item', () => {
    const result = fuzzyFilterItems(items, titleMap, 'Inception')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('3')
  })

  it('partial match works (substring)', () => {
    const result = fuzzyFilterItems(items, titleMap, 'Dark')
    expect(result.some((i) => i.id === '1')).toBe(true)
  })

  it('fuzzy typo match works', () => {
    // 'incepion' missing a 't'
    const result = fuzzyFilterItems(items, titleMap, 'incepion')
    expect(result.some((i) => i.id === '3')).toBe(true)
  })

  it('no match returns empty array', () => {
    const result = fuzzyFilterItems(items, titleMap, 'zzzzzzzzz')
    expect(result).toHaveLength(0)
  })

  it('items with no title in map are excluded when query is non-empty', () => {
    const noTitle = new Map<string, string>() // empty map
    const result = fuzzyFilterItems(items, noTitle, 'Dark')
    expect(result).toHaveLength(0)
  })
})
