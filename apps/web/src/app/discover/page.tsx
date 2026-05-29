'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import type { TmdbSearchResult } from '@mywatch/tmdb'
import { TmdbClient } from '@mywatch/tmdb'
import type { WatchStatus, MediaType } from '@mywatch/core'
import { useWatchlistItem, useUpsertItem, getLocalDeviceId } from '@/hooks/useWatchlist'
import { MediaCard } from '@/components/MediaCard'
import { StatusPicker } from '@/components/StatusPicker'
import { db } from '@/lib/db'

function getClient() {
  return new TmdbClient({ apiKey: process.env.NEXT_PUBLIC_TMDB_API_KEY ?? '' })
}

function DiscoverCard({
  result,
  onAdd,
}: {
  result: TmdbSearchResult
  onAdd: (r: TmdbSearchResult) => void
}) {
  const existing = useWatchlistItem(result.id, result.media_type)
  return <MediaCard result={result} existingStatus={existing?.status} onAdd={onAdd} />
}

function Row({
  title,
  results,
  onAdd,
}: {
  title: string
  results: TmdbSearchResult[]
  onAdd: (r: TmdbSearchResult) => void
}) {
  if (results.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2">
        {results.slice(0, 5).map((r) => (
          <DiscoverCard key={`${r.media_type}-${r.id}`} result={r} onAdd={onAdd} />
        ))}
      </div>
    </section>
  )
}

export default function DiscoverPage() {
  const { data: session } = useSession()
  const [trending, setTrending] = useState<TmdbSearchResult[]>([])
  const [topRated, setTopRated] = useState<TmdbSearchResult[]>([])
  const [recommendations, setRecommendations] = useState<TmdbSearchResult[]>([])
  const [pending, setPending] = useState<TmdbSearchResult | null>(null)
  const upsert = useUpsertItem()

  const recentActive = useLiveQuery(() =>
    db.watchlistItems
      .filter(
        (i) =>
          (i.status === 'in_progress' || i.status === 'watched') && i.deletedAt === null,
      )
      .reverse()
      .limit(3)
      .toArray(),
  )

  useEffect(() => {
    const client = getClient()
    client.getTrending('week').then(setTrending).catch(() => {})
    client.getTopRated('movie').then(setTopRated).catch(() => {})
  }, [])

  useEffect(() => {
    if (!recentActive?.length) return
    const source = recentActive[0]
    const client = getClient()
    client
      .getRecommendations(source.tmdbId, source.mediaType as MediaType)
      .then(setRecommendations)
      .catch(() => {})
  }, [recentActive?.length])

  async function handleAdd(result: TmdbSearchResult, status: WatchStatus) {
    const now = new Date().toISOString()
    await upsert({
      id: uuidv4(),
      userId: session?.user?.id ?? getLocalDeviceId(),
      tmdbId: result.id,
      mediaType: result.media_type,
      status,
      progressSeason: null,
      progressEpisode: null,
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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
          ← Back
        </Link>
        <h1 className="text-xl font-bold">Discover</h1>
      </header>

      <Row title="Trending This Week" results={trending} onAdd={setPending} />
      {recommendations.length > 0 && (
        <Row title="Because You Watched…" results={recommendations} onAdd={setPending} />
      )}
      <Row title="Top Rated Movies" results={topRated} onAdd={setPending} />

      {pending && (
        <StatusPicker
          onSelect={(status) => handleAdd(pending, status)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
