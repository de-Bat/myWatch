'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import type { MediaType, WatchStatus } from '@mywatch/core'
import { useWatchlistItem, useUpsertItem, useSoftDeleteItem, getLocalDeviceId } from '@/hooks/useWatchlist'
import { useMediaMeta } from '@/hooks/useMediaMeta'
import { StatusBadge } from '@/components/StatusBadge'
import { ProgressTracker } from '@/components/ProgressTracker'

const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w780'
const TMDB_POSTER = 'https://image.tmdb.org/t/p/w342'
const STATUSES: WatchStatus[] = ['planned', 'in_progress', 'watched', 'quit']
const STATUS_LABELS: Record<WatchStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  watched: 'Watched',
  quit: 'Quit',
}

export default function MediaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const mediaType = params.type as MediaType
  const tmdbId = parseInt(params.id as string, 10)

  const meta = useMediaMeta(tmdbId, mediaType)
  const existingItem = useWatchlistItem(tmdbId, mediaType)
  const upsert = useUpsertItem()
  const softDelete = useSoftDeleteItem()

  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [season, setSeason] = useState<number | null>(null)
  const [episode, setEpisode] = useState<number | null>(null)

  useEffect(() => {
    if (existingItem) {
      setRating(existingItem.rating)
      setNotes(existingItem.notes ?? '')
      setSeason(existingItem.progressSeason)
      setEpisode(existingItem.progressEpisode)
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
    })
  }

  async function handleRemove() {
    if (!existingItem) return
    await softDelete(existingItem.id)
    router.push('/')
  }

  return (
    <div className="max-w-2xl mx-auto">
      {meta?.backdropPath && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={`${TMDB_BACKDROP}${meta.backdropPath}`}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900" />
        </div>
      )}

      <div className="px-4 py-6 space-y-5">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
          ← Back
        </Link>

        <div className="flex gap-4">
          {meta?.posterPath && (
            <img
              src={`${TMDB_POSTER}${meta.posterPath}`}
              alt=""
              className="w-24 rounded-lg flex-shrink-0 self-start"
            />
          )}
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-bold">{meta?.title ?? `#${tmdbId}`}</h1>
            <p className="text-sm text-zinc-400">
              {mediaType === 'tv' ? 'TV Show' : 'Movie'}
              {meta?.releaseDate ? ` · ${meta.releaseDate.slice(0, 4)}` : ''}
              {meta?.runtime ? ` · ${meta.runtime} min` : ''}
              {meta?.seasonsCount ? ` · ${meta.seasonsCount} seasons` : ''}
            </p>
            {meta?.genres && meta.genres.length > 0 && (
              <p className="text-xs text-zinc-500">{meta.genres.map((g) => g.name).join(', ')}</p>
            )}
            <p className="text-sm text-zinc-300">
              ★ {meta?.voteAverage.toFixed(1)} ({meta?.voteCount.toLocaleString()} votes)
            </p>
          </div>
        </div>

        {meta?.overview && (
          <p className="text-sm text-zinc-300 leading-relaxed">{meta.overview}</p>
        )}

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
              onChange={(s, e) => {
                setSeason(s)
                setEpisode(e)
              }}
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
