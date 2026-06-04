import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Sql } from 'postgres'
import { createPluginRepo } from '../src/repos/plugin-repo.js'

function makeSql(rows: unknown[] = []) {
  const sql = vi.fn().mockResolvedValue(rows) as unknown as Sql
  // Tagged template literal: sql`...` returns sql(...)
  return new Proxy(sql, {
    apply: (_t, _this, args) => sql(...args),
    get: (t, prop) => (prop === 'then' ? undefined : (t as Record<string, unknown>)[prop as string]),
  }) as unknown as Sql
}

describe('createPluginRepo', () => {
  it('list returns mapped rows', async () => {
    const sql = makeSql([
      { id: 'youtube', display_name: 'YouTube Links', source: 'builtin', enabled: true, installed_at: null },
    ])
    const repo = createPluginRepo(sql)
    const result = await repo.list()
    expect(result[0]).toEqual({
      id: 'youtube',
      displayName: 'YouTube Links',
      source: 'builtin',
      enabled: true,
      installedAt: undefined,
    })
  })

  it('getById returns null when no rows', async () => {
    const sql = makeSql([])
    const repo = createPluginRepo(sql)
    const result = await repo.getById('missing')
    expect(result).toBeNull()
  })

  it('upsert calls sql with correct params', async () => {
    const sql = makeSql()
    const repo = createPluginRepo(sql)
    await repo.upsert({ id: 'foo', displayName: 'Foo', source: 'custom', enabled: true, installedAt: '2026-01-01T00:00:00.000Z' })
    expect(sql).toHaveBeenCalled()
  })

  it('setEnabled calls sql', async () => {
    const sql = makeSql()
    const repo = createPluginRepo(sql)
    await repo.setEnabled('foo', false)
    expect(sql).toHaveBeenCalled()
  })

  it('remove calls sql', async () => {
    const sql = makeSql()
    const repo = createPluginRepo(sql)
    await repo.remove('foo')
    expect(sql).toHaveBeenCalled()
  })
})
