import type { MediaCache } from '@mywatch/core'
import type { TmdbMovieDetail, TmdbTvDetail } from './types'

export function normalizeMovie(movie: TmdbMovieDetail, language?: string): MediaCache {
  const videos = movie.videos?.results ?? []
  const trailer = videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') || videos.find((v) => v.site === 'YouTube')
  const youtubeTrailerKey = trailer ? trailer.key : null

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
    language,
    youtubeTrailerKey,
  }
}

export function normalizeTv(show: TmdbTvDetail, language?: string): MediaCache {
  const avgRuntime =
    show.episode_run_time.length > 0
      ? Math.round(
          show.episode_run_time.reduce((a, b) => a + b, 0) / show.episode_run_time.length,
        )
      : null

  const videos = show.videos?.results ?? []
  const trailer = videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') || videos.find((v) => v.site === 'YouTube')
  const youtubeTrailerKey = trailer ? trailer.key : null

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
    seasons: show.seasons
      ? show.seasons.map((s) => ({
          seasonNumber: s.season_number,
          episodeCount: s.episode_count,
        }))
      : null,
    showStatus: show.status,
    cachedAt: new Date().toISOString(),
    watchProviders: null,
    watchProvidersRegion: null,
    watchProvidersCachedAt: null,
    language,
    youtubeTrailerKey,
  }
}
