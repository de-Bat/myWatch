import type { Sql } from 'postgres'
import type { InstalledPluginMeta } from '@mywatch/core'

export interface PluginRepo {
  list(): Promise<InstalledPluginMeta[]>
  getById(id: string): Promise<InstalledPluginMeta | null>
  upsert(meta: InstalledPluginMeta): Promise<void>
  setEnabled(id: string, enabled: boolean): Promise<void>
  remove(id: string): Promise<void>
}

interface PluginRow {
  id: string
  display_name: string
  source: 'builtin' | 'custom'
  enabled: boolean
  installed_at: Date | null
}

function rowToMeta(row: PluginRow): InstalledPluginMeta {
  return {
    id: row.id,
    displayName: row.display_name,
    source: row.source,
    enabled: row.enabled,
    installedAt: row.installed_at?.toISOString(),
  }
}

export function createPluginRepo(sql: Sql): PluginRepo {
  return {
    async list() {
      const rows = await sql<PluginRow[]>`
        SELECT id, display_name, source, enabled, installed_at
        FROM installed_plugins
        ORDER BY source, id
      `
      return rows.map(rowToMeta)
    },

    async getById(id) {
      const rows = await sql<PluginRow[]>`
        SELECT id, display_name, source, enabled, installed_at
        FROM installed_plugins WHERE id = ${id}
      `
      return rows[0] ? rowToMeta(rows[0]) : null
    },

    async upsert(meta) {
      await sql`
        INSERT INTO installed_plugins (id, display_name, source, enabled, installed_at)
        VALUES (
          ${meta.id}, ${meta.displayName}, ${meta.source}, ${meta.enabled},
          ${meta.installedAt ? new Date(meta.installedAt) : null}
        )
        ON CONFLICT (id) DO UPDATE SET
          display_name  = EXCLUDED.display_name,
          source        = EXCLUDED.source,
          enabled       = EXCLUDED.enabled,
          installed_at  = EXCLUDED.installed_at
      `
    },

    async setEnabled(id, enabled) {
      await sql`
        UPDATE installed_plugins SET enabled = ${enabled} WHERE id = ${id}
      `
    },

    async remove(id) {
      await sql`DELETE FROM installed_plugins WHERE id = ${id}`
    },
  }
}
