'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import type { WatchStatus, MediaType } from '@mywatch/core'
import { useWatchlistItems } from '@/hooks/useWatchlist'
import { useSync } from '@/hooks/useSync'
import { useSettings } from '@/hooks/useSettings'
import type { GridColumns } from '@/hooks/useSettings'
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
  { value: 'type', label: 'Movie / TV' },
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
  const [sortOpen, setSortOpen] = useState(false)
  const [genreFilter, setGenreFilter] = useState<Set<string>>(new Set())
  const [genreOpen, setGenreOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [panel, setPanel] = useState<{ tmdbId: number; mediaType: MediaType } | null>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const genreRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function close(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    if (sortOpen) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [sortOpen])

  useEffect(() => {
    function close(e: MouseEvent) {
      if (genreRef.current && !genreRef.current.contains(e.target as Node)) setGenreOpen(false)
    }
    if (genreOpen) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [genreOpen])

  function setView(v: ViewMode) {
    setViewMode(v)
    localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  const { settings, update: updateSettings } = useSettings()
  const allItems = useWatchlistItems()
  const { syncing, lastSyncedAt, error: syncError, sync } = useSync()
  const pendingCount = useLiveQuery(() => db.pendingPushes.count()) ?? 0

  const gridCols = settings.gridColumns
  const gridTemplateColumns = gridCols === 'auto'
    ? 'repeat(auto-fill, minmax(150px, 1fr))'
    : `repeat(${gridCols}, 1fr)`

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
    if (sortValue === 'type') {
      const order = { movie: 0, tv: 1 }
      const diff = (order[a.mediaType as keyof typeof order] ?? 0) - (order[b.mediaType as keyof typeof order] ?? 0)
      if (diff !== 0) return diff
      return b.updatedAt.localeCompare(a.updatedAt)
    }
    return b.updatedAt.localeCompare(a.updatedAt)
  })

  // Genre filter applied after sort (requires media cache lookup — done via a separate memo)
  // We filter by genre using the genreFilter state; the actual cache lookup happens in each card.
  // For page-level genre filtering we query the cache inline here.
  const [genreFilteredIds, setGenreFilteredIds] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (genreFilter.size === 0) {
      setGenreFilteredIds(null)
      return
    }
    const keys = sorted.map((i) => [i.tmdbId, i.mediaType] as [number, string])
    db.mediaCache.bulkGet(keys).then((entries) => {
      const ids = new Set<string>()
      sorted.forEach((item, idx) => {
        const entry = entries[idx]
        if (entry?.genres?.some((g) => genreFilter.has(g.name))) {
          ids.add(item.id)
        }
      })
      setGenreFilteredIds(ids)
    })
  }, [[...genreFilter].join(','), sorted.map((i) => i.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = genreFilter.size > 0 && genreFilteredIds
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
    : syncError
    ? 'Failed'
    : pendingCount > 0
    ? `${pendingCount} pending`
    : lastSyncedAt
    ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Sync'

  const syncDotColor = syncError
    ? 'var(--red)'
    : pendingCount > 0
    ? 'var(--amber)'
    : lastSyncedAt
    ? 'var(--green)'
    : 'var(--muted2)'

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

          {/* Sort dropdown */}
          <div ref={sortRef} className="relative">
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="flex items-center gap-[5px] whitespace-nowrap cursor-pointer transition-all duration-100"
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--rsm)',
                border: '1px solid var(--border)',
                background: sortOpen ? 'var(--surface2)' : 'var(--surface)',
                color: 'var(--muted)',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="2" y1="4" x2="14" y2="4" />
                <line x1="2" y1="8" x2="10" y2="8" />
                <line x1="2" y1="12" x2="6" y2="12" />
              </svg>
              {SORT_OPTIONS[sortIndex].label}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ opacity: 0.5, transform: sortOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
                <polyline points="2 3.5 5 6.5 8 3.5" />
              </svg>
            </button>
            {sortOpen && (
              <div
                className="absolute top-full left-0 mt-[4px] z-30 rounded-[8px] py-1 min-w-[160px]"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,.35)' }}
              >
                {SORT_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortIndex(i); setSortOpen(false) }}
                    className="w-full text-left px-3 py-[8px] text-[12px] cursor-pointer border-none transition-all duration-100"
                    style={{
                      background: sortIndex === i ? 'var(--accent-bg)' : 'transparent',
                      color: sortIndex === i ? 'var(--accent2)' : 'var(--fg2)',
                      fontWeight: sortIndex === i ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (sortIndex !== i) e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={(e) => { if (sortIndex !== i) e.currentTarget.style.background = 'transparent' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Genre dropdown */}
          {genreOptions.length > 0 && (
            <div ref={genreRef} className="relative">
              <button
                onClick={() => setGenreOpen((v) => !v)}
                className="flex items-center gap-[5px] whitespace-nowrap cursor-pointer transition-all duration-100"
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--rsm)',
                  border: `1px solid ${genreFilter.size > 0 ? 'var(--accent)' : 'var(--border)'}`,
                  background: genreFilter.size > 0 ? 'var(--accent-bg)' : genreOpen ? 'var(--surface2)' : 'var(--surface)',
                  color: genreFilter.size > 0 ? 'var(--accent2)' : 'var(--muted)',
                  fontSize: 12,
                  fontWeight: genreFilter.size > 0 ? 600 : 500,
                }}
              >
                Genre{genreFilter.size > 0 ? ` (${genreFilter.size})` : ''}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ opacity: 0.5, transform: genreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
                  <polyline points="2 3.5 5 6.5 8 3.5" />
                </svg>
              </button>
              {genreOpen && (
                <div
                  className="absolute top-full left-0 mt-[4px] z-30 rounded-[8px] min-w-[200px]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,.35)' }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 py-[8px]" style={{ borderBottom: '1px solid var(--border2)' }}>
                    <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                      Filter by Genre
                    </span>
                    <div className="flex items-center gap-[6px]">
                      {genreFilter.size > 0 && (
                        <button
                          onClick={() => setGenreFilter(new Set())}
                          className="text-[10px] cursor-pointer border-none transition-all duration-100"
                          style={{ background: 'transparent', color: 'var(--accent2)', fontWeight: 500 }}
                        >
                          Clear
                        </button>
                      )}
                      <button
                        onClick={() => setGenreOpen(false)}
                        className="flex items-center justify-center w-[18px] h-[18px] rounded-full cursor-pointer border-none transition-all duration-100"
                        style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)' }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                          <line x1="1" y1="1" x2="7" y2="7" /><line x1="7" y1="1" x2="1" y2="7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* List */}
                  <div className="py-1 max-h-[240px] overflow-y-auto">
                    {genreOptions.map((g) => {
                      const checked = genreFilter.has(g)
                      return (
                        <button
                          key={g}
                          onClick={() => {
                            const next = new Set(genreFilter)
                            if (checked) next.delete(g); else next.add(g)
                            setGenreFilter(next)
                          }}
                          className="w-full flex items-center gap-[8px] px-3 py-[7px] text-[12px] cursor-pointer border-none transition-all duration-100 text-left"
                          style={{ background: 'transparent', color: checked ? 'var(--fg)' : 'var(--fg2)', fontWeight: checked ? 500 : 400 }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <span
                            className="flex-shrink-0 flex items-center justify-center rounded-[3px]"
                            style={{ width: 14, height: 14, border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, background: checked ? 'var(--accent)' : 'transparent' }}
                          >
                            {checked && (
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="1.5 4 3.5 6 6.5 2" />
                              </svg>
                            )}
                          </span>
                          {g}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Grid column picker — only in grid mode */}
          {viewMode === 'grid' && (
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
              {(['auto', 2, 3, 4] as GridColumns[]).map((c) => {
                const active = gridCols === c
                return (
                  <button
                    key={c}
                    onClick={() => updateSettings({ gridColumns: c })}
                    className="whitespace-nowrap border-none cursor-pointer transition-all duration-100"
                    style={{
                      padding: '3px 7px',
                      borderRadius: 'var(--rxs)',
                      fontSize: 11,
                      fontWeight: active ? 600 : 400,
                      background: active ? 'var(--surface2)' : 'transparent',
                      color: active ? 'var(--fg)' : 'var(--muted)',
                    }}
                  >
                    {c === 'auto' ? '◻' : c}
                  </button>
                )
              })}
            </div>
          )}

          {/* Sync */}
          {session && (
            <button
              onClick={() => sync()}
              disabled={syncing}
              title={syncError ?? undefined}
              className="inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer transition-all duration-150 disabled:opacity-60"
              style={{
                padding: '5px 9px',
                borderRadius: 'var(--rsm)',
                border: `1px solid ${pendingCount > 0 ? 'rgba(251,191,36,.35)' : syncError ? 'rgba(248,113,113,.35)' : 'transparent'}`,
                background: pendingCount > 0 ? 'rgba(251,191,36,.07)' : syncError ? 'rgba(248,113,113,.07)' : 'transparent',
                color: pendingCount > 0 ? 'var(--amber)' : syncError ? 'var(--red)' : 'var(--muted2)',
                fontSize: 11,
                fontWeight: pendingCount > 0 ? 600 : 400,
              }}
              onMouseEnter={(e) => { if (!pendingCount && !syncError) { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border2)' } }}
              onMouseLeave={(e) => { if (!pendingCount && !syncError) { e.currentTarget.style.color = 'var(--muted2)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
            >
              {syncing ? (
                <svg className="animate-spin" width="7" height="7" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                  <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" />
                </svg>
              ) : (
                <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: syncDotColor }} />
              )}
              {syncLabel}
              {pendingCount > 0 && !syncing && (
                <span
                  className="rounded-full tabular-nums font-bold"
                  style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(251,191,36,.25)', color: 'var(--amber)' }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          )}
        </div>

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
              gridTemplateColumns,
              gap: 12,
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
