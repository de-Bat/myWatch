'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import type { MediaType, WatchStatus } from '@mywatch/core'
import { useWatchlistItem, useUpsertItem, useSoftDeleteItem, getLocalDeviceId, type UpsertItemInput } from '@/hooks/useWatchlist'
import { useMediaMeta } from '@/hooks/useMediaMeta'
import { useSettings } from '@/hooks/useSettings'
import { StatusBadge } from '@/components/StatusBadge'
import { ProgressTracker } from '@/components/ProgressTracker'

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

function isUpcoming(releaseDate: string | null): boolean {
  if (!releaseDate) return false
  return new Date(releaseDate) > new Date()
}

function formatReleaseDate(releaseDate: string): string {
  return new Date(releaseDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function MediaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const mediaType = params.type as MediaType
  const tmdbId = parseInt(params.id as string, 10)

  const { settings } = useSettings()
  const meta = useMediaMeta(tmdbId, mediaType, settings.tmdbApiKey, settings.language)
  const existingItem = useWatchlistItem(tmdbId, mediaType)
  const upsert = useUpsertItem()
  const softDelete = useSoftDeleteItem()

  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [season, setSeason] = useState<number | null>(null)
  const [episode, setEpisode] = useState<number | null>(null)
  const [customPlatforms, setCustomPlatforms] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  useEffect(() => {
    if (existingItem) {
      setRating(existingItem.rating)
      setNotes(existingItem.notes ?? '')
      setSeason(existingItem.progressSeason)
      setEpisode(existingItem.progressEpisode)
      setCustomPlatforms(existingItem.customPlatforms ?? [])
    }
  }, [existingItem?.id])

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
  }

  async function handleRemove() {
    if (!existingItem) return
    await softDelete(existingItem.id)
    router.push('/')
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
    <div className="max-w-2xl mx-auto">
      {meta?.backdropPath && (
        <div className="relative h-48 overflow-hidden">
          <img src={`${TMDB_BACKDROP}${meta.backdropPath}`} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900" />
        </div>
      )}

      <div className="px-4 py-6 space-y-5">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
          ← Back
        </Link>

        <div className="flex gap-4">
          {meta?.posterPath && (
            <img src={`${TMDB_POSTER}${meta.posterPath}`} alt="" className="w-24 rounded-lg flex-shrink-0 self-start" />
          )}
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-bold">{meta?.title ?? `#${tmdbId}`}</h1>
            <p className="text-sm text-zinc-400">
              {mediaType === 'tv' ? 'TV Show' : 'Movie'}
              {meta?.releaseDate ? ` · ${meta.releaseDate.slice(0, 4)}` : ''}
              {meta?.runtime ? ` · ${meta.runtime} min` : ''}
              {meta?.seasonsCount ? ` · ${meta.seasonsCount} seasons` : ''}
            </p>

            {/* Release date with upcoming badge */}
            {meta?.releaseDate && (
              <div className="flex items-center gap-2 flex-wrap">
                {upcoming && (
                  <span
                    className="text-[var(--text-10)] font-extrabold tracking-[0.06em] uppercase px-[6px] py-[2px] rounded-[3px]"
                    style={{ background: 'rgba(251,191,36,.15)', color: 'var(--amber)' }}
                  >
                    Upcoming
                  </span>
                )}
                <span className="text-xs text-zinc-500">{formatReleaseDate(meta.releaseDate)}</span>
              </div>
            )}

            {/* Genres */}
            {meta?.genres && meta.genres.length > 0 && (
              <div className="flex flex-wrap gap-[4px] pt-[2px]">
                {meta.genres.map((g) => (
                  <span
                    key={g.id}
                    className="text-[var(--text-10)] font-medium px-[7px] py-[2px] rounded-[4px]"
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

            <p className="text-sm text-zinc-300">
              ★ {meta?.voteAverage.toFixed(1)} ({meta?.voteCount.toLocaleString()} votes)
            </p>
          </div>
        </div>

        {meta?.overview && (
          <p className="text-sm text-zinc-300 leading-relaxed">{meta.overview}</p>
        )}

        {/* WHERE TO WATCH */}
        <div className="space-y-2">
          <p
            className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase"
            style={{ color: 'var(--muted2)' }}
          >
            Where to Watch
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {/* TMDB providers */}
            {providers.map((p) => (
              <div
                key={p.providerId}
                className="flex items-center gap-[6px] px-[8px] py-[5px] rounded-[6px]"
                style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}
                title={p.providerName}
              >
                {p.logoPath ? (
                  <img
                    src={`${TMDB_LOGO}${p.logoPath}`}
                    alt={p.providerName}
                    className="w-[16px] h-[16px] rounded-[3px]"
                  />
                ) : null}
                <span className="text-[var(--text-11)] font-medium" style={{ color: 'var(--fg2)' }}>
                  {p.providerName}
                </span>
              </div>
            ))}

            {/* Custom platforms */}
            {customPlatforms.map((p) => (
              <div
                key={p}
                className="flex items-center gap-[5px] px-[8px] py-[5px] rounded-[6px] group"
                style={{ background: 'var(--accent-bg)', border: '1px solid rgba(99,102,241,.3)' }}
              >
                <span className="text-[var(--text-11)] font-medium" style={{ color: 'var(--accent2)' }}>{p}</span>
                <button
                  onClick={() => removeCustomPlatform(p)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-[1px]"
                  style={{ color: 'var(--muted2)', fontSize: 'var(--text-11)', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            ))}

            {/* Add custom button */}
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
              <div className="flex items-center gap-[4px]">
                {/* Preset suggestions */}
                <div className="flex gap-[3px] flex-wrap">
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
                </div>
                <input
                  autoFocus
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addCustomPlatform(customInput)
                    if (e.key === 'Escape') setShowCustomInput(false)
                  }}
                  placeholder="Custom…"
                  className="w-[100px] px-[8px] py-[4px] rounded-[5px] text-[var(--text-11)] focus:outline-none"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--accent)',
                    color: 'var(--fg)',
                  }}
                />
              </div>
            )}

            {!hasProviders && !showCustomInput && (
              <span className="text-xs text-zinc-500">No streaming info available</span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-400">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  existingItem?.status === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {mediaType === 'tv' && existingItem?.status === 'in_progress' && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-400">Progress</p>
            <ProgressTracker
              season={season}
              episode={episode}
              onChange={(s, e) => { setSeason(s); setEpisode(e) }}
            />
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-400">Your Rating</p>
          <div className="flex gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setRating(rating === n ? null : n)}
                className={`w-7 h-7 rounded text-sm font-medium transition ${
                  rating != null && n <= rating
                    ? 'bg-yellow-500 text-zinc-900'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-400">Notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Your thoughts…"
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm focus:outline-none focus:border-zinc-500 resize-none"
          />
        </div>

        {existingItem && (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
            >
              Save
            </button>
            <button
              onClick={handleRemove}
              className="py-2 px-4 rounded bg-zinc-800 hover:bg-red-900/50 text-sm text-red-400"
            >
              Remove
            </button>
          </div>
        )}

        {existingItem && <StatusBadge status={existingItem.status} />}
      </div>
    </div>
  )
}
