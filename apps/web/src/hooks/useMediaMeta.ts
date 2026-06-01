'use client'
import { useEffect, useState } from 'react'
import type { MediaCache, MediaType, WatchProvider } from '@mywatch/core'
import { TmdbClient, normalizeMovie, normalizeTv, isStale } from '@mywatch/tmdb'
import type { TmdbMovieDetail, TmdbTvDetail } from '@mywatch/tmdb'
import { db } from '@/lib/db'

const PROVIDERS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function getClient(tmdbApiKey: string) {
  const key = tmdbApiKey || (process.env.NEXT_PUBLIC_TMDB_API_KEY ?? '')
  return new TmdbClient({ apiKey: key })
}

function isProviderStale(cachedAt: string | null): boolean {
  if (!cachedAt) return true
  return Date.now() - new Date(cachedAt).getTime() > PROVIDERS_MAX_AGE_MS
}

async function fetchAndStoreProviders(
  client: TmdbClient,
  tmdbId: number,
  mediaType: MediaType,
  region: string,
): Promise<WatchProvider[]> {
  try {
    const data = await client.getWatchProviders(tmdbId, mediaType, region)
    const regionData = data.results[region]
    const flatrate = regionData?.flatrate ?? []
    const providers: WatchProvider[] = flatrate.map((p) => ({
      providerId: p.provider_id,
      providerName: p.provider_name,
      logoPath: p.logo_path,
      displayPriority: p.display_priority,
    }))
    providers.sort((a, b) => a.displayPriority - b.displayPriority)
    const now = new Date().toISOString()
    await db.mediaCache.where('[tmdbId+mediaType]').equals([tmdbId, mediaType]).modify({
      watchProviders: providers,
      watchProvidersRegion: region,
      watchProvidersCachedAt: now,
    })
    return providers
  } catch {
    return []
  }
}

export function useMediaMeta(tmdbId: number, mediaType: MediaType, tmdbApiKey: string, language: string = 'en-US') {
  const [meta, setMeta] = useState<MediaCache | null>(null)

  useEffect(() => {
    let cancelled = false
    const region = navigator.language?.split('-')[1] ?? 'US'
    const client = getClient(tmdbApiKey)

    ;(async () => {
      try {
        const cached = await db.mediaCache.get([tmdbId, mediaType])
        // Invalidate if language has changed, if standard staleness applies, or if tv show is missing seasons info
        const needsTvSeasons = mediaType === 'tv' && (!cached || cached.seasons === undefined || cached.seasons === null)
        const needsTrailer = !cached || cached.youtubeTrailerKey === undefined
        if (cached && !isStale(cached) && cached.language === language && !needsTvSeasons && !needsTrailer) {
          if (!cancelled) setMeta(cached)
          if (isProviderStale(cached.watchProvidersCachedAt ?? null)) {
            fetchAndStoreProviders(client, tmdbId, mediaType, region).then((providers) => {
              if (!cancelled) setMeta((prev) => prev ? { ...prev, watchProviders: providers } : prev)
            })
          }
          return
        }
        const detail =
          mediaType === 'movie'
            ? await client.getMovie(tmdbId, language)
            : await client.getTv(tmdbId, language)
        const normalized =
          mediaType === 'movie'
            ? normalizeMovie(detail as TmdbMovieDetail, language)
            : normalizeTv(detail as TmdbTvDetail, language)
        await db.mediaCache.put(normalized)
        if (!cancelled) setMeta(normalized)
        fetchAndStoreProviders(client, tmdbId, mediaType, region).then((providers) => {
          if (!cancelled) setMeta((prev) => prev ? { ...prev, watchProviders: providers } : prev)
        })
      } catch {
        const cached = await db.mediaCache.get([tmdbId, mediaType]).catch(() => undefined)
        if (cached && !cancelled) setMeta(cached)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tmdbId, mediaType, tmdbApiKey, language])

  return meta
}
