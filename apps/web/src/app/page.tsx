'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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

const SORT_OPTIONS = [
  { value: 'updated', label: 'Recently Updated' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'title', label: 'A – Z' },
] as const
type SortValue = (typeof SORT_OPTIONS)[number]['value']

export default function HomePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<WatchStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<MediaType | 'all'>('all')
  const [sortIndex, setSortIndex] = useState(0)

  const allItems = useWatchlistItems()
  const { syncing, lastSyncedAt, sync } = useSync()

  const sortValue: SortValue = SORT_OPTIONS[sortIndex].value

  const filtered = (allItems ?? []).filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (typeFilter !== 'all' && item.mediaType !== typeFilter) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortValue === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    if (sortValue === 'title') return a.tmdbId - b.tmdbId
    return b.updatedAt.localeCompare(a.updatedAt)
  })

  const statusCounts: Record<WatchStatus | 'all', number> = {
    all: (allItems ?? []).length,
    planned: (allItems ?? []).filter((i) => i.status === 'planned').length,
    in_progress: (allItems ?? []).filter((i) => i.status === 'in_progress').length,
    watched: (allItems ?? []).filter((i) => i.status === 'watched').length,
    quit: (allItems ?? []).filter((i) => i.status === 'quit').length,
  }

  const userInitial = session?.user?.name?.[0]?.toUpperCase() ?? 'U'

  const syncLabel = syncing
    ? 'Syncing…'
    : lastSyncedAt
      ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Sync'

  return (
    <div style={{ maxWidth: 620, width: '100%', padding: '0 0 80px', margin: '0 auto' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between gap-3"
        style={{
          padding: '18px 20px 14px',
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 20,
        }}
      >
        <div className="flex items-center gap-[10px] min-w-0">
          <span
            className="text-[13px] font-bold whitespace-nowrap"
            style={{
              color: 'var(--accent2)',
              background: 'var(--accent-bg)',
              borderRadius: 'var(--rxs)',
              padding: '3px 8px',
              letterSpacing: '-0.02em',
            }}
          >
            myWatch
          </span>
          <h1
            className="flex items-center gap-[7px] whitespace-nowrap"
            style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--fg)' }}
          >
            My List
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{
                color: 'var(--muted2)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--pill)',
                padding: '1px 7px',
              }}
            >
              {sorted.length}
            </span>
          </h1>
        </div>

        <nav className="flex items-center gap-[2px] flex-shrink-0">
          {/* Search */}
          <button
            onClick={() => router.push('/search')}
            title="Search"
            className="flex items-center justify-center w-[34px] h-[34px] border-none cursor-pointer transition-all duration-100"
            style={{ color: 'var(--muted)', background: 'transparent', borderRadius: 'var(--rsm)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fg)'
              e.currentTarget.style.background = 'var(--surface)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <line x1="13" y1="13" x2="17.5" y2="17.5" />
            </svg>
          </button>
          {/* Discover */}
          <button
            onClick={() => router.push('/discover')}
            title="Discover"
            className="flex items-center justify-center w-[34px] h-[34px] border-none cursor-pointer transition-all duration-100"
            style={{ color: 'var(--muted)', background: 'transparent', borderRadius: 'var(--rsm)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fg)'
              e.currentTarget.style.background = 'var(--surface)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="8" />
              <polygon points="8.5,7.5 13.5,10 8.5,12.5 6,10" fill="currentColor" stroke="none" />
            </svg>
          </button>
          {/* Avatar */}
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center justify-center w-[30px] h-[30px] rounded-full border-none cursor-pointer ml-[6px] flex-shrink-0 text-[11px] font-bold"
            style={{
              background: 'var(--accent-bg)',
              border: '1.5px solid var(--accent)',
              color: 'var(--accent2)',
            }}
          >
            {userInitial}
          </button>
        </nav>
      </header>

      {/* Filter bar */}
      <div
        style={{
          position: 'sticky',
          top: 58,
          background: 'var(--bg)',
          zIndex: 10,
          padding: '0 20px 12px',
          borderBottom: '1px solid var(--border2)',
          marginBottom: 14,
        }}
      >
        {/* Status tabs */}
        <div
          className="flex gap-[5px] overflow-x-auto"
          style={{ scrollbarWidth: 'none', padding: '2px 0 10px' }}
        >
          {STATUS_TABS.map((s) => {
            const active = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="inline-flex items-center gap-[5px] whitespace-nowrap border cursor-pointer transition-all duration-[120ms]"
                style={{
                  padding: '5px 11px',
                  borderRadius: 'var(--pill)',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  background: active ? 'var(--accent)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--muted)',
                  borderColor: active ? 'transparent' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = 'var(--fg2)'
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = 'var(--muted)'
                    e.currentTarget.style.borderColor = 'transparent'
                  }
                }}
              >
                {STATUS_LABELS[s]}
                <span
                  className="text-[10px] font-bold tabular-nums text-center"
                  style={{
                    padding: '1px 5px',
                    borderRadius: 'var(--pill)',
                    minWidth: 18,
                    lineHeight: 1.5,
                    background: active ? 'rgba(255,255,255,.15)' : 'var(--border2)',
                    color: active ? 'inherit' : 'var(--muted2)',
                  }}
                >
                  {statusCounts[s]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          {/* Type segmented control */}
          <div
            className="flex"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--rsm)',
              padding: 2,
              gap: 1,
            }}
          >
            {(['all', 'movie', 'tv'] as const).map((t) => {
              const active = typeFilter === t
              const label = t === 'all' ? 'All' : t === 'movie' ? 'Movies' : 'TV'
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className="whitespace-nowrap border-none cursor-pointer transition-all duration-100"
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--rxs)',
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    background: active ? 'var(--surface2)' : 'transparent',
                    color: active ? 'var(--fg)' : 'var(--muted)',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = 'var(--fg2)'
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = 'var(--muted)'
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Sort button */}
          <button
            onClick={() => setSortIndex((i) => (i + 1) % SORT_OPTIONS.length)}
            className="flex items-center gap-[5px] whitespace-nowrap cursor-pointer transition-all duration-100 ml-auto"
            style={{
              padding: '5px 10px',
              borderRadius: 'var(--rsm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--muted)',
              fontSize: 12,
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fg2)'
              e.currentTarget.style.borderColor = 'var(--muted2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="10" y2="8" />
              <line x1="2" y1="12" x2="6" y2="12" />
            </svg>
            {SORT_OPTIONS[sortIndex].label}
          </button>

          {/* Sync */}
          {session && (
            <button
              onClick={() => sync()}
              disabled={syncing}
              className="inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer transition-all duration-100 disabled:opacity-50"
              style={{
                padding: '5px 9px',
                borderRadius: 'var(--rsm)',
                border: '1px solid transparent',
                background: 'transparent',
                color: 'var(--muted2)',
                fontSize: 11,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--muted)'
                e.currentTarget.style.background = 'var(--surface)'
                e.currentTarget.style.borderColor = 'var(--border2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--muted2)'
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              {!syncing && (
                <span
                  className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                  style={{ background: 'var(--green)' }}
                />
              )}
              {syncLabel}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '0 20px' }}>
        {allItems === undefined ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-center" style={{ padding: '64px 16px 48px' }}>
            <div
              className="flex items-center justify-center"
              style={{
                width: 52,
                height: 52,
                borderRadius: 13,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--muted2)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="15" height="14" rx="2" />
                <polyline points="17 8 22 8 22 19 7 19 7 17" />
                <line x1="7" y1="8" x2="12" y2="8" />
                <line x1="7" y1="11.5" x2="14" y2="11.5" />
              </svg>
            </div>
            <p className="font-semibold" style={{ fontSize: 15, color: 'var(--fg2)', letterSpacing: '-0.02em' }}>
              Nothing here yet
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted2)', maxWidth: 220, lineHeight: 1.5, marginTop: -4 }}>
              Try a different filter or search something to watch
            </p>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 5 }}>
            {sorted.map((item) => (
              <WatchlistItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
