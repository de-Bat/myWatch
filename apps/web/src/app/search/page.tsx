'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import type { MediaType, WatchStatus } from '@mywatch/core'
import type { TmdbSearchResult } from '@mywatch/tmdb'
import { TmdbClient } from '@mywatch/tmdb'
import { useWatchlistItem, useUpsertItem, getLocalDeviceId } from '@/hooks/useWatchlist'
import { MediaCard } from '@/components/MediaCard'
import { StatusPicker } from '@/components/StatusPicker'

function useTmdbSearch(query: string, mediaType: MediaType | 'all') {
  const [results, setResults] = useState<TmdbSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setError(null)
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const client = new TmdbClient({ apiKey: process.env.NEXT_PUBLIC_TMDB_API_KEY ?? '' })
        const res = await client.search(query, mediaType === 'all' ? undefined : mediaType)
        setResults(res)
      } catch (e) {
        setResults([])
        setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, mediaType])

  return { results, loading, error }
}

function SearchResult({
  result,
  onAdd,
}: {
  result: TmdbSearchResult
  onAdd: (r: TmdbSearchResult) => void
}) {
  const existing = useWatchlistItem(result.id, result.media_type)
  return <MediaCard result={result} existingStatus={existing?.status} onAdd={onAdd} />
}

export default function SearchPage() {
  const { data: session } = useSession()
  const [query, setQuery] = useState('')
  const [mediaType, setMediaType] = useState<MediaType | 'all'>('all')
  const [pending, setPending] = useState<TmdbSearchResult | null>(null)
  const { results, loading, error } = useTmdbSearch(query, mediaType)
  const upsert = useUpsertItem()

  async function handleAdd(result: TmdbSearchResult, status: WatchStatus) {
    const now = new Date().toISOString()
    await upsert({
      id: uuidv4(),
      userId: session?.user?.id ?? getLocalDeviceId(),
      tmdbId: result.id,
      mediaType: result.media_type,
      status,
      progressEpisode: null,
      progressSeason: null,
      rating: null,
      notes: null,
      addedAt: now,
      startedAt: status === 'in_progress' ? now : null,
      finishedAt: status === 'watched' ? now : null,
      quitAt: status === 'quit' ? now : null,
      deletedAt: null,
    })
    setPending(null)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
          ← Back
        </Link>
        <h1 className="text-xl font-bold">Search</h1>
      </header>

      <div className="flex gap-2">
        <input
          autoFocus
          type="search"
          placeholder="Search movies and TV shows…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500 text-sm"
        />
        <select
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value as MediaType | 'all')}
          className="bg-zinc-800 text-sm rounded px-2 border border-zinc-700"
        >
          <option value="all">All</option>
          <option value="movie">Movies</option>
          <option value="tv">TV</option>
        </select>
      </div>

      {!process.env.NEXT_PUBLIC_TMDB_API_KEY && (
        <p className="text-red-400 text-sm">NEXT_PUBLIC_TMDB_API_KEY not set — search won't work</p>
      )}
      {loading && <p className="text-zinc-500 text-sm">Searching…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="space-y-2">
        {results.map((r) => (
          <SearchResult key={`${r.media_type}-${r.id}`} result={r} onAdd={setPending} />
        ))}
      </div>

      {pending && (
        <StatusPicker
          onSelect={(status) => handleAdd(pending, status)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
