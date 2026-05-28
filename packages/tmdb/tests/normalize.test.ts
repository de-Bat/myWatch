import { describe, it, expect } from 'vitest'
import { normalizeMovie, normalizeTv } from '../src/normalize'
import type { TmdbMovieDetail, TmdbTvDetail } from '../src/types'

const movie: TmdbMovieDetail = {
  id: 603,
  title: 'The Matrix',
  overview: 'A hacker discovers reality.',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  release_date: '1999-03-31',
  genres: [{ id: 28, name: 'Action' }],
  vote_average: 8.7,
  vote_count: 24000,
  runtime: 136,
  status: 'Released',
}

const tvShow: TmdbTvDetail = {
  id: 1396,
  name: 'Breaking Bad',
  overview: 'A chemistry teacher turns to crime.',
  poster_path: '/bb.jpg',
  backdrop_path: null,
  first_air_date: '2008-01-20',
  genres: [{ id: 18, name: 'Drama' }],
  vote_average: 9.5,
  vote_count: 12000,
  episode_run_time: [45, 47],
  number_of_seasons: 5,
  status: 'Ended',
}

describe('normalizeMovie', () => {
  it('maps id to tmdbId', () => {
    expect(normalizeMovie(movie).tmdbId).toBe(603)
  })

  it('sets mediaType to movie', () => {
    expect(normalizeMovie(movie).mediaType).toBe('movie')
  })

  it('maps runtime directly', () => {
    expect(normalizeMovie(movie).runtime).toBe(136)
  })

  it('sets seasonsCount to null', () => {
    expect(normalizeMovie(movie).seasonsCount).toBeNull()
  })

  it('maps showStatus', () => {
    expect(normalizeMovie(movie).showStatus).toBe('Released')
  })
})

describe('normalizeTv', () => {
  it('maps id to tmdbId', () => {
    expect(normalizeTv(tvShow).tmdbId).toBe(1396)
  })

  it('uses name as title', () => {
    expect(normalizeTv(tvShow).title).toBe('Breaking Bad')
  })

  it('averages episode_run_time', () => {
    expect(normalizeTv(tvShow).runtime).toBe(46) // Math.round((45+47)/2)
  })

  it('sets seasonsCount', () => {
    expect(normalizeTv(tvShow).seasonsCount).toBe(5)
  })

  it('uses first_air_date as releaseDate', () => {
    expect(normalizeTv(tvShow).releaseDate).toBe('2008-01-20')
  })

  it('handles empty episode_run_time as null runtime', () => {
    const noRuntime = { ...tvShow, episode_run_time: [] }
    expect(normalizeTv(noRuntime).runtime).toBeNull()
  })
})
