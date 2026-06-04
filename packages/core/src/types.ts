export type MediaType = 'movie' | 'tv'

export type WatchStatus = 'planned' | 'in_progress' | 'watched' | 'quit'

export interface User {
  id: string
  email: string | null
  displayName: string
  avatarUrl: string | null
  isGuest: boolean
  createdAt: string
  updatedAt: string
}

export interface WatchlistItem {
  id: string
  userId: string
  tmdbId: number
  mediaType: MediaType
  status: WatchStatus
  progressEpisode: number | null
  progressSeason: number | null
  rating: number | null
  notes: string | null
  addedAt: string
  startedAt: string | null
  finishedAt: string | null
  quitAt: string | null
  updatedAt: string
  deviceId: string
  deletedAt: string | null
  customPlatforms: string[]
  displayOverrides?: Record<string, boolean>
}

export interface WatchProvider {
  providerId: number
  providerName: string
  logoPath: string | null
  displayPriority: number
}

export interface MediaCache {
  tmdbId: number
  mediaType: MediaType
  title: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string | null
  genres: Array<{ id: number; name: string }>
  voteAverage: number
  voteCount: number
  runtime: number | null
  seasonsCount: number | null
  seasons?: Array<{
    seasonNumber: number
    episodeCount: number
  }> | null
  showStatus: string | null
  cachedAt: string
  watchProviders: WatchProvider[] | null
  watchProvidersRegion: string | null
  watchProvidersCachedAt: string | null
  language?: string
  youtubeTrailerKey?: string | null
}

export interface Playlist {
  id: string
  userId: string
  name: string
  description: string | null
  type: 'manual' | 'smart' | (string & {})
  smartRules: SmartRules | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  deviceId: string
  isDefault?: boolean
}

export interface PlaylistItem {
  id: string
  playlistId: string
  tmdbId: number
  mediaType: MediaType
  position: number
  addedAt: string
}

export interface SmartRules {
  statuses?: WatchStatus[]
  mediaTypes?: MediaType[]
  genres?: string[]
  minRating?: number
  maxRating?: number
}

export interface JellyfinProgress {
  tmdbId: number
  mediaType: MediaType
  jellyfinStatus: 'planned' | 'watching' | 'watched'
  moviePercent?: number | null
  season?: number | null
  episode?: number | null
  episodePercent?: number | null
  watchedEpisodes?: number | null
  totalEpisodes?: number | null
  updatedAt?: string
}

export interface ProgressRecap {
  tmdbId: number
  mediaType: MediaType
  progressPercent: number | null
  progressSeason: number | null
  progressEpisode: number | null
  recapText: string
  updatedAt: string
}

export interface PluginItem {
  id: string
  pluginId: string
  listTypeId: string
  playlistId: string
  data: Record<string, unknown>
  addedAt: string
  updatedAt: string
  deletedAt: string | null
}
