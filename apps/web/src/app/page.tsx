'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import type { WatchStatus, MediaType } from '@mywatch/core'
import { useWatchlistItems } from '@/hooks/useWatchlist'
import { useSync } from '@/hooks/useSync'
import { WatchlistItemCard } from '@/components/WatchlistItemCard'

const STATUS_TABS: Array<WatchStatus | 'all'> = ['all', 'planned', 'in_progress', 'watched', 'quit']
const STATUS_LABELS: Record<WatchStatus | 'all', string> = {
  all: 'All',
  planned: 'Planned',
  in_progress: 'In Progress',
  watched: 'Watched',
  quit: 'Quit',
}

type SortOption = 'recently_updated' | 'rating'

export default function HomePage() {
  const { data: session } = useSession()
  const [statusFilter, setStatusFilter] = useState<WatchStatus | 'all'>('all')
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaType | 'all'>('all')
  const [sort, setSort] = useState<SortOption>('recently_updated')
  const items = useWatchlistItems({ status: statusFilter, mediaType: mediaTypeFilter })
  const { syncing, lastSyncedAt, sync } = useSync()

  const sorted = [...(items ?? [])].sort((a, b) => {
    if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    return b.updatedAt.localeCompare(a.updatedAt)
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My List</h1>
        <nav className="flex gap-3 text-sm text-zinc-400">
          <Link href="/search" className="hover:text-zinc-200">Search</Link>
          <Link href="/discover" className="hover:text-zinc-200">Discover</Link>
          <Link href="/profile" className="hover:text-zinc-200">
            {session?.user?.name ?? 'Profile'}
          </Link>
        </nav>
      </header>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition ${
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <select
          value={mediaTypeFilter}
          onChange={(e) => setMediaTypeFilter(e.target.value as MediaType | 'all')}
          className="bg-zinc-800 text-sm rounded px-2 py-1 border border-zinc-700"
        >
          <option value="all">All types</option>
          <option value="movie">Movies</option>
          <option value="tv">TV Shows</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="bg-zinc-800 text-sm rounded px-2 py-1 border border-zinc-700"
        >
          <option value="recently_updated">Recently Updated</option>
          <option value="rating">Rating</option>
        </select>
        {session && (
          <button
            onClick={() => sync()}
            disabled={syncing}
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            {syncing
              ? 'Syncing…'
              : lastSyncedAt
                ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}`
                : 'Sync'}
          </button>
        )}
      </div>

      {items === undefined ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 space-y-2">
          <p>Nothing here yet.</p>
          <Link href="/search" className="text-indigo-400 hover:text-indigo-300 text-sm block">
            Search for something to watch →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <WatchlistItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
