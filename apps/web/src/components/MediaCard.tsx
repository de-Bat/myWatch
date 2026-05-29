'use client'
import Link from 'next/link'
import type { TmdbSearchResult } from '@mywatch/tmdb'
import type { WatchStatus } from '@mywatch/core'
import { StatusBadge } from './StatusBadge'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w154'

interface Props {
  result: TmdbSearchResult
  existingStatus?: WatchStatus
  onAdd: (result: TmdbSearchResult) => void
}

export function MediaCard({ result, existingStatus, onAdd }: Props) {
  const title = result.media_type === 'movie' ? result.title : result.name
  const year =
    result.media_type === 'movie'
      ? result.release_date?.slice(0, 4)
      : result.first_air_date?.slice(0, 4)

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-zinc-800">
      <Link href={`/media/${result.media_type}/${result.id}`} className="flex-shrink-0">
        <div className="w-12 h-[72px] rounded overflow-hidden bg-zinc-700">
          {result.poster_path && (
            <img
              src={`${TMDB_IMG}${result.poster_path}`}
              alt={title}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/media/${result.media_type}/${result.id}`}>
          <p className="font-medium text-sm truncate hover:text-indigo-300">{title}</p>
        </Link>
        <p className="text-xs text-zinc-400 mt-0.5">
          {year} · {result.media_type === 'movie' ? 'Movie' : 'TV'} · ★{' '}
          {result.vote_average.toFixed(1)}
        </p>
        <div className="mt-2">
          {existingStatus ? (
            <StatusBadge status={existingStatus} />
          ) : (
            <button
              onClick={() => onAdd(result)}
              className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500"
            >
              + Add
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
