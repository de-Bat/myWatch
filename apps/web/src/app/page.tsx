'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import type { WatchStatus, MediaType } from '@mywatch/core'
import { useWatchlistItems } from '@/hooks/useWatchlist'
import { useSync } from '@/hooks/useSync'
import { WatchlistItemCard } from '@/components/WatchlistItemCard'
import { GridItemCard } from '@/components/GridItemCard'
import { MediaPanel } from '@/components/MediaPanel'
import { db } from '@/lib/db'

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
type ViewMode = 'list' | 'grid'

const VIEW_STORAGE_KEY = 'mywatch_view'

export default function HomePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [importBanner, setImportBanner] = useState<{ count: number } | null>(null)
  const [statusFilter, setStatusFilter] = useState<WatchStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<MediaType | 'all'>('all')
  const [sortIndex, setSortIndex] = useState(0)
  const [genreFilter, setGenreFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [panel, setPanel] = useState<{ tmdbId: number; mediaType: MediaType } | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY)
    if (saved === 'grid' || saved === 'list') setViewMode(saved)
  }, [])

  useEffect(() => {
    if (searchParams.get('importLocal') === '1') {
      const count = Number(searchParams.get('count') ?? 0)
      if (count > 0) setImportBanner({ count })
      // Clean URL without triggering navigation
      const url = new URL(window.location.href)
      url.searchParams.delete('importLocal')
      url.searchParams.delete('count')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  function setView(v: ViewMode) {
    setViewMode(v)
    localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  const allItems = useWatchlistItems()
  const { syncing, lastSyncedAt, sync } = useSync()

  // Derive available genres from media cache for items currently in list
  const tmdbKeys = (allItems ?? []).map((i) => [i.tmdbId, i.mediaType] as [number, string])
  const genreOptions = useLiveQuery(async () => {
    if (!tmdbKeys.length) return []
    const entries = await db.mediaCache.bulkGet(tmdbKeys)
    const seen = new Set<string>()
    const genres: string[] = []
    for (const entry of entries) {
      if (!entry) continue
      for (const g of entry.genres ?? []) {
        if (!seen.has(g.name)) {
          seen.add(g.name)
          genres.push(g.name)
        }
      }
    }
    return genres.sort()
  }, [allItems?.length]) ?? []

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

  // Genre filter applied after sort (requires media cache lookup — done via a separate memo)
  // We filter by genre using the genreFilter state; the actual cache lookup happens in each card.
  // For page-level genre filtering we query the cache inline here.
  const [genreFilteredIds, setGenreFilteredIds] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!genreFilter) {
      setGenreFilteredIds(null)
      return
    }
    const keys = sorted.map((i) => [i.tmdbId, i.mediaType] as [number, string])
    db.mediaCache.bulkGet(keys).then((entries) => {
      const ids = new Set<string>()
      sorted.forEach((item, idx) => {
        const entry = entries[idx]
        if (entry?.genres?.some((g) => g.name === genreFilter)) {
          ids.add(item.id)
        }
      })
      setGenreFilteredIds(ids)
    })
  }, [genreFilter, sorted.map((i) => i.id).join(',')])

  const displayed = genreFilter && genreFilteredIds
    ? sorted.filter((i) => genreFilteredIds.has(i.id))
    : sorted

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
              {displayed.length}
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
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
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
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="8" />
              <polygon points="8.5,7.5 13.5,10 8.5,12.5 6,10" fill="currentColor" stroke="none" />
            </svg>
          </button>
          {/* Playlists */}
          <button
            onClick={() => router.push('/playlists')}
            title="Playlists"
            className="flex items-center justify-center w-[34px] h-[34px] border-none cursor-pointer transition-all duration-100"
            style={{ color: 'var(--muted)', background: 'transparent', borderRadius: 'var(--rsm)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="13" y2="10" />
              <line x1="3" y1="15" x2="10" y2="15" />
              <circle cx="16" cy="14" r="3" />
            </svg>
          </button>
          {/* Avatar */}
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center justify-center w-[30px] h-[30px] rounded-full border-none cursor-pointer ml-[6px] flex-shrink-0 text-[11px] font-bold"
            style={{ background: 'var(--accent-bg)', border: '1.5px solid var(--accent)', color: 'var(--accent2)' }}
          >
            {userInitial}
          </button>
        </nav>
      </header>

      {/* Import local data banner */}
      {importBanner && (
        <div
          className="mx-5 mb-3 px-4 py-3 rounded-[10px] flex items-center justify-between gap-3"
          style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent)' }}
        >
          <p className="text-[13px]" style={{ color: 'var(--fg2)' }}>
            <span className="font-semibold" style={{ color: 'var(--accent2)' }}>{importBanner.count} local items</span> found. Import to your account?
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={async () => {
                setImportBanner(null)
                await sync()
              }}
              className="px-3 py-1.5 rounded-[6px] text-[12px] font-semibold border-none cursor-pointer"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Import
            </button>
            <button
              onClick={() => setImportBanner(null)}
              className="px-3 py-1.5 rounded-[6px] text-[12px] font-medium border-none cursor-pointer"
              style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

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
                  borderColor: 'transparent',
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = 'var(--fg2)'; e.currentTarget.style.borderColor = 'var(--border)' } }}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'transparent' } }}
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
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg2)' }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--muted)' }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Sort button */}
          <button
            onClick={() => setSortIndex((i) => (i + 1) % SORT_OPTIONS.length)}
            className="flex items-center gap-[5px] whitespace-nowrap cursor-pointer transition-all duration-100"
            style={{
              padding: '5px 10px',
              borderRadius: 'var(--rsm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--muted)',
              fontSize: 12,
              fontWeight: 500,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg2)'; e.currentTarget.style.borderColor = 'var(--muted2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="10" y2="8" />
              <line x1="2" y1="12" x2="6" y2="12" />
            </svg>
            {SORT_OPTIONS[sortIndex].label}
          </button>

          {/* View toggle */}
          <div
            className="flex ml-auto"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--rsm)',
              padding: 2,
              gap: 1,
            }}
          >
            <button
              onClick={() => setView('list')}
              title="List view"
              className="flex items-center justify-center w-[26px] h-[26px] border-none cursor-pointer transition-all duration-100"
              style={{
                borderRadius: 'var(--rxs)',
                background: viewMode === 'list' ? 'var(--surface2)' : 'transparent',
                color: viewMode === 'list' ? 'var(--fg)' : 'var(--muted)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="2" y="3" width="12" height="3" rx="1" />
                <rect x="2" y="8" width="12" height="3" rx="1" />
                <rect x="2" y="13" width="8" height="3" rx="1" />
              </svg>
            </button>
            <button
              onClick={() => setView('grid')}
              title="Grid view"
              className="flex items-center justify-center w-[26px] h-[26px] border-none cursor-pointer transition-all duration-100"
              style={{
                borderRadius: 'var(--rxs)',
                background: viewMode === 'grid' ? 'var(--surface2)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--fg)' : 'var(--muted)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
            </button>
          </div>

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
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted2)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
            >
              {!syncing && (
                <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: 'var(--green)' }} />
              )}
              {syncLabel}
            </button>
          )}
        </div>

        {/* Genre filter chips */}
        {genreOptions.length > 0 && (
          <div
            className="flex gap-[4px] flex-wrap mt-[8px]"
          >
            <button
              onClick={() => setGenreFilter(null)}
              className="inline-flex items-center whitespace-nowrap border cursor-pointer transition-all duration-[100ms]"
              style={{
                padding: '3px 9px',
                borderRadius: 'var(--pill)',
                fontSize: 11,
                fontWeight: genreFilter === null ? 600 : 500,
                background: genreFilter === null ? 'var(--surface2)' : 'transparent',
                color: genreFilter === null ? 'var(--fg)' : 'var(--muted2)',
                borderColor: genreFilter === null ? 'var(--border)' : 'var(--border2)',
              }}
            >
              All genres
            </button>
            {genreOptions.map((g) => {
              const active = genreFilter === g
              return (
                <button
                  key={g}
                  onClick={() => setGenreFilter(active ? null : g)}
                  className="inline-flex items-center whitespace-nowrap border cursor-pointer transition-all duration-[100ms]"
                  style={{
                    padding: '3px 9px',
                    borderRadius: 'var(--pill)',
                    fontSize: 11,
                    fontWeight: active ? 600 : 400,
                    background: active ? 'var(--accent-bg)' : 'transparent',
                    color: active ? 'var(--accent2)' : 'var(--muted2)',
                    borderColor: active ? 'var(--accent)' : 'var(--border2)',
                  }}
                >
                  {g}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* List / Grid */}
      <div style={{ padding: '0 20px' }}>
        {allItems === undefined ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-center" style={{ padding: '64px 16px 48px' }}>
            <div
              className="flex items-center justify-center"
              style={{ width: 52, height: 52, borderRadius: 13, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted2)' }}
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
        ) : viewMode === 'list' ? (
          <div className="flex flex-col" style={{ gap: 8 }}>
            {displayed.map((item) => (
              <WatchlistItemCard
                key={item.id}
                item={item}
                onSelect={() => setPanel({ tmdbId: item.tmdbId, mediaType: item.mediaType as MediaType })}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 10,
            }}
          >
            {displayed.map((item) => (
              <GridItemCard
                key={item.id}
                item={item}
                onSelect={() => setPanel({ tmdbId: item.tmdbId, mediaType: item.mediaType as MediaType })}
              />
            ))}
          </div>
        )}
      </div>

      {panel && (
        <MediaPanel
          tmdbId={panel.tmdbId}
          mediaType={panel.mediaType}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  )
}
