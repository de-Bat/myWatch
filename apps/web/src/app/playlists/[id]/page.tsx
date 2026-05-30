'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePlaylist, usePlaylistItems, useSmartPlaylistItems, useDeletePlaylist, useAddToPlaylist, useRemoveFromPlaylist, useReorderPlaylistItem } from '@/hooks/usePlaylists'
import { WatchlistItemCard } from '@/components/WatchlistItemCard'
import { GridItemCard } from '@/components/GridItemCard'
import { CreatePlaylistModal } from '@/components/CreatePlaylistModal'
import type { WatchStatus, MediaType } from '@mywatch/core'

type ViewMode = 'list' | 'grid'

const STATUS_COLORS: Record<string, string> = {
  planned: 'var(--blue)',
  in_progress: 'var(--amber)',
  watched: 'var(--green)',
  quit: 'var(--red)',
}

export default function PlaylistDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const playlist = usePlaylist(id)
  const manualItems = usePlaylistItems(id)
  const smartItems = useSmartPlaylistItems(playlist?.type === 'smart' ? (playlist.smartRules ?? null) : null)
  const deletePlaylist = useDeletePlaylist()
  const removeFromPlaylist = useRemoveFromPlaylist()
  const reorder = useReorderPlaylistItem()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showEdit, setShowEdit] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  if (!playlist) {
    return (
      <div className="subpage-root">
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Playlist not found.</p>
      </div>
    )
  }

  async function handleDelete() {
    if (!confirm(`Delete "${playlist!.name}"?`)) return
    await deletePlaylist(id)
    router.push('/playlists')
  }

  const isSmart = playlist.type === 'smart'
  const rules = playlist.smartRules

  // Build display items
  const watchlistItems = isSmart
    ? (smartItems ?? []).map((wi) => ({ watchlistItem: wi, playlistItem: null }))
    : (manualItems ?? []).map(({ watchlistItem, playlistItem }) => ({ watchlistItem, playlistItem }))

  const resolvedItems = watchlistItems.filter((x) => x.watchlistItem != null)

  return (
    <div className="page-root">
      {/* Header */}
      <header
        className="flex items-center justify-between gap-3 page-header page-sticky-shell"
      >
        <div className="flex items-center gap-[10px] min-w-0">
          <button
            onClick={() => router.push('/playlists')}
            className="flex-shrink-0"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="10 4 6 8 10 12" />
            </svg>
          </button>
          <h1
            className="flex items-center gap-[7px] min-w-0"
            style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--fg)' }}
          >
            <span className="truncate">{playlist.name}</span>
            <span
              className="text-[9.5px] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px] flex-shrink-0"
              style={
                isSmart
                  ? { background: 'rgba(96,165,250,.13)', color: 'var(--blue)' }
                  : { background: 'rgba(99,102,241,.13)', color: 'var(--accent2)' }
              }
            >
              {isSmart ? 'Smart' : 'Manual'}
            </span>
            <span
              className="text-[11px] font-semibold tabular-nums flex-shrink-0"
              style={{ color: 'var(--muted2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--pill)', padding: '1px 7px' }}
            >
              {resolvedItems.length}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-[2px] flex-shrink-0">
          {/* View toggle */}
          <div className="flex" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className="flex items-center justify-center w-[26px] h-[26px] border-none cursor-pointer transition-all duration-100"
              style={{ borderRadius: 'var(--rxs)', background: viewMode === 'list' ? 'var(--surface2)' : 'transparent', color: viewMode === 'list' ? 'var(--fg)' : 'var(--muted)' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="12" height="3" rx="1" /><rect x="2" y="8" width="12" height="3" rx="1" /><rect x="2" y="13" width="8" height="3" rx="1" /></svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className="flex items-center justify-center w-[26px] h-[26px] border-none cursor-pointer transition-all duration-100"
              style={{ borderRadius: 'var(--rxs)', background: viewMode === 'grid' ? 'var(--surface2)' : 'transparent', color: viewMode === 'grid' ? 'var(--fg)' : 'var(--muted)' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
            </button>
          </div>
          {/* Delete */}
          <button
            onClick={handleDelete}
            title="Delete playlist"
            className="flex items-center justify-center w-[34px] h-[34px] border-none cursor-pointer transition-all duration-100 ml-1"
            style={{ color: 'var(--muted)', background: 'transparent', borderRadius: 'var(--rsm)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'rgba(248,113,113,.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 5 13 5" /><path d="M5 5V3h6v2" /><path d="M4 5l1 9h6l1-9" />
            </svg>
          </button>
        </div>
      </header>

      {/* Smart rules summary */}
      {isSmart && rules && (
        <div
          className="mb-3 px-3 py-2 rounded-[8px] flex flex-wrap gap-[5px] items-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border2)', marginLeft: 'max(20px, env(safe-area-inset-left))', marginRight: 'max(20px, env(safe-area-inset-right))' }}
        >
          <span className="text-[10px] font-bold tracking-[0.06em] uppercase" style={{ color: 'var(--muted2)', marginRight: 2 }}>Rules:</span>
          {rules.statuses?.map((s) => (
            <span key={s} className="text-[10px] font-medium px-[6px] py-[2px] rounded-full" style={{ background: 'rgba(0,0,0,.2)', color: STATUS_COLORS[s] ?? 'var(--muted)' }}>
              {s.replace('_', ' ')}
            </span>
          ))}
          {rules.mediaTypes?.map((t) => (
            <span key={t} className="text-[10px] font-medium px-[6px] py-[2px] rounded-full"
              style={{ background: t === 'movie' ? 'rgba(251,146,60,.13)' : 'rgba(168,85,247,.13)', color: t === 'movie' ? 'var(--orange)' : 'var(--purple)' }}>
              {t === 'movie' ? 'Movies' : 'TV'}
            </span>
          ))}
          {rules.minRating != null && (
            <span className="text-[10px] font-medium px-[6px] py-[2px] rounded-full" style={{ background: 'rgba(251,191,36,.13)', color: 'var(--amber)' }}>
              ★{rules.minRating}+
            </span>
          )}
        </div>
      )}

      {/* Items */}
      <div className="content-area">
        {resolvedItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-center" style={{ padding: '64px 16px 48px' }}>
            <p className="font-semibold" style={{ fontSize: 15, color: 'var(--fg2)', letterSpacing: '-0.02em' }}>
              {isSmart ? 'No items match these rules' : 'Playlist is empty'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted2)', maxWidth: 240, lineHeight: 1.5, marginTop: -4 }}>
              {isSmart
                ? 'Add items to your watchlist that match the rules above'
                : 'Right-click any item in My List to add it here'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="flex flex-col" style={{ gap: 5 }}>
            {resolvedItems.map(({ watchlistItem, playlistItem }) => {
              if (!watchlistItem) return null
              return (
                <div
                  key={watchlistItem.id}
                  className="relative group"
                  draggable={!isSmart}
                  onDragStart={() => setDragId(playlistItem?.id ?? null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async () => {
                    if (!dragId || isSmart || !playlistItem) return
                    const newIdx = resolvedItems.findIndex((x) => x.playlistItem?.id === playlistItem.id)
                    if (newIdx >= 0) await reorder(id, dragId, newIdx)
                    setDragId(null)
                  }}
                >
                  {!isSmart && (
                    <div
                      className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-[28px] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab z-10"
                      style={{ color: 'var(--muted2)' }}
                    >
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                        <circle cx="3" cy="3" r="1.5" fill="currentColor" />
                        <circle cx="7" cy="3" r="1.5" fill="currentColor" />
                        <circle cx="3" cy="8" r="1.5" fill="currentColor" />
                        <circle cx="7" cy="8" r="1.5" fill="currentColor" />
                        <circle cx="3" cy="13" r="1.5" fill="currentColor" />
                        <circle cx="7" cy="13" r="1.5" fill="currentColor" />
                      </svg>
                    </div>
                  )}
                  <div style={{ marginLeft: !isSmart ? 22 : 0 }}>
                    <WatchlistItemCard item={watchlistItem} />
                  </div>
                  {!isSmart && playlistItem && (
                    <button
                      onClick={() => removeFromPlaylist(id, watchlistItem.tmdbId, watchlistItem.mediaType as 'movie' | 'tv')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-[22px] h-[22px] flex items-center justify-center rounded-full z-10"
                      style={{ background: 'rgba(248,113,113,.15)', color: 'var(--red)', border: 'none', cursor: 'pointer' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
            {resolvedItems.map(({ watchlistItem }) => {
              if (!watchlistItem) return null
              return <GridItemCard key={watchlistItem.id} item={watchlistItem} />
            })}
          </div>
        )}
      </div>

      {showEdit && <CreatePlaylistModal onClose={() => setShowEdit(false)} />}
    </div>
  )
}
