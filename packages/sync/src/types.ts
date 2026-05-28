import type { WatchlistItem } from '@mywatch/core'

export interface SyncPushPayload {
  items: WatchlistItem[]
}

export interface SyncPullResponse {
  items: WatchlistItem[]
  pulledAt: string
}

export interface SyncMeta {
  lastPushedAt: string | null
  lastPulledAt: string | null
  pendingCount: number
}

export interface DeviceIdStorage {
  get(): string | null
  set(id: string): void
}
