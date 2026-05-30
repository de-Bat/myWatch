import type { Playlist, PlaylistItem } from '@mywatch/core'
import type { Sql } from 'postgres'

export interface PlaylistRepo {
  upsertPlaylists(userId: string, playlists: Playlist[]): Promise<void>
  upsertPlaylistItems(playlistItems: PlaylistItem[]): Promise<void>
  findPlaylistsSince(userId: string, since: string): Promise<Playlist[]>
  findPlaylistItemsSince(userId: string, since: string): Promise<PlaylistItem[]>
}

interface PlaylistRow {
  id: string
  user_id: string
  name: string
  description: string | null
  type: 'manual' | 'smart'
  smart_rules: unknown
  sort_order: number
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  device_id: string
}

interface PlaylistItemRow {
  id: string
  playlist_id: string
  tmdb_id: number
  media_type: 'movie' | 'tv'
  position: number
  added_at: Date
}

function mapPlaylistRow(row: PlaylistRow): Playlist {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    type: row.type,
    smartRules: row.smart_rules as Playlist['smartRules'],
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at?.toISOString() ?? null,
    deviceId: row.device_id,
  }
}

function mapItemRow(row: PlaylistItemRow): PlaylistItem {
  return {
    id: row.id,
    playlistId: row.playlist_id,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    position: row.position,
    addedAt: row.added_at.toISOString(),
  }
}

export function createPlaylistRepo(sql: Sql): PlaylistRepo {
  return {
    async upsertPlaylists(userId, playlists) {
      if (playlists.length === 0) return

      for (const p of playlists) {
        await sql`
          INSERT INTO playlists (
            id, user_id, name, description, type, smart_rules,
            sort_order, created_at, updated_at, device_id, deleted_at
          ) VALUES (
            ${p.id}, ${userId}, ${p.name}, ${p.description}, ${p.type},
            ${p.smartRules ? sql.json(p.smartRules as never) : null},
            ${p.sortOrder}, ${p.createdAt}, ${p.updatedAt}, ${p.deviceId}, ${p.deletedAt}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            type = EXCLUDED.type,
            smart_rules = EXCLUDED.smart_rules,
            sort_order = EXCLUDED.sort_order,
            updated_at = EXCLUDED.updated_at,
            device_id = EXCLUDED.device_id,
            deleted_at = EXCLUDED.deleted_at
          WHERE EXCLUDED.updated_at > playlists.updated_at
        `
      }
    },

    async upsertPlaylistItems(items) {
      if (items.length === 0) return

      for (const item of items) {
        await sql`
          INSERT INTO playlist_items (id, playlist_id, tmdb_id, media_type, position, added_at)
          VALUES (${item.id}, ${item.playlistId}, ${item.tmdbId}, ${item.mediaType}, ${item.position}, ${item.addedAt})
          ON CONFLICT (id) DO UPDATE SET
            position = EXCLUDED.position
        `
      }
    },

    async findPlaylistsSince(userId, since) {
      const rows = await sql<PlaylistRow[]>`
        SELECT id, user_id, name, description, type, smart_rules,
               sort_order, created_at, updated_at, device_id, deleted_at
        FROM playlists
        WHERE user_id = ${userId}
          AND updated_at > ${since}::timestamptz
        ORDER BY updated_at ASC
      `
      return rows.map(mapPlaylistRow)
    },

    async findPlaylistItemsSince(userId, since) {
      const rows = await sql<PlaylistItemRow[]>`
        SELECT pi.id, pi.playlist_id, pi.tmdb_id, pi.media_type, pi.position, pi.added_at
        FROM playlist_items pi
        JOIN playlists p ON p.id = pi.playlist_id
        WHERE p.user_id = ${userId}
          AND pi.added_at > ${since}::timestamptz
        ORDER BY pi.added_at ASC
      `
      return rows.map(mapItemRow)
    },
  }
}
