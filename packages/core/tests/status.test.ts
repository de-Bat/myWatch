import { describe, it, expect } from 'vitest'
import { canTransition, applyStatusChange } from '../src/status'
import type { WatchlistItem } from '../src/types'

const baseItem: WatchlistItem = {
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
}

describe('canTransition', () => {
  it('allows planned → in_progress', () => {
    expect(canTransition('planned', 'in_progress')).toBe(true)
  })

  it('allows in_progress → watched', () => {
    expect(canTransition('in_progress', 'watched')).toBe(true)
  })

  it('allows watched → planned (re-watch)', () => {
    expect(canTransition('watched', 'planned')).toBe(true)
  })

  it('allows quit → in_progress', () => {
    expect(canTransition('quit', 'in_progress')).toBe(true)
  })

  it('disallows planned → planned (no-op transition)', () => {
    expect(canTransition('planned', 'planned')).toBe(false)
  })
})

describe('applyStatusChange', () => {
  it('sets startedAt when transitioning to in_progress for first time', () => {
    const now = '2026-06-01T10:00:00.000Z'
    const result = applyStatusChange(baseItem, 'in_progress', 'device-b', now)
    expect(result.status).toBe('in_progress')
    expect(result.startedAt).toBe(now)
    expect(result.deviceId).toBe('device-b')
    expect(result.updatedAt).toBe(now)
  })

  it('does not overwrite startedAt on second in_progress transition', () => {
    const firstStart = '2026-06-01T10:00:00.000Z'
    const restarted = { ...baseItem, status: 'quit' as const, startedAt: firstStart }
    const result = applyStatusChange(restarted, 'in_progress', 'device-b', '2026-07-01T00:00:00.000Z')
    expect(result.startedAt).toBe(firstStart)
  })

  it('sets finishedAt and clears quitAt when transitioning to watched', () => {
    const now = '2026-06-01T12:00:00.000Z'
    const inProgress = { ...baseItem, status: 'in_progress' as const }
    const result = applyStatusChange(inProgress, 'watched', 'device-a', now)
    expect(result.finishedAt).toBe(now)
    expect(result.quitAt).toBeNull()
  })

  it('sets quitAt and clears finishedAt when transitioning to quit', () => {
    const now = '2026-06-01T12:00:00.000Z'
    const inProgress = { ...baseItem, status: 'in_progress' as const }
    const result = applyStatusChange(inProgress, 'quit', 'device-a', now)
    expect(result.quitAt).toBe(now)
    expect(result.finishedAt).toBeNull()
  })

  it('clears all timestamps when transitioning to planned', () => {
    const now = '2026-06-01T12:00:00.000Z'
    const watched = {
      ...baseItem,
      status: 'watched' as const,
      startedAt: '2026-05-01T00:00:00.000Z',
      finishedAt: '2026-05-15T00:00:00.000Z',
    }
    const result = applyStatusChange(watched, 'planned', 'device-a', now)
    expect(result.startedAt).toBeNull()
    expect(result.finishedAt).toBeNull()
    expect(result.quitAt).toBeNull()
  })

  it('throws on invalid transition', () => {
    expect(() => applyStatusChange(baseItem, 'planned', 'device-a')).toThrow(
      'Cannot transition from planned to planned',
    )
  })
})
