'use client'
import Link from 'next/link'
import type { WatchlistItem } from '@mywatch/core'
import { StatusBadge } from './StatusBadge'
import { useMediaMeta } from '@/hooks/useMediaMeta'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w92'

export function WatchlistItemCard({ item }: { item: WatchlistItem }) {
  const meta = useMediaMeta(item.tmdbId, item.mediaType)

  return (
    <Link href={`/media/${item.mediaType}/${item.tmdbId}`}>
      <div className="flex gap-3 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition cursor-pointer">
        <div className="flex-shrink-0 w-12 h-[72px] rounded overflow-hidden bg-zinc-700">
          {meta?.posterPath && (
            <img
              src={`${TMDB_IMG}${meta.posterPath}`}
              alt={meta.title}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <p className="font-medium text-sm truncate">{meta?.title ?? `#${item.tmdbId}`}</p>
          <div className="mt-1">
            <StatusBadge status={item.status} />
          </div>
          {item.mediaType === 'tv' && item.progressSeason != null && (
            <p className="text-xs text-zinc-400 mt-0.5">
              S{item.progressSeason} · E{item.progressEpisode ?? '?'}
            </p>
          )}
          {item.rating != null && (
            <p className="text-xs text-zinc-400 mt-0.5">★ {item.rating}/10</p>
          )}
        </div>
      </div>
    </Link>
  )
}
