'use client'
import { useEffect, useState } from 'react'
import type { MediaCache, MediaType } from '@mywatch/core'
import { TmdbClient, normalizeMovie, normalizeTv, isStale } from '@mywatch/tmdb'
import type { TmdbMovieDetail, TmdbTvDetail } from '@mywatch/tmdb'
import { db } from '@/lib/db'

function getClient() {
  return new TmdbClient({ apiKey: process.env.NEXT_PUBLIC_TMDB_API_KEY ?? '' })
}

export function useMediaMeta(tmdbId: number, mediaType: MediaType) {
  const [meta, setMeta] = useState<MediaCache | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await db.mediaCache.get([tmdbId, mediaType])
      if (cached && !isStale(cached)) {
        if (!cancelled) setMeta(cached)
        return
      }
      try {
        const client = getClient()
        const detail =
          mediaType === 'movie'
            ? await client.getMovie(tmdbId)
            : await client.getTv(tmdbId)
        const normalized =
          mediaType === 'movie'
            ? normalizeMovie(detail as TmdbMovieDetail)
            : normalizeTv(detail as TmdbTvDetail)
        await db.mediaCache.put(normalized)
        if (!cancelled) setMeta(normalized)
      } catch {
        if (cached && !cancelled) setMeta(cached)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tmdbId, mediaType])

  return meta
}
