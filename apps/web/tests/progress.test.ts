import { describe, it, expect } from 'vitest'
import type { JellyfinProgress, MediaCache } from '@mywatch/core'
import { getTvProgress } from '../src/lib/progress'

const mockTvMeta: MediaCache = {
  tmdbId: 123,
  mediaType: 'tv',
  title: "The Handmaid's Tale",
  overview: "...",
  posterPath: null,
  backdropPath: null,
  releaseDate: '2017-04-26',
  genres: [],
  voteAverage: 8.2,
  voteCount: 1500,
  runtime: 50,
  seasonsCount: 5,
  seasons: [
    { seasonNumber: 0, episodeCount: 3 }, // specials
    { seasonNumber: 1, episodeCount: 10 },
    { seasonNumber: 2, episodeCount: 13 },
    { seasonNumber: 3, episodeCount: 13 },
    { seasonNumber: 4, episodeCount: 10 },
    { seasonNumber: 5, episodeCount: 10 },
  ],
  showStatus: 'Returning Series',
  cachedAt: new Date().toISOString(),
  watchProviders: null,
  watchProvidersRegion: null,
  watchProvidersCachedAt: null,
}

describe('getTvProgress', () => {
  it('falls back to raw values when meta is null', () => {
    const rawProgress: JellyfinProgress = {
      tmdbId: 123,
      mediaType: 'tv',
      jellyfinStatus: 'watching',
      season: 5,
      episode: 1,
      episodePercent: 45,
      watchedEpisodes: 2,
      totalEpisodes: 26,
    }
    const result = getTvProgress(rawProgress, null)
    expect(result.watchedEpisodes).toBe(2)
    expect(result.totalEpisodes).toBe(26)
    expect(result.completedPct).toBe(8)
    expect(result.episodePercent).toBe(45)
    expect(result.hasEpisodeBar).toBe(true)
  })

  it('calculates prior seasons progress correctly for Season 1', () => {
    const progress: JellyfinProgress = {
      tmdbId: 123,
      mediaType: 'tv',
      jellyfinStatus: 'watching',
      season: 1,
      episode: 5,
      episodePercent: 20,
      watchedEpisodes: 4,
      totalEpisodes: 56,
    }
    const result = getTvProgress(progress, mockTvMeta)
    // S1·E5 => prior seasons (none) = 0 episodes. current season S1 = 5 - 1 = 4 episodes.
    // Total watched = 0 + 4 = 4.
    expect(result.watchedEpisodes).toBe(4)
    expect(result.totalEpisodes).toBe(56) // Sum of seasons 1–5: 10 + 13 + 13 + 10 + 10 = 56
    expect(result.completedPct).toBe(7) // 4 / 56 = 7.14% -> 7%
    expect(result.episodePercent).toBe(20)
    expect(result.hasEpisodeBar).toBe(true)
  })

  it('calculates implicit prior seasons progress correctly for Season 5, Episode 1 (with specials ignored)', () => {
    const progress: JellyfinProgress = {
      tmdbId: 123,
      mediaType: 'tv',
      jellyfinStatus: 'watching',
      season: 5,
      episode: 1,
      episodePercent: 45,
      watchedEpisodes: 0,
      totalEpisodes: 26,
    }
    const result = getTvProgress(progress, mockTvMeta)
    // S5·E1 => prior seasons (S1: 10, S2: 13, S3: 13, S4: 10) = 46. current season S5 = 1 - 1 = 0.
    // Total watched = 46 + 0 = 46.
    expect(result.watchedEpisodes).toBe(46)
    expect(result.totalEpisodes).toBe(56) // Sum of seasons 1–5 (specials S0 ignored)
    expect(result.completedPct).toBe(82) // 46 / 56 = 82.14% -> 82%
    expect(result.episodePercent).toBe(45)
    expect(result.hasEpisodeBar).toBe(true)
  })
})
