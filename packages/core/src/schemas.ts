import { z } from 'zod'

export const mediaTypeSchema = z.enum(['movie', 'tv'])

export const watchStatusSchema = z.enum(['planned', 'in_progress', 'watched', 'quit'])

export const watchlistItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tmdbId: z.number().int().positive(),
  mediaType: mediaTypeSchema,
  status: watchStatusSchema,
  progressEpisode: z.number().int().nonnegative().nullable(),
  progressSeason: z.number().int().nonnegative().nullable(),
  rating: z.number().int().min(1).max(10).nullable(),
  notes: z.string().nullable(),
  addedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  quitAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  deviceId: z.string().min(1),
  deletedAt: z.string().datetime().nullable(),
})

export const mediaCacheSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: mediaTypeSchema,
  title: z.string().min(1),
  overview: z.string(),
  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),
  releaseDate: z.string().nullable(),
  genres: z.array(z.object({ id: z.number(), name: z.string() })),
  voteAverage: z.number().min(0).max(10),
  voteCount: z.number().int().nonnegative(),
  runtime: z.number().int().positive().nullable(),
  seasonsCount: z.number().int().positive().nullable(),
  showStatus: z.string().nullable(),
  cachedAt: z.string().datetime(),
})

export type WatchlistItemInput = z.input<typeof watchlistItemSchema>
export type MediaCacheInput = z.input<typeof mediaCacheSchema>
