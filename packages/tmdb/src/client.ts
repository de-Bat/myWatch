import type { MediaType } from '@mywatch/core'
import type {
  TmdbSearchResult,
  TmdbMovieDetail,
  TmdbTvDetail,
  TmdbPagedResponse,
  TmdbWatchProvidersResponse,
} from './types'

export interface TmdbClientConfig {
  apiKey: string
  baseUrl?: string
}

export class TmdbClient {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor(config: TmdbClientConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl ?? 'https://api.themoviedb.org/3'
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    const isBearer = this.apiKey.startsWith('eyJ')
    if (!isBearer) url.searchParams.set('api_key', this.apiKey)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
    const headers: Record<string, string> = isBearer
      ? { Authorization: `Bearer ${this.apiKey}` }
      : {}
    const res = await fetch(url.toString(), { headers })
    if (!res.ok) {
      throw new Error(`TMDB ${path} failed: ${res.status}`)
    }
    return res.json() as Promise<T>
  }

  async search(query: string, mediaType?: MediaType): Promise<TmdbSearchResult[]> {
    if (mediaType === 'movie') {
      const data = await this.get<TmdbPagedResponse<TmdbMovieDetail>>('/search/movie', { query })
      return data.results.map((r) => ({ ...r, media_type: 'movie' as const })) as unknown as TmdbSearchResult[]
    }
    if (mediaType === 'tv') {
      const data = await this.get<TmdbPagedResponse<TmdbTvDetail>>('/search/tv', { query })
      return data.results.map((r) => ({ ...r, media_type: 'tv' as const })) as unknown as TmdbSearchResult[]
    }
    const data = await this.get<TmdbPagedResponse<TmdbSearchResult>>('/search/multi', { query })
    return data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
  }

  async getMovie(tmdbId: number, language?: string): Promise<TmdbMovieDetail> {
    const data = await this.get<TmdbMovieDetail>(`/movie/${tmdbId}`, language ? { language } : {})
    if (language && language !== 'en-US' && (!data.overview || !data.title)) {
      try {
        const fallback = await this.get<TmdbMovieDetail>(`/movie/${tmdbId}`, { language: 'en-US' })
        data.overview = data.overview || fallback.overview
        data.title = data.title || fallback.title
      } catch (e) {
        // ignore fallback errors
      }
    }
    return data
  }

  async getTv(tmdbId: number, language?: string): Promise<TmdbTvDetail> {
    const data = await this.get<TmdbTvDetail>(`/tv/${tmdbId}`, language ? { language } : {})
    if (language && language !== 'en-US' && (!data.overview || !data.name)) {
      try {
        const fallback = await this.get<TmdbTvDetail>(`/tv/${tmdbId}`, { language: 'en-US' })
        data.overview = data.overview || fallback.overview
        data.name = data.name || fallback.name
      } catch (e) {
        // ignore fallback errors
      }
    }
    return data
  }

  async getTrending(timeWindow: 'day' | 'week' = 'week'): Promise<TmdbSearchResult[]> {
    const data = await this.get<TmdbPagedResponse<TmdbSearchResult>>(
      `/trending/all/${timeWindow}`,
    )
    return data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
  }

  async getRecommendations(tmdbId: number, mediaType: MediaType): Promise<TmdbSearchResult[]> {
    const path =
      mediaType === 'movie' ? `/movie/${tmdbId}/recommendations` : `/tv/${tmdbId}/recommendations`
    const data = await this.get<TmdbPagedResponse<TmdbSearchResult>>(path)
    return data.results.map((r) => ({ ...r, media_type: mediaType })) as TmdbSearchResult[]
  }

  async getTopRated(mediaType: MediaType): Promise<TmdbSearchResult[]> {
    const path = mediaType === 'movie' ? '/movie/top_rated' : '/tv/top_rated'
    const data = await this.get<TmdbPagedResponse<TmdbSearchResult>>(path)
    return data.results.map((r) => ({ ...r, media_type: mediaType })) as TmdbSearchResult[]
  }

  async getWatchProviders(
    tmdbId: number,
    mediaType: MediaType,
    region = 'US',
  ): Promise<TmdbWatchProvidersResponse> {
    const path = mediaType === 'movie'
      ? `/movie/${tmdbId}/watch/providers`
      : `/tv/${tmdbId}/watch/providers`
    return this.get<TmdbWatchProvidersResponse>(path, { watch_region: region })
  }
}
