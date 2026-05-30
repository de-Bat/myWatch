'use client'
import { useState, useEffect, useRef } from 'react'
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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    <div className="subpage-root">
      {/* Header */}
      <header className="flex items-center gap-3 mb-5">
        <Link
          href="/"
          className="flex items-center justify-center w-[32px] h-[32px] rounded-full border-none flex-shrink-0"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </Link>
        <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          Search
        </h1>
      </header>

      {/* Search input row */}
      <div className="flex gap-2 mb-4">
        <input
          ref={inputRef}
          type="search"
          placeholder="Search movies and TV shows…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 focus:outline-none"
          style={{
            padding: '9px 13px',
            borderRadius: 'var(--rsm)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--fg)',
            fontSize: 14,
          }}
        />
        <div
          className="flex flex-shrink-0"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--rsm)',
            padding: 2,
            gap: 1,
          }}
        >
          {(['all', 'movie', 'tv'] as const).map((t) => {
            const active = mediaType === t
            const label = t === 'all' ? 'All' : t === 'movie' ? 'Movies' : 'TV'
            return (
              <button
                key={t}
                onClick={() => setMediaType(t)}
                className="whitespace-nowrap border-none cursor-pointer transition-all duration-100"
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--rxs)',
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  background: active ? 'var(--surface2)' : 'transparent',
                  color: active ? 'var(--fg)' : 'var(--muted)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {!process.env.NEXT_PUBLIC_TMDB_API_KEY && (
        <p className="mb-3" style={{ color: 'var(--red)', fontSize: 13 }}>
          NEXT_PUBLIC_TMDB_API_KEY not set — search won&apos;t work
        </p>
      )}

      {loading && (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Searching…</p>
      )}
      {error && (
        <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>
      )}

      {!loading && !error && query && results.length === 0 && (
        <p style={{ color: 'var(--muted2)', fontSize: 13 }}>No results for &ldquo;{query}&rdquo;</p>
      )}

      <div className="flex flex-col" style={{ gap: 8 }}>
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
