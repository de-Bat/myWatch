import { describe, it, expect } from 'vitest'
import { watchlistItemSchema, mediaCacheSchema, watchStatusSchema } from '../src/schemas'

const validItem = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  tmdbId: 1396,
  mediaType: 'tv',
  status: 'planned',
  progressEpisode: null,
  progressSeason: null,
  rating: null,
  notes: null,
  addedAt: '2026-01-01T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  quitAt: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
  deviceId: 'device-abc',
  deletedAt: null,
}

describe('watchlistItemSchema', () => {
  it('parses a valid planned item', () => {
    expect(() => watchlistItemSchema.parse(validItem)).not.toThrow()
  })

  it('rejects rating below 1', () => {
    expect(() => watchlistItemSchema.parse({ ...validItem, rating: 0 })).toThrow()
  })

  it('rejects rating above 10', () => {
    expect(() => watchlistItemSchema.parse({ ...validItem, rating: 11 })).toThrow()
  })

  it('rejects invalid status', () => {
    expect(() => watchlistItemSchema.parse({ ...validItem, status: 'maybe' })).toThrow()
  })

  it('rejects non-uuid id', () => {
    expect(() => watchlistItemSchema.parse({ ...validItem, id: 'not-a-uuid' })).toThrow()
  })
})

describe('watchStatusSchema', () => {
  it('accepts all four statuses', () => {
    for (const s of ['planned', 'in_progress', 'watched', 'quit']) {
      expect(() => watchStatusSchema.parse(s)).not.toThrow()
    }
  })
})

describe('mediaCacheSchema', () => {
  it('parses a valid movie cache entry', () => {
    const entry = {
      tmdbId: 603,
      mediaType: 'movie',
      title: 'The Matrix',
      overview: 'A hacker discovers reality.',
      posterPath: '/poster.jpg',
      backdropPath: null,
      releaseDate: '1999-03-31',
      genres: [{ id: 28, name: 'Action' }],
      voteAverage: 8.7,
      voteCount: 24000,
      runtime: 136,
      seasonsCount: null,
      showStatus: 'Released',
      cachedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(() => mediaCacheSchema.parse(entry)).not.toThrow()
  })

  it('rejects empty title', () => {
    const entry = {
      tmdbId: 603, mediaType: 'movie', title: '', overview: '',
      posterPath: null, backdropPath: null, releaseDate: null,
      genres: [], voteAverage: 7.0, voteCount: 100,
      runtime: null, seasonsCount: null, showStatus: null,
      cachedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(() => mediaCacheSchema.parse(entry)).toThrow()
  })

  it('rejects voteAverage above 10', () => {
    const entry = {
      tmdbId: 603, mediaType: 'movie', title: 'Test', overview: '',
      posterPath: null, backdropPath: null, releaseDate: null,
      genres: [], voteAverage: 10.1, voteCount: 100,
      runtime: null, seasonsCount: null, showStatus: null,
      cachedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(() => mediaCacheSchema.parse(entry)).toThrow()
  })

  it('rejects non-datetime cachedAt', () => {
    const entry = {
      tmdbId: 603, mediaType: 'movie', title: 'Test', overview: '',
      posterPath: null, backdropPath: null, releaseDate: null,
      genres: [], voteAverage: 7.0, voteCount: 100,
      runtime: null, seasonsCount: null, showStatus: null,
      cachedAt: 'not-a-date',
    }
    expect(() => mediaCacheSchema.parse(entry)).toThrow()
  })
})
