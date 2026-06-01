import type { Sql } from 'postgres'
import type { ProgressRecap } from '@mywatch/core'

export interface RecapRepo {
  upsertRecap(
    userId: string,
    recap: {
      tmdbId: number
      mediaType: 'movie' | 'tv'
      progressPercent: number | null
      progressSeason: number | null
      progressEpisode: number | null
      recapText: string
    },
  ): Promise<void>
  findSince(userId: string, since: string): Promise<ProgressRecap[]>
  getRecap(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<ProgressRecap | null>
}

interface RecapRow {
  user_id: string
  tmdb_id: number
  media_type: 'movie' | 'tv'
  progress_percent: number | null
  progress_season: number | null
  progress_episode: number | null
  recap_text: string
  updated_at: Date
}

function mapRow(row: RecapRow): ProgressRecap {
  return {
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    progressPercent: row.progress_percent,
    progressSeason: row.progress_season,
    progressEpisode: row.progress_episode,
    recapText: row.recap_text,
    updatedAt: row.updated_at.toISOString(),
  }
}

export function createRecapRepo(sql: Sql): RecapRepo {
  return {
    async upsertRecap(userId, recap) {
      const now = new Date().toISOString()
      const progressPercent = recap.progressPercent ?? null
      const progressSeason = recap.progressSeason ?? null
      const progressEpisode = recap.progressEpisode ?? null

      await sql`
        INSERT INTO progress_recaps (
          user_id, tmdb_id, media_type,
          progress_percent, progress_season, progress_episode,
          recap_text, updated_at
        ) VALUES (
          ${userId}, ${recap.tmdbId}, ${recap.mediaType},
          ${progressPercent}, ${progressSeason}, ${progressEpisode},
          ${recap.recapText}, ${now}
        )
        ON CONFLICT (user_id, tmdb_id, media_type) DO UPDATE SET
          progress_percent = EXCLUDED.progress_percent,
          progress_season = EXCLUDED.progress_season,
          progress_episode = EXCLUDED.progress_episode,
          recap_text = EXCLUDED.recap_text,
          updated_at = EXCLUDED.updated_at
      `
    },

    async findSince(userId, since) {
      const rows = await sql<RecapRow[]>`
        SELECT user_id, tmdb_id, media_type,
               progress_percent, progress_season, progress_episode,
               recap_text, updated_at
        FROM progress_recaps
        WHERE user_id = ${userId}
          AND updated_at > ${since}::timestamptz
        ORDER BY updated_at ASC
      `
      return rows.map(mapRow)
    },

    async getRecap(userId, tmdbId, mediaType) {
      const rows = await sql<RecapRow[]>`
        SELECT user_id, tmdb_id, media_type,
               progress_percent, progress_season, progress_episode,
               recap_text, updated_at
        FROM progress_recaps
        WHERE user_id = ${userId}
          AND tmdb_id = ${tmdbId}
          AND media_type = ${mediaType}
        LIMIT 1
      `
      return rows[0] ? mapRow(rows[0]) : null
    },
  }
}
