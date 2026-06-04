'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { WatchlistItem, JellyfinProgress } from '@mywatch/core'
import { StatusBadge } from './StatusBadge'
import { ArrStatusBadge } from './ArrStatusBadge'
import { useMediaMeta } from '@/hooks/useMediaMeta'
import { usePlaylists, useAddToPlaylist, MAIN_LIST_UUID } from '@/hooks/usePlaylists'
import { useSettings, BADGE_ICON_SIZES } from '@/hooks/useSettings'
import { getTvProgress } from '@/lib/progress'
import { CardMenu } from './CardMenu'

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

// Progress bar with hover tooltip
function ProgressBar({ pct, color, tooltip }: { pct: number; color: string; tooltip?: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="absolute bottom-0 left-0 right-0"
      style={{ height: 5, background: 'rgba(0,0,0,.15)', cursor: 'default' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 300ms ease' }} />
      {hovered && tooltip && (
        <div
          className="absolute bottom-[8px] left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap pointer-events-none z-50"
          style={{ background: 'rgba(0,0,0,.75)', color: '#fff', backdropFilter: 'blur(4px)' }}
        >
          {tooltip}
        </div>
      )}
    </div>
  )
}

export function WatchlistItemCard({
  item,
  onSelect,
  jellyfinProgress,
  compact,
}: {
  item: WatchlistItem
  onSelect?: () => void
  jellyfinProgress?: JellyfinProgress
  compact?: boolean
}) {
  const { data: session } = useSession()
  const { settings } = useSettings()
  const baseCardMeta = settings.listCardMeta
  const cardMeta = { ...baseCardMeta, ...(item.displayOverrides ?? {}) }
  const size = BADGE_ICON_SIZES[settings.badgeIconSize] ?? BADGE_ICON_SIZES.md
  const meta = useMediaMeta(item.tmdbId, item.mediaType, settings.tmdbApiKey, settings.language)
  const router = useRouter()
  const playlists = usePlaylists()
  const addToPlaylist = useAddToPlaylist()
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Arr status moved to ArrStatusBadge component

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

  // Progress bar rendering (respects showProgress setting)
  const showBars = cardMeta.showProgress !== false || settings.alwaysShowProgressBars
  const forceBars = settings.alwaysShowProgressBars
  const progressBars = showBars && (forceBars || (jellyfinProgress && jellyfinProgress.jellyfinStatus !== 'planned')) ? (() => {
    const watched = (jellyfinProgress?.jellyfinStatus === 'watched') || item.status === 'watched'
    if (item.mediaType === 'movie') {
      const pct = watched ? 100 : (jellyfinProgress?.moviePercent ?? 0)
      return (
        <ProgressBar
          pct={pct}
          color={watched ? 'rgba(134,239,172,.85)' : 'rgba(251,191,36,.9)'}
          tooltip={watched ? 'Watched' : `${pct}%`}
        />
      )
    }
    if (watched) {
      return <ProgressBar pct={100} color="rgba(134,239,172,.85)" tooltip="Watched" />
    }
    const mockProg = { jellyfinStatus: 'watching', mediaType: 'tv', season: null, episode: null, watchedEpisodes: 0, totalEpisodes: 0, completedTicks: null, totalTicks: null, episodePercent: null, hasEpisodeBar: false } as any
    const tvProg = getTvProgress(jellyfinProgress ?? mockProg, meta)
    const { completedPct, episodePercent, hasEpisodeBar } = tvProg
    const hasBoth = hasEpisodeBar && completedPct > 0
    return (
      <>
        {completedPct > 0 && (
          <div className="absolute left-0 right-0" style={{ bottom: hasBoth ? 5 : 0, height: 5, background: 'rgba(0,0,0,.15)' }}>
            <div style={{ width: `${completedPct}%`, height: '100%', background: 'rgba(251,191,36,.9)' }} />
          </div>
        )}
        {hasEpisodeBar && (
          <ProgressBar
            pct={episodePercent}
            color="rgba(96,165,250,.9)"
            tooltip={`Episode ${episodePercent}%`}
          />
        )}
      </>
    )
  })() : null

  return (
    <div className="relative">
    <div
      onClick={() => onSelect ? onSelect() : router.push(`/media/${item.mediaType}/${item.tmdbId}`)}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
      className="relative overflow-hidden flex gap-3 rounded-[var(--r)] border cursor-pointer transition-all duration-[120ms]
        hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,.25)]"
      style={{
        padding: compact ? '10px 12px' : '14px 16px',
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
        className="flex-shrink-0 overflow-hidden rounded-[8px]"
        style={{
          width: compact ? 64 : 86,
          height: compact ? 96 : 129,
          background: 'var(--surface2)',
        }}
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
      
      <CardMenu item={item} globalSettings={baseCardMeta} />

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col overflow-visible" style={{ gap: compact ? 4 : 6, paddingTop: 1 }}>

        {/* Row 1: [Movie/TV] Title */}
        <div className="flex items-center gap-[6px] min-w-0">
          <span
            className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px] flex items-center justify-center"
            style={
              cardMeta.showBadgesAsIcons
                ? {
                    background: item.mediaType === 'movie' ? 'rgba(251,146,60,.13)' : 'rgba(168,85,247,.13)',
                    color: item.mediaType === 'movie' ? 'var(--orange)' : 'var(--purple)',
                    width: size.container,
                    height: size.container,
                    padding: 0
                  }
                : {
                    background: item.mediaType === 'movie' ? 'rgba(251,146,60,.13)' : 'rgba(168,85,247,.13)',
                    color: item.mediaType === 'movie' ? 'var(--orange)' : 'var(--purple)'
                  }
            }
            title={item.mediaType === 'movie' ? 'Movie' : 'TV'}
          >
            {cardMeta.showBadgesAsIcons ? (
              item.mediaType === 'movie' ? (
                <svg style={{ width: size.icon, height: size.icon, display: 'block' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
              ) : (
                <svg style={{ width: size.icon, height: size.icon, display: 'block' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
              )
            ) : (
              item.mediaType === 'movie' ? 'Movie' : 'TV'
            )}
          </span>
          <span
            className="text-[var(--text-15)] font-semibold tracking-[-0.018em] truncate leading-[1.25]"
            style={{ color: 'var(--fg)' }}
          >
            {meta?.title ?? `#${item.tmdbId}`}
          </span>
        </div>

        {/* Row 2: all meta in one line */}
        <div
          className="flex items-center gap-[5px] flex-wrap leading-none"
          style={{ color: 'var(--muted2)', fontSize: 'var(--text-11h)' }}
        >
          {!(jellyfinProgress && jellyfinProgress.jellyfinStatus !== 'planned') && (
            <StatusBadge status={item.status} asIcon={cardMeta.showBadgesAsIcons} />
          )}
          {cardMeta.showPlatform && jellyfinProgress && jellyfinProgress.jellyfinStatus !== 'planned' && (
            <span
              className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px] flex items-center justify-center"
              style={
                cardMeta.showBadgesAsIcons
                  ? { background: 'rgba(168,85,247,.15)', color: 'var(--purple)', width: size.container, height: size.container, padding: 0 }
                  : { background: 'rgba(168,85,247,.15)', color: 'var(--purple)' }
              }
              title="Jellyfin"
            >
              {cardMeta.showBadgesAsIcons ? (
                <svg style={{ width: size.icon, height: size.icon, display: 'block' }} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 .002C8.826.002-1.398 18.537.16 21.666c1.56 3.129 22.14 3.094 23.682 0C25.384 18.573 15.177 0 12 0zm7.76 18.949c-1.008 2.028-14.493 2.05-15.514 0C3.224 16.9 9.92 4.755 12.003 4.755c2.081 0 8.77 12.166 7.759 14.196zM12 9.198c-1.054 0-4.446 6.15-3.93 7.189.518 1.04 7.348 1.027 7.86 0 .511-1.027-2.874-7.19-3.93-7.19z"/></svg>
              ) : (
                'Jellyfin'
              )}
            </span>
          )}
          {cardMeta.showProgress && item.mediaType === 'movie' && jellyfinProgress?.jellyfinStatus === 'watching' && jellyfinProgress.moviePercent != null && (
            <span
              className="text-[var(--text-10h)] font-bold rounded-full px-[7px] py-[1.5px] border tabular-nums"
              style={{ color: 'var(--amber)', background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.2)' }}
            >
              {jellyfinProgress.moviePercent}%
            </span>
          )}
          {cardMeta.showProgress && item.mediaType === 'tv' && (() => {
            if (jellyfinProgress && (jellyfinProgress.season != null || jellyfinProgress.watchedEpisodes != null)) {
              const tvProg = getTvProgress(jellyfinProgress, meta)
              return (
                <div className="flex gap-[4px] items-center">
                  {jellyfinProgress.season != null && (
                    <span
                      className="text-[var(--text-10h)] font-medium rounded-full px-[7px] py-[1.5px] border tabular-nums"
                      style={{ color: 'var(--muted2)', background: 'var(--bg)', borderColor: 'var(--border2)' }}
                    >
                      S{jellyfinProgress.season}·E{jellyfinProgress.episode ?? '?'}
                    </span>
                  )}
                  {tvProg.totalEpisodes > 0 && (
                    <span
                      className="text-[var(--text-10h)] font-medium rounded-full px-[7px] py-[1.5px] border tabular-nums"
                      style={{ color: 'var(--muted)', background: 'var(--surface2)', borderColor: 'var(--border)' }}
                    >
                      {tvProg.watchedEpisodes}/{tvProg.totalEpisodes}
                    </span>
                  )}
                  {tvProg.hasEpisodeBar && (
                    <span
                      className="text-[var(--text-10h)] font-bold rounded-full px-[7px] py-[1.5px] border tabular-nums"
                      style={{ color: 'var(--amber)', background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.2)' }}
                    >
                      {tvProg.episodePercent}%
                    </span>
                  )}
                </div>
              )
            }
            if (item.progressSeason != null) {
              return (
                <span
                  className="text-[var(--text-10h)] font-medium rounded-full px-[7px] py-[1.5px] border tabular-nums"
                  style={{ color: 'var(--muted2)', background: 'var(--bg)', borderColor: 'var(--border2)' }}
                >
                  S{item.progressSeason}·E{item.progressEpisode ?? '?'}
                </span>
              )
            }
            return null
          })()}
          {year && <><span style={{ opacity: 0.35 }}>·</span><span>{year}</span></>}
          {upcoming && (
            <>
              <span style={{ opacity: 0.35 }}>·</span>
              <span
                className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
                style={{ background: 'rgba(251,191,36,.15)', color: 'var(--amber)' }}
              >
                Upcoming
              </span>
              {meta?.releaseDate && <span style={{ fontSize: 'var(--text-10h)' }}>{formatDate(meta.releaseDate)}</span>}
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
              className="text-[var(--text-10)] font-medium px-[6px] py-[1px] rounded-[4px] whitespace-nowrap"
              style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
            >
              {g.name}
            </span>
          ))}
          {cardMeta.showProviders && providers.map((p) =>
            p.logoPath ? (
              <img key={p.providerId} src={`${PROVIDER_IMG}${p.logoPath}`} alt={p.providerName} title={p.providerName} className="rounded-[3px]" style={{ width: 16, height: 16, objectFit: 'cover' }} />
            ) : (
              <span key={p.providerId} className="text-[var(--text-9)] font-medium px-[4px] py-[1px] rounded-[3px]" style={{ background: 'var(--surface2)', color: 'var(--muted2)' }}>{p.providerName}</span>
            )
          )}
        </div>

        {/* Overview optional */}
        {cardMeta.showOverview && meta?.overview && (
          <p
            className="text-[var(--text-11h)] leading-[1.5]"
            style={{ color: 'var(--muted2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {meta.overview}
          </p>
        )}

        {/* Arr status row */}
        {cardMeta.showAvailability && <ArrStatusBadge tmdbId={item.tmdbId} mediaType={item.mediaType} asIcon={cardMeta.showBadgesAsIcons} />}
      </div>

      {/* Rating column */}
      {item.rating != null && (
        <div className="flex-shrink-0 flex flex-col items-end pt-[2px]">
          <div
            className="text-[var(--text-13)] font-bold flex items-center gap-[2px] tracking-[-0.01em]"
            style={{ color: 'var(--amber)' }}
          >
            ★{item.rating}
          </div>
        </div>
      )}

      {/* Progress bars */}
      {progressBars}
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
          className="px-3 py-1.5 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase"
          style={{ color: 'var(--muted2)' }}
        >
          Add to Playlist
        </div>
        {(playlists ?? []).filter((p) => p.type === 'manual').length === 0 ? (
          <div className="px-3 py-1.5 text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>
            No manual playlists yet
          </div>
        ) : (
          (playlists ?? [])
            .filter((p) => p.type === 'manual')
            .map((p) => {
              const isMain = p.id === MAIN_LIST_UUID
              return (
                <button
                  key={p.id}
                  onClick={async (e) => {
                    e.stopPropagation()
                    await addToPlaylist(p.id, item.tmdbId, item.mediaType as 'movie' | 'tv')
                    setCtxMenu(null)
                  }}
                  className="w-full text-left px-3 py-1.5 text-[var(--text-12)] transition-all duration-100 cursor-pointer border-none flex items-center justify-between"
                  style={{
                    background: 'transparent',
                    color: isMain ? 'var(--accent2)' : 'var(--fg2)',
                    fontWeight: isMain ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span>{p.name}</span>
                  {isMain && (
                    <span
                      className="text-[var(--text-9)] font-extrabold uppercase px-1.5 py-0.5 rounded ml-2"
                      style={{ background: 'var(--accent-bg)', color: 'var(--accent2)' }}
                    >
                      Main
                    </span>
                  )}
                </button>
              )
            })
        )}
      </div>
    )}
    </div>
  )
}
