import type { WatchlistItem, WatchStatus } from './types'

const VALID_TRANSITIONS: Record<WatchStatus, WatchStatus[]> = {
  planned: ['in_progress', 'watched', 'quit'],
  in_progress: ['watched', 'quit', 'planned'],
  watched: ['planned', 'in_progress'],
  quit: ['planned', 'in_progress'],
}

export function canTransition(from: WatchStatus, to: WatchStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function applyStatusChange(
  item: WatchlistItem,
  newStatus: WatchStatus,
  deviceId: string,
  now = new Date().toISOString(),
): WatchlistItem {
  if (!canTransition(item.status, newStatus)) {
    throw new Error(`Cannot transition from ${item.status} to ${newStatus}`)
  }

  const updated: WatchlistItem = { ...item, status: newStatus, updatedAt: now, deviceId }

  if (newStatus === 'in_progress' && item.startedAt === null) {
    updated.startedAt = now
  }
  if (newStatus === 'watched') {
    updated.finishedAt = now
    updated.quitAt = null
  }
  if (newStatus === 'quit') {
    updated.quitAt = now
    updated.finishedAt = null
  }
  if (newStatus === 'planned') {
    updated.startedAt = null
    updated.finishedAt = null
    updated.quitAt = null
  }

  return updated
}
