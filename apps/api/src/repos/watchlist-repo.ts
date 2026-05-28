import type { WatchlistItem } from '@mywatch/core'
import type { Sql } from 'postgres'

export interface WatchlistRepo {
  upsertItems(userId: string, items: WatchlistItem[]): Promise<void>
  findSince(userId: string, since: string): Promise<WatchlistItem[]>
}

export function createWatchlistRepo(_sql: Sql): WatchlistRepo {
  throw new Error('WatchlistRepo not yet implemented')
}
