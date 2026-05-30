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
  showStatus: string | null
  cachedAt: string
  watchProviders: WatchProvider[] | null
  watchProvidersRegion: string | null
  watchProvidersCachedAt: string | null
}

export interface Playlist {
  id: string
  userId: string
  name: string
  description: string | null
  type: 'manual' | 'smart'
  smartRules: SmartRules | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  deviceId: string
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
