'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { WatchlistItem, JellyfinProgress } from '@mywatch/core'
import { StatusBadge } from './StatusBadge'
import { useMediaMeta } from '@/hooks/useMediaMeta'
import { usePlaylists, useAddToPlaylist, MAIN_LIST_UUID } from '@/hooks/usePlaylists'
import { useSettings } from '@/hooks/useSettings'
import { getTvProgress } from '@/lib/progress'

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
}: {
  item: WatchlistItem
  onSelect?: () => void
  jellyfinProgress?: JellyfinProgress
}) {
  const { data: session } = useSession()
  const { settings } = useSettings()
  const meta = useMediaMeta(item.tmdbId, item.mediaType, settings.tmdbApiKey, settings.language)
  const router = useRouter()
  const playlists = usePlaylists()
  const addToPlaylist = useAddToPlaylist()
  const { cardMeta } = settings
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Arr status (Radarr/Sonarr availability)
  const [arrStatus, setArrStatus] = useState<{
    monitored: boolean
    hasFile: boolean
    isDownloading: boolean
    downloadPercent: number | null
  } | null>(null)
  const [requestingDownload, setRequestingDownload] = useState(false)
  const [requestMsg, setRequestMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (!session?.apiToken) return
    let active = true
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    fetch(`${apiBase}/api/user/arr/status?tmdbId=${item.tmdbId}&mediaType=${item.mediaType}`, {
      headers: { Authorization: `Bearer ${session.apiToken}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active && data) setArrStatus(data) })
      .catch(() => {})
    return () => { active = false }
  }, [item.tmdbId, item.mediaType, session?.apiToken])

  async function handleRequestDownload(e: React.MouseEvent) {
    e.stopPropagation()
    if (!session?.apiToken || requestingDownload) return
    setRequestingDownload(true)
    setRequestMsg(null)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiBase}/api/user/arr/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.apiToken}` },
        body: JSON.stringify({ tmdbId: item.tmdbId, mediaType: item.mediaType }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRequestMsg({ type: 'ok', text: data.message ?? 'Requested!' })
        setArrStatus(prev => ({ ...prev, monitored: true, hasFile: false, isDownloading: true, downloadPercent: 0 }))
        setTimeout(() => setRequestMsg(null), 4000)
      } else {
        setRequestMsg({ type: 'err', text: data.message ?? data.error ?? 'Request failed' })
        setTimeout(() => setRequestMsg(null), 6000)
      }
    } catch {
      setRequestMsg({ type: 'err', text: 'Network error' })
      setTimeout(() => setRequestMsg(null), 4000)
    } finally {
      setRequestingDownload(false)
    }
  }

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

  // Progress bar rendering (respects showProgressBars setting)
  const showBars = cardMeta.showProgressBars !== false
  const progressBars = showBars && jellyfinProgress && jellyfinProgress.jellyfinStatus !== 'planned' ? (() => {
    const watched = jellyfinProgress.jellyfinStatus === 'watched'
    if (jellyfinProgress.mediaType === 'movie') {
      const pct = watched ? 100 : (jellyfinProgress.moviePercent ?? 0)
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
    const tvProg = getTvProgress(jellyfinProgress, meta)
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
            className="flex-shrink-0 text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
            style={
              item.mediaType === 'movie'
                ? { background: 'rgba(251,146,60,.13)', color: 'var(--orange)' }
                : { background: 'rgba(168,85,247,.13)', color: 'var(--purple)' }
            }
          >
            {item.mediaType === 'movie' ? 'Movie' : 'TV'}
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
          <StatusBadge status={item.status} />
          {item.mediaType === 'tv' && (() => {
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
        {arrStatus && (
          <div className="flex items-center gap-[6px] flex-wrap mt-[2px]" onClick={e => e.stopPropagation()}>
            {arrStatus.hasFile && (
              <span
                className="text-[var(--text-10)] font-extrabold tracking-[0.04em] uppercase px-[7px] py-[2px] rounded-full flex items-center gap-1"
                style={{ background: 'rgba(34,197,94,.15)', color: 'var(--green)', border: '1px solid rgba(34,197,94,.2)' }}
              >
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
                Available
              </span>
            )}
            {arrStatus.isDownloading && !arrStatus.hasFile && (
              <span
                className="text-[var(--text-10)] font-extrabold tracking-[0.04em] uppercase px-[7px] py-[2px] rounded-full flex items-center gap-1.5"
                style={{ background: 'rgba(168,85,247,.15)', color: 'var(--purple)', border: '1px solid rgba(168,85,247,.2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping flex-shrink-0" />
                {arrStatus.downloadPercent != null ? `${arrStatus.downloadPercent}%` : 'Downloading'}
              </span>
            )}
            {!arrStatus.hasFile && !arrStatus.isDownloading && (
              <button
                onClick={handleRequestDownload}
                disabled={requestingDownload}
                className="text-[var(--text-10)] font-bold px-[8px] py-[2px] rounded-full border-none cursor-pointer transition-all duration-100 flex items-center gap-1 disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}
                onMouseEnter={(e) => { if (!requestingDownload) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                title={`Request ${item.mediaType === 'movie' ? 'movie' : 'series'} download`}
              >
                {requestingDownload ? (
                  <svg className="animate-spin" width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" />
                  </svg>
                ) : (
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 1v7M3 5l3 3 3-3M1 10h10" />
                  </svg>
                )}
                {requestingDownload ? 'Requesting…' : 'Request'}
              </button>
            )}
            {requestMsg && (
              <span
                className="text-[var(--text-10)] font-medium px-[6px] py-[1px] rounded-[4px]"
                style={{
                  background: requestMsg.type === 'ok' ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                  color: requestMsg.type === 'ok' ? '#4ade80' : '#f87171',
                  border: `1px solid ${requestMsg.type === 'ok' ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={requestMsg.text}
              >
                {requestMsg.type === 'ok' ? '✓' : '⚠'} {requestMsg.text}
              </span>
            )}
          </div>
        )}
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
