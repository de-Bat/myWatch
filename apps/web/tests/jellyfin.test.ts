// apps/web/tests/jellyfin.test.ts
import { describe, it, expect } from 'vitest'
import { mapMovie, mapSeries, findCurrentEpisode } from '@mywatch/core'
import type { JellyfinItem, JellyfinEpisode } from '@mywatch/core'

const BASE_ITEM: JellyfinItem = {
  Id: 'jf-1',
  ProviderIds: { Tmdb: '550' },
  UserData: { Played: false, PlaybackPositionTicks: 0 },
}

describe('mapMovie', () => {
  it('returns null when ProviderIds.Tmdb is missing', () => {
    expect(mapMovie({ ...BASE_ITEM, ProviderIds: {} })).toBeNull()
  })

  it('returns null when Tmdb id is not a number', () => {
    expect(mapMovie({ ...BASE_ITEM, ProviderIds: { Tmdb: 'abc' } })).toBeNull()
  })

  it('returns planned when not played and no ticks', () => {
    const result = mapMovie(BASE_ITEM)
    expect(result).toEqual({ tmdbId: 550, mediaType: 'movie', jellyfinStatus: 'planned' })
  })

  it('returns watched with moviePercent 100 when Played=true', () => {
    const result = mapMovie({ ...BASE_ITEM, UserData: { Played: true, PlaybackPositionTicks: 0 } })
    expect(result).toEqual({ tmdbId: 550, mediaType: 'movie', jellyfinStatus: 'watched', moviePercent: 100 })
  })

  it('returns watching with correct percent when in progress', () => {
    const result = mapMovie({
      ...BASE_ITEM,
      RunTimeTicks: 10_000_000,
      UserData: { Played: false, PlaybackPositionTicks: 5_000_000 },
    })
    expect(result).toEqual({ tmdbId: 550, mediaType: 'movie', jellyfinStatus: 'watching', moviePercent: 50 })
  })

  it('clamps percent to 100', () => {
    const result = mapMovie({
      ...BASE_ITEM,
      RunTimeTicks: 100,
      UserData: { Played: false, PlaybackPositionTicks: 200 },
    })
    expect(result?.moviePercent).toBe(100)
  })

  it('returns planned (not watching) when ticks > 0 but no RunTimeTicks', () => {
    const result = mapMovie({
      ...BASE_ITEM,
      UserData: { Played: false, PlaybackPositionTicks: 5_000_000 },
    })
    expect(result?.jellyfinStatus).toBe('planned')
  })
})

describe('mapSeries', () => {
  const BASE_SERIES: JellyfinItem = {
    Id: 'jf-s1',
    ProviderIds: { Tmdb: '1396' },
    UserData: { Played: false, PlaybackPositionTicks: 0, UnplayedItemCount: 62 },
    RecursiveItemCount: 62,
  }

  it('returns null when Tmdb id is missing', () => {
    expect(mapSeries({ ...BASE_SERIES, ProviderIds: {} })).toBeNull()
  })

  it('returns planned when nothing played', () => {
    const result = mapSeries(BASE_SERIES)
    expect(result?.progress.jellyfinStatus).toBe('planned')
    expect(result?.jellyfinId).toBe('jf-s1')
  })

  it('returns watched when UnplayedItemCount is 0', () => {
    const result = mapSeries({
      ...BASE_SERIES,
      UserData: { Played: false, PlaybackPositionTicks: 0, UnplayedItemCount: 0 },
    })
    expect(result?.progress.jellyfinStatus).toBe('watched')
  })

  it('returns watched when UserData.Played is true', () => {
    const result = mapSeries({
      ...BASE_SERIES,
      UserData: { Played: true, PlaybackPositionTicks: 0, UnplayedItemCount: 62 },
    })
    expect(result?.progress.jellyfinStatus).toBe('watched')
  })

  it('returns watching when some episodes played', () => {
    const result = mapSeries({
      ...BASE_SERIES,
      UserData: { Played: false, PlaybackPositionTicks: 0, UnplayedItemCount: 55 },
      RecursiveItemCount: 62,
    })
    expect(result?.progress.jellyfinStatus).toBe('watching')
  })

  it('returns watching when PlaybackPositionTicks > 0', () => {
    const result = mapSeries({
      ...BASE_SERIES,
      UserData: { Played: false, PlaybackPositionTicks: 9_000_000, UnplayedItemCount: 62 },
    })
    expect(result?.progress.jellyfinStatus).toBe('watching')
  })

  it('maps tmdbId correctly', () => {
    expect(mapSeries(BASE_SERIES)?.progress.tmdbId).toBe(1396)
    expect(mapSeries(BASE_SERIES)?.progress.mediaType).toBe('tv')
  })
})

describe('findCurrentEpisode', () => {
  const makeEpisode = (opts: {
    played?: boolean
    ticks?: number
    runtime?: number
    season?: number
    ep?: number
  }): JellyfinEpisode => ({
    UserData: { Played: opts.played ?? false, PlaybackPositionTicks: opts.ticks ?? 0 },
    RunTimeTicks: opts.runtime,
    ParentIndexNumber: opts.season ?? 1,
    IndexNumber: opts.ep ?? 1,
  })

  it('returns null for empty episode list', () => {
    expect(findCurrentEpisode([])).toBeNull()
  })

  it('returns next up unplayed episode when no episodes played or in-progress', () => {
    expect(findCurrentEpisode([makeEpisode({}), makeEpisode({ ep: 2 })])).toEqual({ season: 1, episode: 1, episodePercent: 0 })
  })

  it('returns in-progress episode with percent', () => {
    const episodes = [
      makeEpisode({ played: true, ep: 1 }),
      makeEpisode({ ticks: 4_000_000, runtime: 10_000_000, season: 1, ep: 2 }),
      makeEpisode({ ep: 3 }),
    ]
    expect(findCurrentEpisode(episodes)).toEqual({ season: 1, episode: 2, episodePercent: 40 })
  })

  it('returns next up unplayed episode with episodePercent 0 when none in-progress', () => {
    const episodes = [
      makeEpisode({ played: true, season: 1, ep: 1 }),
      makeEpisode({ played: true, season: 1, ep: 2 }),
      makeEpisode({ season: 1, ep: 3 }),
    ]
    expect(findCurrentEpisode(episodes)).toEqual({ season: 1, episode: 3, episodePercent: 0 })
  })

  it('prefers in-progress over last-played', () => {
    const episodes = [
      makeEpisode({ played: true, season: 1, ep: 1 }),
      makeEpisode({ ticks: 2_000_000, runtime: 10_000_000, season: 1, ep: 2 }),
    ]
    const result = findCurrentEpisode(episodes)
    expect(result?.episode).toBe(2)
    expect(result?.episodePercent).toBe(20)
  })

  it('uses episodePercent 0 when runtime is 0 or missing', () => {
    const episodes = [makeEpisode({ ticks: 5_000_000, season: 2, ep: 3 })]
    expect(findCurrentEpisode(episodes)).toEqual({ season: 2, episode: 3, episodePercent: 0 })
  })

  it('clamps episodePercent to 100', () => {
    const episodes = [makeEpisode({ ticks: 20_000_000, runtime: 10_000_000, season: 1, ep: 1 })]
    expect(findCurrentEpisode(episodes)?.episodePercent).toBe(100)
  })
})
