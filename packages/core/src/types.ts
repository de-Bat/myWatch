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
}
