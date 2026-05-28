import { describe, it, expect } from 'vitest'
import { resolveConflict, mergeItems } from '../src/conflict'
import type { WatchlistItem } from '@mywatch/core'

function makeItem(overrides: Partial<WatchlistItem> = {}): WatchlistItem {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    tmdbId: 1396,
    mediaType: 'tv',
    status: 'planned',
    progressEpisode: null,
    progressSeason: null,
    rating: null,
    notes: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    quitAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deviceId: 'device-a',
    deletedAt: null,
    ...overrides,
  }
}

describe('resolveConflict', () => {
  it('remote wins when remote is newer', () => {
    const local = makeItem({ updatedAt: '2026-06-01T10:00:00.000Z', status: 'planned' })
    const remote = makeItem({ updatedAt: '2026-06-01T11:00:00.000Z', status: 'watched' })
    expect(resolveConflict(local, remote).status).toBe('watched')
  })

  it('local wins when local is newer', () => {
    const local = makeItem({ updatedAt: '2026-06-01T12:00:00.000Z', status: 'in_progress' })
    const remote = makeItem({ updatedAt: '2026-06-01T11:00:00.000Z', status: 'planned' })
    expect(resolveConflict(local, remote).status).toBe('in_progress')
  })

  it('local wins on timestamp tie', () => {
    const ts = '2026-06-01T10:00:00.000Z'
    const local = makeItem({ updatedAt: ts, status: 'in_progress', deviceId: 'device-local' })
    const remote = makeItem({ updatedAt: ts, status: 'planned', deviceId: 'device-remote' })
    expect(resolveConflict(local, remote).deviceId).toBe('device-local')
  })
})

describe('mergeItems', () => {
  it('includes items only in remote', () => {
    const remote = makeItem({ id: 'aaa-0000-0000-0000-000000000001' })
    const result = mergeItems([], [remote])
    expect(result).toHaveLength(1)
  })

  it('includes items only in local', () => {
    const local = makeItem({ id: 'aaa-0000-0000-0000-000000000001' })
    const result = mergeItems([local], [])
    expect(result).toHaveLength(1)
  })

  it('resolves conflicts for same id', () => {
    const local = makeItem({ id: 'aaa-0000-0000-0000-000000000001', updatedAt: '2026-06-01T10:00:00.000Z', status: 'planned' })
    const remote = makeItem({ id: 'aaa-0000-0000-0000-000000000001', updatedAt: '2026-06-01T12:00:00.000Z', status: 'watched' })
    const result = mergeItems([local], [remote])
    expect(result).toHaveLength(1)
    expect(result[0]?.status).toBe('watched')
  })

  it('excludes soft-deleted items from result', () => {
    const deleted = makeItem({
      id: 'aaa-0000-0000-0000-000000000001',
      deletedAt: '2026-06-01T10:00:00.000Z',
    })
    const result = mergeItems([deleted], [])
    expect(result).toHaveLength(0)
  })

  it('merges unrelated items from both sides', () => {
    const local = makeItem({ id: 'aaa-0000-0000-0000-000000000001' })
    const remote = makeItem({ id: 'bbb-0000-0000-0000-000000000002' })
    const result = mergeItems([local], [remote])
    expect(result).toHaveLength(2)
  })
})
