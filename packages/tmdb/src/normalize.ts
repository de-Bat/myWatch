import type { MediaCache } from '@mywatch/core'
import type { TmdbMovieDetail, TmdbTvDetail } from './types'

export function normalizeMovie(movie: TmdbMovieDetail): MediaCache {
  return {
    tmdbId: movie.id,
    mediaType: 'movie',
    title: movie.title,
    overview: movie.overview,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    releaseDate: movie.release_date || null,
    genres: movie.genres,
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    runtime: movie.runtime,
    seasonsCount: null,
    showStatus: movie.status,
    cachedAt: new Date().toISOString(),
    watchProviders: null,
    watchProvidersRegion: null,
    watchProvidersCachedAt: null,
  }
}

export function normalizeTv(show: TmdbTvDetail): MediaCache {
  const avgRuntime =
    show.episode_run_time.length > 0
      ? Math.round(
          show.episode_run_time.reduce((a, b) => a + b, 0) / show.episode_run_time.length,
        )
      : null

  return {
    tmdbId: show.id,
    mediaType: 'tv',
    title: show.name,
    overview: show.overview,
    posterPath: show.poster_path,
    backdropPath: show.backdrop_path,
    releaseDate: show.first_air_date || null,
    genres: show.genres,
    voteAverage: show.vote_average,
    voteCount: show.vote_count,
    runtime: avgRuntime,
    seasonsCount: show.number_of_seasons,
    showStatus: show.status,
    cachedAt: new Date().toISOString(),
    watchProviders: null,
    watchProvidersRegion: null,
    watchProvidersCachedAt: null,
  }
}
