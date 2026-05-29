import type { WatchlistItem } from '@mywatch/core'
import type { Sql } from 'postgres'

export interface WatchlistRepo {
  upsertItems(userId: string, items: WatchlistItem[]): Promise<void>
  findSince(userId: string, since: string): Promise<WatchlistItem[]>
}

interface WatchlistRow {
  id: string
  user_id: string
  tmdb_id: number
  media_type: 'movie' | 'tv'
  status: 'planned' | 'in_progress' | 'watched' | 'quit'
  progress_episode: number | null
  progress_season: number | null
  rating: number | null
  notes: string | null
  added_at: Date
  started_at: Date | null
  finished_at: Date | null
  quit_at: Date | null
  updated_at: Date
  device_id: string
  deleted_at: Date | null
}

function mapRow(row: WatchlistRow): WatchlistItem {
  return {
    id: row.id,
    userId: row.user_id,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    status: row.status,
    progressEpisode: row.progress_episode,
    progressSeason: row.progress_season,
    rating: row.rating,
    notes: row.notes,
    addedAt: row.added_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    finishedAt: row.finished_at?.toISOString() ?? null,
    quitAt: row.quit_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
    deviceId: row.device_id,
    deletedAt: row.deleted_at?.toISOString() ?? null,
  }
}

export function createWatchlistRepo(sql: Sql): WatchlistRepo {
  return {
    async upsertItems(userId, items) {
      if (items.length === 0) return

      for (const item of items) {
        await sql`
          INSERT INTO watchlist_items (
            id, user_id, tmdb_id, media_type, status,
            progress_episode, progress_season, rating, notes,
            added_at, started_at, finished_at, quit_at,
            updated_at, device_id, deleted_at
          ) VALUES (
            ${item.id}, ${userId}, ${item.tmdbId}, ${item.mediaType}, ${item.status},
            ${item.progressEpisode}, ${item.progressSeason}, ${item.rating}, ${item.notes},
            ${item.addedAt}, ${item.startedAt}, ${item.finishedAt}, ${item.quitAt},
            ${item.updatedAt}, ${item.deviceId}, ${item.deletedAt}
          )
          ON CONFLICT (user_id, tmdb_id, media_type) DO UPDATE SET
            id = EXCLUDED.id,
            status = EXCLUDED.status,
            progress_episode = EXCLUDED.progress_episode,
            progress_season = EXCLUDED.progress_season,
            rating = EXCLUDED.rating,
            notes = EXCLUDED.notes,
            started_at = EXCLUDED.started_at,
            finished_at = EXCLUDED.finished_at,
            quit_at = EXCLUDED.quit_at,
            updated_at = EXCLUDED.updated_at,
            device_id = EXCLUDED.device_id,
            deleted_at = EXCLUDED.deleted_at
          WHERE EXCLUDED.updated_at > watchlist_items.updated_at
        `
      }
    },

    async findSince(userId, since) {
      const rows = await sql<WatchlistRow[]>`
        SELECT id, user_id, tmdb_id, media_type, status,
               progress_episode, progress_season, rating, notes,
               added_at, started_at, finished_at, quit_at,
               updated_at, device_id, deleted_at
        FROM watchlist_items
        WHERE user_id = ${userId}
          AND updated_at > ${since}::timestamptz
        ORDER BY updated_at ASC
      `
      return rows.map(mapRow)
    },
  }
}
