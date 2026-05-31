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

const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w780'
const TMDB_POSTER = 'https://image.tmdb.org/t/p/w342'
const TMDB_LOGO = 'https://image.tmdb.org/t/p/w45'

const STATUSES: WatchStatus[] = ['planned', 'in_progress', 'watched', 'quit']
const STATUS_LABELS: Record<WatchStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
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
  const { settings } = useSettings()
  const meta = useMediaMeta(tmdbId, mediaType, settings.tmdbApiKey, settings.language)
  const existingItem = useWatchlistItem(tmdbId, mediaType)
  const upsert = useUpsertItem()
  const softDelete = useSoftDeleteItem()
  const panelRef = useRef<HTMLDivElement>(null)

  const [visible, setVisible] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [season, setSeason] = useState<number | null>(null)
  const [episode, setEpisode] = useState<number | null>(null)
  const [customPlatforms, setCustomPlatforms] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [saved, setSaved] = useState(false)

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
            className="absolute top-[12px] right-[12px] flex items-center justify-center w-[30px] h-[30px] rounded-full transition-all duration-100"
            style={{
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
            <div className="flex flex-wrap gap-[5px]">
              {STATUSES.map((s) => {
                const active = existingItem?.status === s
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className="px-[12px] py-[6px] rounded-[6px] text-[var(--text-12)] font-medium transition-all duration-100 cursor-pointer border-none"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--surface)',
                      color: active ? '#fff' : 'var(--muted)',
                      border: `1px solid ${active ? 'transparent' : 'var(--border2)'}`,
                    }}
                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = 'var(--fg2)'; e.currentTarget.style.borderColor = 'var(--border)' } }}
                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border2)' } }}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                )
              })}
            </div>
            {existingItem && <div className="mt-[2px]"><StatusBadge status={existingItem.status} /></div>}
          </div>

          {/* Jellyfin progress */}
          {jellyfinProgress && jellyfinProgress.jellyfinStatus !== 'planned' && (() => {
            const pct = jellyfinProgress.jellyfinStatus === 'watched' ? 100
              : jellyfinProgress.mediaType === 'movie' ? (jellyfinProgress.moviePercent ?? 0)
              : jellyfinProgress.totalEpisodes
                ? Math.round(((jellyfinProgress.watchedEpisodes ?? 0) / jellyfinProgress.totalEpisodes) * 100)
                : 0
            const fill = jellyfinProgress.jellyfinStatus === 'watched'
              ? 'rgba(134,239,172,.8)'
              : 'rgba(251,191,36,.9)'
            return (
              <div className="flex flex-col gap-[8px]">
                <SectionLabel>On Jellyfin</SectionLabel>
                <div className="flex items-center gap-[8px] flex-wrap">
                  <span
                    className="text-[var(--text-9h)] font-extrabold tracking-[0.04em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
                    style={{ background: 'rgba(251,191,36,.15)', color: 'var(--amber)' }}
                  >
                    {jellyfinProgress.jellyfinStatus === 'watched' ? 'Watched' : 'Watching'}
                  </span>
                  {jellyfinProgress.jellyfinStatus === 'watching' && jellyfinProgress.mediaType === 'movie' && (
                    <span style={{ fontSize: 'var(--text-12)', color: 'var(--fg2)' }}>
                      {jellyfinProgress.moviePercent ?? 0}% watched
                    </span>
                  )}
                  {jellyfinProgress.jellyfinStatus === 'watching' && jellyfinProgress.mediaType === 'tv' && (
                    <span style={{ fontSize: 'var(--text-12)', color: 'var(--fg2)' }}>
                      {jellyfinProgress.season != null && `S${jellyfinProgress.season} · E${jellyfinProgress.episode ?? '?'}`}
                      {jellyfinProgress.totalEpisodes
                        ? ` · ${jellyfinProgress.watchedEpisodes ?? 0} of ${jellyfinProgress.totalEpisodes} ep.`
                        : jellyfinProgress.episodePercent != null ? ` · ${jellyfinProgress.episodePercent}% through ep.` : ''}
                    </span>
                  )}
                </div>
                <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: fill, borderRadius: 99, transition: 'width 300ms' }} />
                </div>
              </div>
            )
          })()}

          {/* Progress (TV in_progress) */}
          {mediaType === 'tv' && existingItem?.status === 'in_progress' && (
            <div className="flex flex-col gap-[8px]">
              <SectionLabel>Progress</SectionLabel>
              <ProgressTracker
                season={season}
                episode={episode}
                onChange={(s, e) => { setSeason(s); setEpisode(e) }}
              />
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
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Your thoughts…"
              className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none resize-none"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border2)',
                color: 'var(--fg)',
                lineHeight: 1.5,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border2)' }}
            />
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
