import { describe, it, expect } from 'vitest'
import { isStale } from '../src/cache'
import type { MediaCache } from '@mywatch/core'

const base: MediaCache = {
  tmdbId: 603,
  mediaType: 'movie',
  title: 'The Matrix',
  overview: '',
  posterPath: null,
  backdropPath: null,
  releaseDate: null,
  genres: [],
  voteAverage: 8.7,
  voteCount: 1000,
  runtime: 136,
  seasonsCount: null,
  showStatus: null,
  cachedAt: '',
}

describe('isStale', () => {
  it('returns false when cached less than 7 days ago', () => {
    const now = new Date('2026-06-10T00:00:00Z')
    const cache = { ...base, cachedAt: '2026-06-05T00:00:00.000Z' } // 5 days ago
    expect(isStale(cache, now)).toBe(false)
  })

  it('returns true when cached more than 7 days ago', () => {
    const now = new Date('2026-06-10T00:00:00Z')
    const cache = { ...base, cachedAt: '2026-06-01T00:00:00.000Z' } // 9 days ago
    expect(isStale(cache, now)).toBe(true)
  })

  it('returns false at exactly 7 days', () => {
    const now = new Date('2026-06-10T00:00:00Z')
    const cache = { ...base, cachedAt: '2026-06-03T00:00:00.000Z' } // exactly 7 days
    expect(isStale(cache, now)).toBe(false)
  })
})
