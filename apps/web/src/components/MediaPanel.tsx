'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { v4 as uuidv4 } from 'uuid'
import type { MediaType, WatchStatus, JellyfinProgress } from '@mywatch/core'
import { useWatchlistItem, useUpsertItem, useSoftDeleteItem, getLocalDeviceId } from '@/hooks/useWatchlist'
import { useMediaMeta } from '@/hooks/useMediaMeta'
import { useSettings } from '@/hooks/useSettings'
import { StatusBadge } from './StatusBadge'
import { ProgressTracker } from './ProgressTracker'
import { getTvProgress } from '@/lib/progress'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { StatusPicker } from './StatusPicker'

const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w780'
const TMDB_POSTER = 'https://image.tmdb.org/t/p/w342'
const TMDB_LOGO = 'https://image.tmdb.org/t/p/w45'

const STATUSES: WatchStatus[] = ['planned', 'in_progress', 'watched', 'quit']
const STATUS_LABELS: Record<WatchStatus, string> = {
  planned: 'Planned',
  in_progress: 'Watching',
  watched: 'Watched',
  quit: 'Quit',
}
const PRESET_PLATFORMS = ['Jellyfin', 'Cellcom', 'FreTV', 'Plex', 'Emby']

function formatReleaseDate(releaseDate: string): string {
  return new Date(releaseDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function isUpcoming(releaseDate: string | null): boolean {
  if (!releaseDate) return false
  return new Date(releaseDate) > new Date()
}

interface Props {
  tmdbId: number
  mediaType: MediaType
  onClose: () => void
  jellyfinProgress?: JellyfinProgress
}

export function MediaPanel({ tmdbId, mediaType, onClose, jellyfinProgress }: Props) {
  const { data: session } = useSession()
  const { settings, update } = useSettings()
  const meta = useMediaMeta(tmdbId, mediaType, settings.tmdbApiKey, settings.language)
  const existingItem = useWatchlistItem(tmdbId, mediaType)
  const upsert = useUpsertItem()
  const softDelete = useSoftDeleteItem()
  const panelRef = useRef<HTMLDivElement>(null)

  const [visible, setVisible] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [season, setSeason] = useState<number | null>(null)
  const [episode, setEpisode] = useState<number | null>(null)
  const [customPlatforms, setCustomPlatforms] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [saved, setSaved] = useState(false)
  const [arrStatus, setArrStatus] = useState<{
    monitored: boolean
    hasFile: boolean
    isDownloading: boolean
    downloadPercent: number | null
  } | null>(null)
  const [arrLoading, setArrLoading] = useState(false)
  const [requestingDownload, setRequestingDownload] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null)
  const [statusPickerOpen, setStatusPickerOpen] = useState(false)

  useEffect(() => {
    if (!session?.apiToken) return
    setArrLoading(true)
    let active = true
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    fetch(`${apiBase}/api/user/arr/status?tmdbId=${tmdbId}&mediaType=${mediaType}`, {
      headers: { Authorization: `Bearer ${session.apiToken}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (active && data) {
          setArrStatus(data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setArrLoading(false)
      })

    return () => { active = false }
  }, [tmdbId, mediaType, session?.apiToken])

  async function handleRequestDownload() {
    if (!session?.apiToken) return
    setRequestingDownload(true)
    setRequestError(null)
    setRequestSuccess(null)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiBase}/api/user/arr/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.apiToken}`
        },
        body: JSON.stringify({ tmdbId, mediaType }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRequestSuccess(data.message || 'Download request sent!')
        // Optimistically set to monitored/downloading
        setArrStatus(prev => ({
          monitored: true,
          hasFile: false,
          isDownloading: true,
          downloadPercent: 0,
          ...prev,
        }))
        // Re-fetch status to get actual state
        const statusRes = await fetch(`${apiBase}/api/user/arr/status?tmdbId=${tmdbId}&mediaType=${mediaType}`, {
          headers: { Authorization: `Bearer ${session.apiToken}` }
        })
        if (statusRes.ok) {
          const freshData = await statusRes.json()
          setArrStatus(freshData)
        }
        // Auto-clear success after 5s
        setTimeout(() => setRequestSuccess(null), 5000)
      } else {
        const errMsg = data.message || data.error || `Request failed (${res.status})`
        setRequestError(errMsg)
        console.error('[MediaPanel] Download request failed:', errMsg)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setRequestError(msg)
      console.error('[MediaPanel] Download request error:', err)
    } finally {
      setRequestingDownload(false)
    }
  }

  const [isRevealed, setIsRevealed] = useState(false)
  useEffect(() => {
    setIsRevealed(false)
  }, [tmdbId, mediaType])

  const dbRecap = useLiveQuery(() => {
    return db.progressRecaps.get([tmdbId, mediaType])
  }, [tmdbId, mediaType])

  // Determine if recap is available and what the progress is
  const hasJellyfinProgress = jellyfinProgress && jellyfinProgress.jellyfinStatus === 'watching'
  const isMovieProgress = mediaType === 'movie' && (
    (hasJellyfinProgress && jellyfinProgress.moviePercent != null && jellyfinProgress.moviePercent > 0) ||
    (existingItem?.status === 'watched')
  )
  const isTvProgress = mediaType === 'tv' && (
    (hasJellyfinProgress && jellyfinProgress.season != null && jellyfinProgress.episode != null) ||
    (existingItem?.status === 'in_progress' && season != null && episode != null)
  )

  const watched = existingItem?.status === 'watched' || jellyfinProgress?.jellyfinStatus === 'watched'
  const recapPercent = isMovieProgress ? (jellyfinProgress?.moviePercent ?? (existingItem?.status === 'watched' ? 100 : null)) : null
  const recapSeason = isTvProgress ? (jellyfinProgress?.season ?? season) : null
  const recapEpisode = isTvProgress ? (jellyfinProgress?.episode ?? episode) : null
  const canShowRecap = isMovieProgress || isTvProgress

  // Animate in
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Populate from existing item
  useEffect(() => {
    if (existingItem) {
      setRating(existingItem.rating)
      setNotes(existingItem.notes ?? '')
      setSeason(existingItem.progressSeason)
      setEpisode(existingItem.progressEpisode)
      setCustomPlatforms(existingItem.customPlatforms ?? [])
    }
  }, [existingItem?.id])

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 260)
  }

  async function handleStatusChange(status: WatchStatus) {
    const now = new Date().toISOString()
    await upsert({
      id: existingItem?.id ?? uuidv4(),
      userId: existingItem?.userId ?? (session?.user?.id ?? getLocalDeviceId()),
      tmdbId,
      mediaType,
      status,
      progressSeason: season,
      progressEpisode: episode,
      rating,
      notes: notes || null,
      customPlatforms,
      addedAt: existingItem?.addedAt ?? now,
      startedAt: existingItem?.startedAt ?? (status === 'in_progress' ? now : null),
      finishedAt: existingItem?.finishedAt ?? (status === 'watched' ? now : null),
      quitAt: existingItem?.quitAt ?? (status === 'quit' ? now : null),
      deletedAt: null,
    })
  }

  async function handleSave() {
    if (!existingItem) return
    await upsert({
      ...existingItem,
      rating,
      notes: notes || null,
      progressSeason: season,
      progressEpisode: episode,
      customPlatforms,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function handleRemove() {
    if (!existingItem) return
    await softDelete(existingItem.id)
    handleClose()
  }

  function addCustomPlatform(name: string) {
    const trimmed = name.trim()
    if (!trimmed || customPlatforms.includes(trimmed)) return
    setCustomPlatforms((prev) => [...prev, trimmed])
    setCustomInput('')
    setShowCustomInput(false)
  }

  function removeCustomPlatform(name: string) {
    setCustomPlatforms((prev) => prev.filter((p) => p !== name))
  }

  const upcoming = isUpcoming(meta?.releaseDate ?? null)
  const providers = meta?.watchProviders ?? []
  const hasProviders = providers.length > 0 || customPlatforms.length > 0

  return (
    <>
      {statusPickerOpen && (
        <StatusPicker 
          onSelect={(status) => {
            handleStatusChange(status)
            setStatusPickerOpen(false)
          }} 
          onCancel={() => setStatusPickerOpen(false)} 
        />
      )}
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 z-40 transition-opacity duration-[260ms]"
        style={{
          background: 'rgba(0,0,0,.55)',
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 'min(480px, 100vw)',
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 40px rgba(0,0,0,.5)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 260ms cubic-bezier(0.32, 0, 0.15, 1)',
        }}
      >
        {/* Sticky top: backdrop + close button */}
        <div className="flex-shrink-0 relative">
          {meta?.backdropPath ? (
            <>
              <div className="relative h-36 overflow-hidden">
                <img src={`${TMDB_BACKDROP}${meta.backdropPath}`} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--bg) 0%, transparent 55%)' }} />
              </div>
            </>
          ) : (
            <div style={{ height: 52 }} />
          )}
          {/* Close button always in top-right of this zone */}
          <button
            onClick={handleClose}
            className="absolute right-[12px] flex items-center justify-center w-[30px] h-[30px] rounded-full transition-all duration-100"
            style={{
              top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
              background: meta?.backdropPath ? 'rgba(0,0,0,.45)' : 'var(--surface)',
              border: `1px solid ${meta?.backdropPath ? 'rgba(255,255,255,.12)' : 'var(--border)'}`,
              color: meta?.backdropPath ? '#fff' : 'var(--muted)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
        <div style={{ padding: '0 20px 40px' }} className="flex flex-col gap-5">
          {/* Header: poster + title */}
          <div className="flex gap-4 items-start">
            {meta?.posterPath && (
              <img
                src={`${TMDB_POSTER}${meta.posterPath}`}
                alt=""
                className="flex-shrink-0 rounded-[8px]"
                style={{ width: 88, boxShadow: '0 4px 20px rgba(0,0,0,.5)', border: '2px solid var(--border)' }}
              />
            )}
            <div className="flex flex-col gap-[5px] pt-[4px] min-w-0">
              <h2
                className="font-bold leading-[1.2]"
                style={{ fontSize: 'var(--text-18)', letterSpacing: '-0.025em', color: 'var(--fg)' }}
              >
                {meta?.title ?? `#${tmdbId}`}
              </h2>
              <div className="flex items-center gap-[5px] flex-wrap" style={{ color: 'var(--muted2)', fontSize: 'var(--text-12)' }}>
                <span
                  className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
                  style={
                    mediaType === 'movie'
                      ? { background: 'rgba(251,146,60,.13)', color: 'var(--orange)' }
                      : { background: 'rgba(168,85,247,.13)', color: 'var(--purple)' }
                  }
                >
                  {mediaType === 'movie' ? 'Movie' : 'TV'}
                </span>
                {meta?.releaseDate && <span>{meta.releaseDate.slice(0, 4)}</span>}
                {meta?.runtime && <><span style={{ opacity: 0.4 }}>·</span><span>{meta.runtime} min</span></>}
                {meta?.seasonsCount && <><span style={{ opacity: 0.4 }}>·</span><span>{meta.seasonsCount} seasons</span></>}
                {meta?.voteAverage != null && meta.voteAverage > 0 && (
                  <><span style={{ opacity: 0.4 }}>·</span><span style={{ color: 'var(--amber)' }}>★ {meta.voteAverage.toFixed(1)}</span></>
                )}
              </div>
              {upcoming && meta?.releaseDate && (
                <div className="flex items-center gap-2">
                  <span
                    className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[6px] py-[2px] rounded-[3px]"
                    style={{ background: 'rgba(251,191,36,.15)', color: 'var(--amber)' }}
                  >
                    Upcoming
                  </span>
                  <span style={{ fontSize: 'var(--text-11)', color: 'var(--muted2)' }}>{formatReleaseDate(meta.releaseDate)}</span>
                </div>
              )}
              {/* Genres */}
              {meta?.genres && meta.genres.length > 0 && (
                <div className="flex flex-wrap gap-[3px]">
                  {meta.genres.map((g) => (
                    <span
                      key={g.id}
                      className="text-[var(--text-10)] font-medium px-[6px] py-[1.5px] rounded-[4px]"
                      style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* YouTube Trailer */}
              {meta?.youtubeTrailerKey && (
                <a
                  href={`https://www.youtube.com/watch?v=${meta.youtubeTrailerKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-[10px] py-[5px] rounded-[6px] text-[11px] font-bold w-fit mt-[4px] transition-all duration-100 no-underline cursor-pointer"
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)'
                    e.currentTarget.style.color = '#fff'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)'
                    e.currentTarget.style.color = '#f87171'
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.163c-.272-1.016-1.07-1.815-2.085-2.087C19.578 3.53 12 3.53 12 3.53s-7.578 0-9.413.546c-1.015.272-1.813 1.071-2.085 2.087C0 7.998 0 12 0 12s0 4.002.502 5.837c.272 1.016 1.07 1.815 2.085 2.087 1.835.547 9.413.547 9.413.547s7.578 0 9.413-.547c1.015-.272 1.813-1.071 2.085-2.087C24 16.002 24 12 24 12s0-4.002-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  Watch Trailer
                </a>
              )}
            </div>
          </div>

          {/* Overview */}
          {meta?.overview && (
            <p style={{ fontSize: 'var(--text-13)', color: 'var(--fg2)', lineHeight: 1.6 }}>{meta.overview}</p>
          )}

          <Divider />

          {/* Status */}
          <div className="flex flex-col gap-[8px]">
            <SectionLabel>Status</SectionLabel>
            {existingItem ? (
              <div 
                className="mt-[2px] cursor-pointer inline-block w-fit"
                onClick={() => setStatusPickerOpen(true)}
              >
                <StatusBadge status={existingItem.status} />
              </div>
            ) : (
              <button
                onClick={() => setStatusPickerOpen(true)}
                className="w-fit px-[12px] py-[6px] rounded-[6px] text-[var(--text-12)] font-medium transition-all duration-100 cursor-pointer border-none"
                style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
              >
                + Add to List
              </button>
            )}
          </div>

          {/* Jellyfin progress */}
          {jellyfinProgress && jellyfinProgress.jellyfinStatus !== 'planned' && (() => {
            const watched = jellyfinProgress.jellyfinStatus === 'watched'
            const isMovie = jellyfinProgress.mediaType === 'movie'
            const total = jellyfinProgress.totalEpisodes ?? 0

            let bar: React.ReactNode
            if (isMovie) {
              const pct = watched ? 100 : (jellyfinProgress.moviePercent ?? 0)
              const fill = watched ? 'rgba(134,239,172,.8)' : 'rgba(251,191,36,.9)'
              bar = (
                <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: fill, transition: 'width 300ms' }} />
                </div>
              )
            } else if (watched) {
              bar = <div style={{ height: 4, background: 'rgba(134,239,172,.8)', borderRadius: 99 }} />
            } else {
              const tvProg = getTvProgress(jellyfinProgress, meta)
              const completedPct = tvProg.completedPct
              const episodePct = tvProg.episodePercent
              const hasEpisodeBar = tvProg.hasEpisodeBar

              bar = (
                <div className="flex flex-col gap-3 w-full">
                  {/* Series progress bar */}
                  <div className="flex flex-col gap-[4px]">
                    <div className="flex justify-between text-[11px]" style={{ color: 'var(--muted2)' }}>
                      <span>Series Progress</span>
                      <span className="font-medium tabular-nums">{completedPct}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${completedPct}%`, height: '100%', background: 'rgba(251,191,36,.9)', transition: 'width 300ms' }} />
                    </div>
                  </div>

                  {/* Episode progress bar */}
                  {hasEpisodeBar && (
                    <div className="flex flex-col gap-[4px] mt-[2px]">
                      <div className="flex justify-between text-[11px]" style={{ color: 'var(--muted2)' }}>
                        <span>Episode {jellyfinProgress.episode ?? ''} Progress</span>
                        <span className="font-medium tabular-nums">{episodePct}%</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${episodePct}%`, height: '100%', background: 'rgba(96,165,250,.9)', transition: 'width 300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div className="flex flex-col gap-[8px]">
                <div className="flex items-center gap-[8px] flex-wrap">
                  <span
                    className="text-[var(--text-10)] font-bold px-[6px] py-[2px] rounded-[4px]"
                    style={{ background: 'rgba(168,85,247,.15)', color: 'var(--purple)' }}
                  >
                    Jellyfin
                  </span>
                  {!watched && isMovie && (
                    <span style={{ fontSize: 'var(--text-12)', color: 'var(--fg2)' }}>
                      {jellyfinProgress.moviePercent ?? 0}%
                    </span>
                  )}
                  {!watched && !isMovie && (() => {
                    const tvProg = getTvProgress(jellyfinProgress, meta)
                    return (
                      <span style={{ fontSize: 'var(--text-12)', color: 'var(--fg2)' }}>
                        {jellyfinProgress.season != null && (
                          <span style={{ color: 'var(--fg)' }}>S{jellyfinProgress.season} · E{jellyfinProgress.episode ?? '?'}</span>
                        )}
                        {tvProg.totalEpisodes > 0 && (
                          <span style={{ color: 'var(--muted2)' }}>{jellyfinProgress.season != null ? ' · ' : ''}{tvProg.watchedEpisodes}/{tvProg.totalEpisodes} ep</span>
                        )}
                        {tvProg.hasEpisodeBar && (
                          <span style={{ color: 'var(--amber)' }}> · {tvProg.episodePercent}%</span>
                        )}
                      </span>
                    )
                  })()}
                </div>
                {bar}
              </div>
            )
          })()}

          {/* Download Manager block when not yet in Jellyfin library */}
          {(!jellyfinProgress || jellyfinProgress.jellyfinStatus === 'planned') && session?.apiToken && (
            <div className="flex flex-col gap-[8px]">
              <SectionLabel>Download Manager</SectionLabel>
              {arrStatus ? (
                <div 
                  className="rounded-[8px] p-4 flex flex-col gap-3 transition-all duration-300"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}
                >
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span style={{ color: 'var(--fg)' }}>
                      {mediaType === 'movie' ? 'Radarr (Movies)' : 'Sonarr (TV Shows)'}
                    </span>
                    <span 
                      className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={
                        arrStatus.hasFile
                          ? { background: 'rgba(34,197,94,.15)', color: 'var(--green)' }
                          : arrStatus.isDownloading
                          ? { background: 'rgba(168,85,247,.15)', color: 'var(--purple)' }
                          : arrStatus.monitored
                          ? { background: 'rgba(59,130,246,.15)', color: 'var(--accent2)' }
                          : { background: 'rgba(255,255,255,.08)', color: 'var(--muted)' }
                      }
                    >
                      {arrStatus.hasFile
                        ? '✓ Available'
                        : arrStatus.isDownloading
                        ? 'Downloading'
                        : arrStatus.monitored
                        ? 'Monitored'
                        : 'Not Tracked'
                      }
                    </span>
                  </div>

                  {arrStatus.isDownloading && (
                    <div className="flex flex-col gap-1.5 w-full">
                      <div className="flex justify-between text-[11px]" style={{ color: 'var(--muted2)' }}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
                          Active Download
                        </span>
                        <span className="font-semibold tabular-nums" style={{ color: 'var(--purple)' }}>
                          {arrStatus.downloadPercent != null ? `${arrStatus.downloadPercent}%` : '0%'}
                        </span>
                      </div>
                      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${arrStatus.downloadPercent ?? 0}%`, 
                            height: '100%', 
                            background: 'var(--purple)', 
                            transition: 'width 400ms ease-out-in' 
                          }} 
                        />
                      </div>
                    </div>
                  )}

                  {arrStatus.hasFile && (
                    <p className="text-[11px]" style={{ color: 'var(--muted2)' }}>
                      This title is successfully downloaded and is available in your media library directory.
                    </p>
                  )}

                  {arrStatus.monitored && !arrStatus.isDownloading && !arrStatus.hasFile && (
                    <p className="text-[11px]" style={{ color: 'var(--muted2)' }}>
                      Monitored and waiting for a release to be indexed for download.
                    </p>
                  )}

                  {!arrStatus.monitored && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px]" style={{ color: 'var(--muted2)', lineHeight: 1.4 }}>
                        This title is not currently monitored or downloading. Request a download to start monitoring.
                      </p>
                      <button
                        onClick={handleRequestDownload}
                        disabled={requestingDownload}
                        className="w-full py-1.5 rounded-[6px] text-[11px] font-bold cursor-pointer border-none transition-all duration-100 flex items-center justify-center gap-1.5"
                        style={{
                          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
                          color: '#fff',
                        }}
                      >
                        {requestingDownload ? (
                          'Requesting…'
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            ✨ Request Download
                          </>
                        )}
                      </button>
                      {requestError && (
                        <div
                          className="rounded-[6px] px-3 py-2 text-[10px] font-medium leading-snug"
                          style={{ background: 'rgba(239,68,68,.12)', color: '#f87171', border: '1px solid rgba(239,68,68,.25)' }}
                        >
                          ⚠ {requestError}
                        </div>
                      )}
                      {requestSuccess && (
                        <div
                          className="rounded-[6px] px-3 py-2 text-[10px] font-medium leading-snug"
                          style={{ background: 'rgba(34,197,94,.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,.25)' }}
                        >
                          ✓ {requestSuccess}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-center" style={{ color: 'var(--muted2)' }}>
                  Loading download status…
                </div>
              )}
              {/* Error / success shown outside of status block too (e.g. after re-request on monitored) */}
              {arrStatus && (requestError || requestSuccess) && arrStatus.monitored && (
                <>
                  {requestError && (
                    <div
                      className="rounded-[6px] px-3 py-2 text-[10px] font-medium leading-snug"
                      style={{ background: 'rgba(239,68,68,.12)', color: '#f87171', border: '1px solid rgba(239,68,68,.25)' }}
                    >
                      ⚠ {requestError}
                    </div>
                  )}
                  {requestSuccess && (
                    <div
                      className="rounded-[6px] px-3 py-2 text-[10px] font-medium leading-snug"
                      style={{ background: 'rgba(34,197,94,.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,.25)' }}
                    >
                      ✓ {requestSuccess}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* AI Progress Recap inline under progress tracking */}
          {canShowRecap && !watched && (
            <div className="mt-4 flex flex-col gap-2">
              {!dbRecap ? (
                <div 
                  className="rounded-[8px] p-3 text-center border animate-pulse flex items-center justify-center gap-2"
                  style={{
                    background: 'rgba(99, 102, 241, 0.03)',
                    borderColor: 'rgba(99, 102, 241, 0.1)',
                  }}
                >
                  <span 
                    className="w-1.5 h-1.5 rounded-full inline-block animate-ping"
                    style={{ background: 'var(--accent2)' }}
                  ></span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--accent2)' }}>
                    AI is writing your spoiler-free recap in the background...
                  </span>
                </div>
              ) : (
                <div 
                  className="flex flex-col gap-2 relative overflow-hidden rounded-[8px] p-4 transition-all duration-300"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border2)',
                  }}
                >
                  <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-[0.08em]"
                       style={{ color: 'var(--accent2)' }}>
                    <span>✨ Progress Recap</span>
                    <span style={{ color: 'var(--muted)' }}>
                      {dbRecap.mediaType === 'movie' 
                        ? `Up to ${dbRecap.progressPercent}%`
                        : `Up to S${dbRecap.progressSeason} E${dbRecap.progressEpisode}`
                      }
                    </span>
                  </div>

                  <div className="relative">
                    <div 
                      className="text-[12px] leading-relaxed select-none transition-all duration-500 ease-in-out"
                      style={{
                        filter: isRevealed ? 'none' : 'blur(10px)',
                        opacity: isRevealed ? 1 : 0.25,
                        transition: 'filter 0.4s ease, opacity 0.4s ease',
                      }}
                    >
                      {dbRecap.recapText}
                    </div>

                    {!isRevealed && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-1">
                        <div className="text-[11px] font-bold text-center" style={{ color: 'var(--fg2)' }}>
                          ⚠️ Spoiler Alert (up to {dbRecap.mediaType === 'movie' 
                            ? `${dbRecap.progressPercent}%`
                            : `S${dbRecap.progressSeason} E${dbRecap.progressEpisode}`
                          })
                        </div>
                        <button
                          onClick={() => setIsRevealed(true)}
                          className="px-3 py-1 text-[10px] font-extrabold tracking-wider uppercase cursor-pointer rounded-[4px] border-none"
                          style={{
                            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
                            color: '#ffffff',
                            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)',
                          }}
                        >
                          Reveal Recap
                        </button>
                      </div>
                    )}
                  </div>

                  {isRevealed && (
                    <div className="flex justify-end mt-1">
                      <button
                        onClick={() => setIsRevealed(false)}
                        className="text-[9px] font-extrabold tracking-[0.05em] uppercase hover:underline border-none cursor-pointer bg-transparent"
                        style={{ color: 'var(--muted)' }}
                      >
                        Hide Recap
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Divider />

          {/* Rating */}
          <div className="flex flex-col gap-[8px]">
            <SectionLabel>Your Rating</SectionLabel>
            <div className="flex gap-[4px] flex-wrap">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(rating === n ? null : n)}
                  className="w-[28px] h-[28px] rounded-[5px] text-[var(--text-12)] font-semibold transition-all duration-100 cursor-pointer border-none"
                  style={{
                    background: rating != null && n <= rating ? 'var(--amber)' : 'var(--surface)',
                    color: rating != null && n <= rating ? '#18181b' : 'var(--muted)',
                    border: `1px solid ${rating != null && n <= rating ? 'transparent' : 'var(--border2)'}`,
                  }}
                  onMouseEnter={(e) => { if (!(rating != null && n <= rating)) e.currentTarget.style.color = 'var(--fg)' }}
                  onMouseLeave={(e) => { if (!(rating != null && n <= rating)) e.currentTarget.style.color = 'var(--muted)' }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-[8px]">
            <SectionLabel>Notes</SectionLabel>
            {noteEditing ? (
              <div className="flex flex-col gap-[6px]">
                <textarea
                  autoFocus
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Your thoughts…"
                  className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none resize-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--fg)', lineHeight: 1.5 }}
                />
                <button
                  onClick={() => setNoteEditing(false)}
                  className="self-start text-[var(--text-12)] cursor-pointer border-none px-0 bg-transparent"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)' }}
                >
                  Done
                </button>
              </div>
            ) : notes ? (
              <div className="flex flex-col gap-[6px]">
                <p
                  className="text-[var(--text-13)] rounded-[6px] px-3 py-2 whitespace-pre-wrap cursor-pointer"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--fg)', lineHeight: 1.5 }}
                  onClick={() => setNoteEditing(true)}
                >
                  {notes}
                </p>
              </div>
            ) : (
              <button
                onClick={() => setNoteEditing(true)}
                className="flex items-center gap-[6px] px-[10px] py-[7px] rounded-[6px] text-[var(--text-12)] font-medium cursor-pointer border-none w-fit transition-all duration-100"
                style={{ background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: '0.8rem', height: '0.8rem' }}>
                  <line x1="8" y1="3" x2="8" y2="13" />
                  <line x1="3" y1="8" x2="13" y2="8" />
                </svg>
                Add Note
              </button>
            )}
          </div>

          <Divider />

          {/* Where to watch */}
          <div className="flex flex-col gap-[8px]">
            <SectionLabel>Where to Watch</SectionLabel>
            <div className="flex flex-wrap gap-[6px] items-center">
              {providers.map((p) => (
                <div
                  key={p.providerId}
                  className="flex items-center gap-[6px] px-[8px] py-[5px] rounded-[6px]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}
                  title={p.providerName}
                >
                  {p.logoPath && (
                    <img src={`${TMDB_LOGO}${p.logoPath}`} alt={p.providerName} className="w-[16px] h-[16px] rounded-[3px]" />
                  )}
                  <span style={{ fontSize: 'var(--text-11)', fontWeight: 500, color: 'var(--fg2)' }}>{p.providerName}</span>
                </div>
              ))}

              {customPlatforms.map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-[5px] px-[8px] py-[5px] rounded-[6px] group"
                  style={{ background: 'var(--accent-bg)', border: '1px solid rgba(99,102,241,.3)' }}
                >
                  <span style={{ fontSize: 'var(--text-11)', fontWeight: 500, color: 'var(--accent2)' }}>{p}</span>
                  <button
                    onClick={() => removeCustomPlatform(p)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--muted2)', fontSize: 'var(--text-13)', lineHeight: 1, cursor: 'pointer', border: 'none', background: 'transparent', padding: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}

              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="flex items-center gap-[4px] px-[8px] py-[5px] rounded-[6px] transition-all duration-100"
                  style={{
                    background: 'transparent',
                    border: '1px dashed var(--border)',
                    color: 'var(--muted2)',
                    fontSize: 'var(--text-11)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--muted2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  + Add platform
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-[4px]">
                  {PRESET_PLATFORMS.filter((p) => !customPlatforms.includes(p)).map((p) => (
                    <button
                      key={p}
                      onClick={() => addCustomPlatform(p)}
                      className="px-[7px] py-[3px] rounded-[4px] text-[var(--text-10)] font-medium transition-all duration-100 cursor-pointer"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--surface2)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--surface)' }}
                    >
                      {p}
                    </button>
                  ))}
                  <input
                    autoFocus
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addCustomPlatform(customInput)
                      if (e.key === 'Escape') setShowCustomInput(false)
                    }}
                    placeholder="Custom…"
                    className="w-[90px] px-[8px] py-[4px] rounded-[5px] text-[var(--text-11)] focus:outline-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--fg)' }}
                  />
                </div>
              )}

              {!hasProviders && !showCustomInput && (
                <span style={{ fontSize: 'var(--text-11)', color: 'var(--muted2)' }}>No streaming info available</span>
              )}
            </div>
          </div>

          {/* Save / Remove */}
          {existingItem && (
            <>
              <Divider />
              <div className="flex gap-[8px]">
                <button
                  onClick={handleSave}
                  className="flex-1 py-[9px] rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none transition-all duration-100"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                >
                  {saved ? 'Saved ✓' : 'Save'}
                </button>
                <button
                  onClick={handleRemove}
                  className="py-[9px] px-[16px] rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none transition-all duration-100"
                  style={{ background: 'rgba(248,113,113,.1)', color: 'var(--red)', border: '1px solid rgba(248,113,113,.2)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,.18)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,.1)' }}
                >
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
        </div>{/* end scrollable */}


      </div>
    </>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border2)', margin: '0 -20px' }} />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase"
      style={{ color: 'var(--muted2)' }}
    >
      {children}
    </span>
  )
}
