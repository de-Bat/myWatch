import type { JellyfinProgress } from '@mywatch/core'
import type { Sql } from 'postgres'

export interface JellyfinRepo {
  upsertProgress(userId: string, items: JellyfinProgress[]): Promise<void>
  findSince(userId: string, since: string): Promise<JellyfinProgress[]>
  updateUserCredentials(userId: string, url: string, apiKey: string, jellyfinUserId: string): Promise<void>
  getAllConfiguredUsers(): Promise<Array<{ id: string; url: string; apiKey: string; jellyfinUserId: string }>>
}

interface ProgressRow {
  user_id: string
  tmdb_id: number
  media_type: 'movie' | 'tv'
  jellyfin_status: 'planned' | 'watching' | 'watched'
  movie_percent: number | null
  season: number | null
  episode: number | null
  episode_percent: number | null
  watched_episodes: number | null
  total_episodes: number | null
  updated_at: Date
}

function mapRow(row: ProgressRow): JellyfinProgress {
  return {
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    jellyfinStatus: row.jellyfin_status,
    moviePercent: row.movie_percent,
    season: row.season,
    episode: row.episode,
    episodePercent: row.episode_percent,
    watchedEpisodes: row.watched_episodes,
    totalEpisodes: row.total_episodes,
    updatedAt: row.updated_at.toISOString(),
  }
}

export function createJellyfinRepo(sql: Sql): JellyfinRepo {
  return {
    async upsertProgress(userId, items) {
      if (items.length === 0) return

      const now = new Date().toISOString()
      
      for (const item of items) {
        const moviePercent = item.moviePercent ?? null
        const season = item.season ?? null
        const episode = item.episode ?? null
        const episodePercent = item.episodePercent ?? null
        const watchedEpisodes = item.watchedEpisodes ?? null
        const totalEpisodes = item.totalEpisodes ?? null

        await sql`
          INSERT INTO jellyfin_progress (
            user_id, tmdb_id, media_type, jellyfin_status,
            movie_percent, season, episode, episode_percent,
            watched_episodes, total_episodes, updated_at
          ) VALUES (
            ${userId}, ${item.tmdbId}, ${item.mediaType}, ${item.jellyfinStatus},
            ${moviePercent}, ${season}, ${episode}, ${episodePercent},
            ${watchedEpisodes}, ${totalEpisodes}, ${now}
          )
          ON CONFLICT (user_id, tmdb_id, media_type) DO UPDATE SET
            jellyfin_status = EXCLUDED.jellyfin_status,
            movie_percent = EXCLUDED.movie_percent,
            season = EXCLUDED.season,
            episode = EXCLUDED.episode,
            episode_percent = EXCLUDED.episode_percent,
            watched_episodes = EXCLUDED.watched_episodes,
            total_episodes = EXCLUDED.total_episodes,
            updated_at = EXCLUDED.updated_at
        `
      }
    },

    async findSince(userId, since) {
      const rows = await sql<ProgressRow[]>`
        SELECT user_id, tmdb_id, media_type, jellyfin_status,
               movie_percent, season, episode, episode_percent,
               watched_episodes, total_episodes, updated_at
        FROM jellyfin_progress
        WHERE user_id = ${userId}
          AND updated_at > ${since}::timestamptz
        ORDER BY updated_at ASC
      `
      return rows.map(mapRow)
    },

    async updateUserCredentials(userId, url, apiKey, jellyfinUserId) {
      await sql`
        UPDATE users
        SET jellyfin_url = ${url},
            jellyfin_api_key = ${apiKey},
            jellyfin_user_id = ${jellyfinUserId}
        WHERE id = ${userId}
      `
    },

    async getAllConfiguredUsers() {
      const rows = await sql<{ id: string; jellyfin_url: string; jellyfin_api_key: string; jellyfin_user_id: string }[]>`
        SELECT id, jellyfin_url, jellyfin_api_key, jellyfin_user_id
        FROM users
        WHERE jellyfin_url IS NOT NULL 
          AND jellyfin_url != ''
          AND jellyfin_api_key IS NOT NULL 
          AND jellyfin_api_key != ''
          AND jellyfin_user_id IS NOT NULL 
          AND jellyfin_user_id != ''
      `
      return rows.map(r => ({
        id: r.id,
        url: r.jellyfin_url,
        apiKey: r.jellyfin_api_key,
        jellyfinUserId: r.jellyfin_user_id,
      }))
    }
  }
}
