'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { WatchlistItem } from '@mywatch/core'
import { StatusBadge } from './StatusBadge'
import { useMediaMeta } from '@/hooks/useMediaMeta'
import { usePlaylists, useAddToPlaylist } from '@/hooks/usePlaylists'
import { useSettings } from '@/hooks/useSettings'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w92'
const PROVIDER_IMG = 'https://image.tmdb.org/t/p/w45'

function isUpcoming(releaseDate: string | null): boolean {
  if (!releaseDate) return false
  return new Date(releaseDate) > new Date()
}

function formatDate(releaseDate: string): string {
  return new Date(releaseDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function WatchlistItemCard({ item }: { item: WatchlistItem }) {
  const { settings } = useSettings()
  const meta = useMediaMeta(item.tmdbId, item.mediaType, settings.tmdbApiKey, settings.language)
  const router = useRouter()
  const playlists = usePlaylists()
  const addToPlaylist = useAddToPlaylist()
  const { cardMeta } = settings
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ctxMenu) return
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setCtxMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [ctxMenu])

  const year = meta?.releaseDate?.slice(0, 4) ?? null
  const upcoming = isUpcoming(meta?.releaseDate ?? null)
  const genres = meta?.genres ?? []
  const providers = (meta?.watchProviders ?? []).slice(0, 3)

  return (
    <div className="relative">
    <div
      onClick={() => router.push(`/media/${item.mediaType}/${item.tmdbId}`)}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
      className="flex gap-3 rounded-[var(--r)] border cursor-pointer transition-all duration-[120ms]
        hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,.25)]"
      style={{
        padding: '11px 12px',
        background: 'var(--surface)',
        borderColor: 'var(--border2)',
        alignItems: 'flex-start',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.background = 'var(--surface2)'
        el.style.borderColor = 'var(--border)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.background = 'var(--surface)'
        el.style.borderColor = 'var(--border2)'
      }}
    >
      {/* Poster */}
      <div
        className="flex-shrink-0 w-[52px] h-[78px] rounded-[6px] overflow-hidden"
        style={{ background: 'var(--surface2)' }}
      >
        {meta?.posterPath ? (
          <img
            src={`${TMDB_IMG}${meta.posterPath}`}
            alt={meta.title}
            className="w-full h-full object-cover block"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, var(--surface2), var(--bg))` }}
          />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col gap-[3px] pt-[1px] overflow-visible">
        <div
          className="text-[14px] font-semibold tracking-[-0.015em] truncate leading-[1.25]"
          style={{ color: 'var(--fg)' }}
        >
          {meta?.title ?? `#${item.tmdbId}`}
        </div>

        {/* Year + type badge + upcoming + TMDB rating + runtime */}
        <div
          className="flex items-center gap-[5px] flex-wrap text-[11.5px] leading-none mb-[1px]"
          style={{ color: 'var(--muted2)' }}
        >
          {year && <span>{year}</span>}
          {year && <span style={{ opacity: 0.4 }}>·</span>}
          <span
            className="text-[9.5px] font-extrabold tracking-[0.06em] uppercase leading-[1.3] px-[5px] py-[1.5px] rounded-[3px]"
            style={
              item.mediaType === 'movie'
                ? { background: 'rgba(251,146,60,.13)', color: 'var(--orange)' }
                : { background: 'rgba(168,85,247,.13)', color: 'var(--purple)' }
            }
          >
            {item.mediaType === 'movie' ? 'Movie' : 'TV'}
          </span>
          {upcoming && (
            <span
              className="text-[9.5px] font-extrabold tracking-[0.06em] uppercase leading-[1.3] px-[5px] py-[1.5px] rounded-[3px]"
              style={{ background: 'rgba(251,191,36,.15)', color: 'var(--amber)' }}
            >
              Upcoming
            </span>
          )}
          {cardMeta.showTmdbRating && meta?.voteAverage != null && meta.voteAverage > 0 && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ color: 'var(--amber)' }}>★ {meta.voteAverage.toFixed(1)}</span>
            </>
          )}
          {cardMeta.showRuntime && meta?.runtime != null && meta.runtime > 0 && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{formatRuntime(meta.runtime)}</span>
            </>
          )}
        </div>

        {/* Release date (full) when upcoming */}
        {upcoming && meta?.releaseDate && (
          <div className="text-[10.5px] leading-none mb-[1px]" style={{ color: 'var(--muted2)' }}>
            {formatDate(meta.releaseDate)}
          </div>
        )}

        {/* Status + progress */}
        <div className="flex items-center gap-[5px] flex-wrap mt-[1px]">
          <StatusBadge status={item.status} />
          {item.mediaType === 'tv' && item.progressSeason != null && (
            <span
              className="text-[11px] font-medium rounded-full px-[7px] py-[1.5px] border leading-[1.4] tabular-nums"
              style={{ color: 'var(--muted2)', background: 'var(--bg)', borderColor: 'var(--border2)' }}
            >
              S{item.progressSeason}·E{item.progressEpisode ?? '?'}
            </span>
          )}
        </div>

        {/* Genres */}
        {cardMeta.showGenres && genres.length > 0 && (
          <div className="flex items-start gap-[4px] flex-wrap mt-[2px]">
            {genres.map((g) => (
              <span
                key={g.id}
                className="text-[10px] font-medium px-[6px] py-[1px] rounded-[4px] leading-[1.4] whitespace-nowrap"
                style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        {/* Overview */}
        {cardMeta.showOverview && meta?.overview && (
          <p
            className="text-[11px] leading-[1.45] mt-[3px]"
            style={{ color: 'var(--muted2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {meta.overview}
          </p>
        )}

        {/* Streaming providers */}
        {cardMeta.showProviders && providers.length > 0 && (
          <div className="flex items-center gap-[4px] mt-[3px]">
            {providers.map((p) => (
              p.logoPath ? (
                <img
                  key={p.providerId}
                  src={`${PROVIDER_IMG}${p.logoPath}`}
                  alt={p.providerName}
                  title={p.providerName}
                  className="rounded-[4px]"
                  style={{ width: 18, height: 18, objectFit: 'cover' }}
                />
              ) : (
                <span
                  key={p.providerId}
                  className="text-[9px] font-medium px-[4px] py-[1px] rounded-[3px]"
                  style={{ background: 'var(--surface2)', color: 'var(--muted2)' }}
                >
                  {p.providerName}
                </span>
              )
            ))}
          </div>
        )}
      </div>

      {/* Rating column */}
      {item.rating != null && (
        <div className="flex-shrink-0 flex flex-col items-end pt-[2px]">
          <div
            className="text-[13px] font-bold flex items-center gap-[2px] tracking-[-0.01em]"
            style={{ color: 'var(--amber)' }}
          >
            ★{item.rating}
          </div>
        </div>
      )}
    </div>

    {/* Context menu */}
    {ctxMenu && (
      <div
        ref={menuRef}
        className="fixed z-50 rounded-[8px] py-1 min-w-[160px]"
        style={{
          top: ctxMenu.y,
          left: ctxMenu.x,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}
      >
        <div
          className="px-3 py-1.5 text-[10px] font-bold tracking-[0.08em] uppercase"
          style={{ color: 'var(--muted2)' }}
        >
          Add to Playlist
        </div>
        {(playlists ?? []).filter((p) => p.type === 'manual').length === 0 ? (
          <div className="px-3 py-1.5 text-[12px]" style={{ color: 'var(--muted2)' }}>
            No manual playlists yet
          </div>
        ) : (
          (playlists ?? [])
            .filter((p) => p.type === 'manual')
            .map((p) => (
              <button
                key={p.id}
                onClick={async (e) => {
                  e.stopPropagation()
                  await addToPlaylist(p.id, item.tmdbId, item.mediaType as 'movie' | 'tv')
                  setCtxMenu(null)
                }}
                className="w-full text-left px-3 py-1.5 text-[12px] transition-all duration-100 cursor-pointer border-none"
                style={{ background: 'transparent', color: 'var(--fg2)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                {p.name}
              </button>
            ))
        )}
      </div>
    )}
    </div>
  )
}
