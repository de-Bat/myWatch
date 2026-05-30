'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { WatchlistItem } from '@mywatch/core'
import type { JellyfinProgress } from '@/lib/jellyfin'
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

export function WatchlistItemCard({
  item,
  onSelect,
  jellyfinProgress,
}: {
  item: WatchlistItem
  onSelect?: () => void
  jellyfinProgress?: JellyfinProgress
}) {
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
      onClick={() => onSelect ? onSelect() : router.push(`/media/${item.mediaType}/${item.tmdbId}`)}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
      className="flex gap-3 rounded-[var(--r)] border cursor-pointer transition-all duration-[120ms]
        hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,.25)]"
      style={{
        padding: '14px 16px',
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
        className="flex-shrink-0 w-[86px] h-[129px] rounded-[8px] overflow-hidden"
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
      <div className="flex-1 min-w-0 flex flex-col gap-[6px] pt-[1px] overflow-visible">

        {/* Row 1: [Movie/TV] Title */}
        <div className="flex items-center gap-[6px] min-w-0">
          <span
            className="flex-shrink-0 text-[9.5px] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
            style={
              item.mediaType === 'movie'
                ? { background: 'rgba(251,146,60,.13)', color: 'var(--orange)' }
                : { background: 'rgba(168,85,247,.13)', color: 'var(--purple)' }
            }
          >
            {item.mediaType === 'movie' ? 'Movie' : 'TV'}
          </span>
          <span
            className="text-[15px] font-semibold tracking-[-0.018em] truncate leading-[1.25]"
            style={{ color: 'var(--fg)' }}
          >
            {meta?.title ?? `#${item.tmdbId}`}
          </span>
        </div>

        {/* Row 2: all meta in one line */}
        <div
          className="flex items-center gap-[5px] flex-wrap leading-none"
          style={{ color: 'var(--muted2)', fontSize: 11.5 }}
        >
          <StatusBadge status={item.status} />
          {jellyfinProgress && (
            <>
              <span
                className="text-[9.5px] font-extrabold tracking-[0.04em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
                style={{ background: 'rgba(251,191,36,.15)', color: 'var(--amber)' }}
              >
                J
              </span>
              {jellyfinProgress.jellyfinStatus === 'watching' && (
                <span
                  className="text-[10.5px] font-medium rounded-full px-[7px] py-[1.5px] border tabular-nums"
                  style={{ color: 'var(--amber)', background: 'rgba(251,191,36,.07)', borderColor: 'rgba(251,191,36,.25)' }}
                >
                  {jellyfinProgress.mediaType === 'movie'
                    ? `${jellyfinProgress.moviePercent ?? 0}%`
                    : jellyfinProgress.season != null
                    ? `S${jellyfinProgress.season}·E${jellyfinProgress.episode ?? '?'}${jellyfinProgress.episodePercent != null ? ` · ${jellyfinProgress.episodePercent}%` : ''}`
                    : null}
                </span>
              )}
              {jellyfinProgress.jellyfinStatus === 'watched' && item.status === 'planned' && (
                <span
                  className="text-[10px]"
                  style={{ color: 'var(--muted2)', fontStyle: 'italic' }}
                >
                  seen on Jellyfin
                </span>
              )}
            </>
          )}
          {item.mediaType === 'tv' && item.progressSeason != null && (
            <span
              className="text-[10.5px] font-medium rounded-full px-[7px] py-[1.5px] border tabular-nums"
              style={{ color: 'var(--muted2)', background: 'var(--bg)', borderColor: 'var(--border2)' }}
            >
              S{item.progressSeason}·E{item.progressEpisode ?? '?'}
            </span>
          )}
          {year && <><span style={{ opacity: 0.35 }}>·</span><span>{year}</span></>}
          {upcoming && (
            <>
              <span style={{ opacity: 0.35 }}>·</span>
              <span
                className="text-[9.5px] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
                style={{ background: 'rgba(251,191,36,.15)', color: 'var(--amber)' }}
              >
                Upcoming
              </span>
              {meta?.releaseDate && <span style={{ fontSize: 10.5 }}>{formatDate(meta.releaseDate)}</span>}
            </>
          )}
          {cardMeta.showTmdbRating && meta?.voteAverage != null && meta.voteAverage > 0 && (
            <><span style={{ opacity: 0.35 }}>·</span><span style={{ color: 'var(--amber)' }}>★ {meta.voteAverage.toFixed(1)}</span></>
          )}
          {cardMeta.showRuntime && meta?.runtime != null && meta.runtime > 0 && (
            <><span style={{ opacity: 0.35 }}>·</span><span>{formatRuntime(meta.runtime)}</span></>
          )}
          {cardMeta.showGenres && genres.slice(0, 3).map((g) => (
            <span
              key={g.id}
              className="text-[10px] font-medium px-[6px] py-[1px] rounded-[4px] whitespace-nowrap"
              style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
            >
              {g.name}
            </span>
          ))}
          {cardMeta.showProviders && providers.map((p) =>
            p.logoPath ? (
              <img key={p.providerId} src={`${PROVIDER_IMG}${p.logoPath}`} alt={p.providerName} title={p.providerName} className="rounded-[3px]" style={{ width: 16, height: 16, objectFit: 'cover' }} />
            ) : (
              <span key={p.providerId} className="text-[9px] font-medium px-[4px] py-[1px] rounded-[3px]" style={{ background: 'var(--surface2)', color: 'var(--muted2)' }}>{p.providerName}</span>
            )
          )}
        </div>

        {/* Overview optional */}
        {cardMeta.showOverview && meta?.overview && (
          <p
            className="text-[11.5px] leading-[1.5]"
            style={{ color: 'var(--muted2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {meta.overview}
          </p>
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
